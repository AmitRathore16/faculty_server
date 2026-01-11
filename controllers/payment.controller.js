import crypto from "crypto";
import { validationResult } from "express-validator";
import PaymentIntent from "../models/paymentIntent.js";
import {
  enrollStudentInProduct,
  getProductDetails,
  getStudentById,
  isStudentAlreadyEnrolled,
} from "../services/enrollment.service.js";
import {
  getRazorpayClient,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  getRazorpayWebhookSecret,
} from "../config/razorpay.js";
import Payout from "../models/payout.js";
import { sendInvoiceEmail } from "../util/email.js";
import { generatePayoutInvoice } from "../services/invoice.service.js";

const respondValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array(),
    });
    return true;
  }
  return false;
};

const buildProductSnapshot = (productType, product) => {
  const snapshot = {
    title: product.title,
    description: product.description,
    educator: product.educatorID || product.educatorId,
  };
  if (productType === "course") {
    snapshot.fees = product.fees;
    snapshot.discount = product.discount;
  } else if (productType === "testSeries") {
    snapshot.price = product.price;
    snapshot.numberOfTests = product.numberOfTests;
  } else if (productType === "webinar") {
    snapshot.fees = product.fees;
    snapshot.timing = product.timing;
  } else if (productType === "liveClass") {
    snapshot.fees = product.liveClassesFee;
    snapshot.classTiming = product.classTiming;
    snapshot.classDuration = product.classDuration;
  }
  return snapshot;
};

export const createPaymentOrder = async (req, res) => {
  try {
    if (respondValidationErrors(req, res)) {
      return;
    }

    const { studentId, productType, productId } = req.body;

    const student = await getStudentById(studentId);
    const { product, price } = await getProductDetails(productType, productId);

    if (isStudentAlreadyEnrolled(productType, product, studentId)) {
      return res.status(400).json({
        success: false,
        message: "Student already enrolled in this product",
      });
    }

    const amountInPaise = Math.round(price * 100);

    const paymentIntent = await PaymentIntent.create({
      studentId,
      productId,
      productType,
      amount: amountInPaise,
      currency: "INR",
      status: "pending",
      productSnapshot: buildProductSnapshot(productType, product),
      metadata: {
        studentName: student.name,
        studentEmail: student.email,
      },
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
    });

    const receipt = `fp_${paymentIntent._id}`;
    const razorpay = getRazorpayClient();

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        paymentIntentId: paymentIntent._id.toString(),
        studentId: studentId.toString(),
        productId: productId.toString(),
        productType,
      },
    });

    paymentIntent.razorpayOrderId = order.id;
    paymentIntent.receipt = receipt;
    await paymentIntent.save();

    res.status(201).json({
      success: true,
      message: "Payment order created",
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        intentId: paymentIntent._id,
        razorpayKey: getRazorpayKeyId(),
        product: {
          title: product.title,
          type: productType,
        },
      },
    });
  } catch (error) {
    console.error("Error creating payment order:", error);
    const statusCode =
      error.message &&
      [
        "Student not found or inactive",
        "Unsupported product type",
        "Unable to find",
        "is inactive",
        "has reached capacity",
        "has invalid price",
      ].some((msg) => error.message.includes(msg))
        ? 400
        : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to create payment order",
    });
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const intent = await PaymentIntent.findById(id);

    if (!intent) {
      return res.status(404).json({
        success: false,
        message: "Payment intent not found",
      });
    }

    res.status(200).json({
      success: true,
      data: intent,
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch payment status",
      error: error.message,
    });
  }
};

const verifyWebhookSignature = (rawBody, receivedSignature) => {
  const webhookSecret = getRazorpayWebhookSecret();
  if (!webhookSecret) {
    throw new Error("Webhook secret is not configured");
  }
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  return expectedSignature === receivedSignature;
};

const handleSuccessfulPayment = async (intent, paymentEntity, eventName) => {
  if (intent.status === "succeeded") {
    return intent;
  }

  intent.status = "succeeded";
  intent.razorpayPaymentId = paymentEntity.id;
  intent.razorpaySignature = paymentEntity.signature || "";
  intent.lastEvent = eventName;
  await intent.save();

  await enrollStudentInProduct(
    intent.productType,
    intent.productId,
    intent.studentId,
    intent.productSnapshot || {}
  );

  return intent;
};

const handleFailedPayment = async (intent, paymentEntity, eventName) => {
  intent.status = "failed";
  intent.errorReason = paymentEntity.error_description || "Payment failed";
  intent.lastEvent = eventName;
  await intent.save();
  return intent;
};

export const verifyPaymentSignature = async (req, res) => {
  try {
    const { orderId, paymentId, signature, intentId } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: "orderId, paymentId and signature are required",
      });
    }

    const keySecret = getRazorpayKeySecret();
    if (!keySecret) {
      return res.status(500).json({
        success: false,
        message: "Razorpay secret not configured",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    const intent = intentId
      ? await PaymentIntent.findById(intentId)
      : await PaymentIntent.findOne({ razorpayOrderId: orderId });

    if (!intent) {
      return res.status(404).json({
        success: false,
        message: "Payment intent not found",
      });
    }

    if (intent.razorpayOrderId && intent.razorpayOrderId !== orderId) {
      return res.status(400).json({
        success: false,
        message: "Order mismatch for intent",
      });
    }

    if (intent.status === "succeeded") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        data: { status: intent.status, intentId: intent._id },
      });
    }

    const paymentEntity = {
      id: paymentId,
      status: "captured",
      signature,
    };

    const updatedIntent = await handleSuccessfulPayment(
      intent,
      paymentEntity,
      "payment.verified"
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified",
      data: { status: updatedIntent.status, intentId: updatedIntent._id },
    });
  } catch (error) {
    console.error("Error verifying payment signature:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify payment",
      error: error.message,
    });
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawString = req.rawBody || JSON.stringify(req.body || {});

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "Missing signature",
      });
    }

    if (!rawString || !verifyWebhookSignature(rawString, signature)) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // ...

    const payload =
      req.body && Object.keys(req.body).length
        ? req.body
        : JSON.parse(rawString);
    const eventName = payload.event;

    // Handle Payout Events
    if (eventName.startsWith("payout.")) {
      const payoutEntity = payload.payload?.payout?.entity;
      const referenceId = payoutEntity?.reference_id;

      if (referenceId) {
        const payout = await Payout.findOne({
          payoutCheckId: referenceId,
        }).populate("educatorId", "fullName email");

        if (payout) {
          if (eventName === "payout.processed") {
            payout.status = "paid";
            payout.razorpayPayoutId = payoutEntity.id;
          } else if (eventName === "payout.failed") {
            payout.status = "failed";
            payout.failureReason = payoutEntity.failure_reason;
          } else if (eventName === "payout.reversed") {
            payout.status = "reversed";
          }

          await payout.save();

          // Send invoice to educator when payout is paid
          if (payout.status === "paid" && payout.educatorId?.email) {
            try {
              const pdfBuffer = await generatePayoutInvoice({
                payout: payout.toObject(),
                educator: payout.educatorId,
              });
              await sendInvoiceEmail({
                to: payout.educatorId.email,
                payout,
                educator: payout.educatorId,
                pdfBuffer,
              });
            } catch (emailError) {
              console.error("Failed to send payout invoice email:", emailError);
            }
          }

          console.log(
            `Webhook: Updated payout ${referenceId} status to ${payout.status}`
          );
        }
      }

      return res
        .status(200)
        .json({ success: true, message: "Payout webhook processed" });
    }

    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const orderId = paymentEntity?.order_id || orderEntity?.id;

    if (!orderId) {
      // For non-payout events, orderId is required
      return res.status(400).json({
        success: false,
        message: "Order ID missing in payload",
      });
    }

    const intent = await PaymentIntent.findOne({ razorpayOrderId: orderId });

    if (!intent) {
      return res.status(404).json({
        success: false,
        message: "Payment intent not found for order",
      });
    }

    let updatedIntent = intent;

    if (
      eventName === "payment.captured" ||
      eventName === "order.paid" ||
      paymentEntity?.status === "captured"
    ) {
      updatedIntent = await handleSuccessfulPayment(
        intent,
        paymentEntity,
        eventName
      );
    } else if (paymentEntity?.status === "failed") {
      updatedIntent = await handleFailedPayment(
        intent,
        paymentEntity,
        eventName
      );
    } else if (eventName === "payment.authorized") {
      intent.status = "authorized";
      intent.razorpayPaymentId = paymentEntity?.id;
      intent.lastEvent = eventName;
      updatedIntent = await intent.save();
    } else {
      intent.lastEvent = eventName;
      updatedIntent = await intent.save();
    }

    res.status(200).json({
      success: true,
      message: "Webhook processed",
      data: {
        status: updatedIntent.status,
        intentId: updatedIntent._id,
      },
    });
  } catch (error) {
    console.error("Error handling Razorpay webhook:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process webhook",
      error: error.message,
    });
  }
};

export const getPaymentHistoryAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      productType,
      educatorId,
      from,
      to,
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (productType) filter.productType = productType;
    if (educatorId) filter["productSnapshot.educator"] = educatorId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      PaymentIntent.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PaymentIntent.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch payment history",
      error: error.message,
    });
  }
};

export const getEducatorPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, productType, from, to } = req.query;

    const filter = {
      "productSnapshot.educator": req.educator?._id,
    };
    if (status) filter.status = status;
    if (productType) filter.productType = productType;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payments, total] = await Promise.all([
      PaymentIntent.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PaymentIntent.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educator payment history:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch payment history",
      error: error.message,
    });
  }
};
