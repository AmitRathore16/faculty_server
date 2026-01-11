import mongoose from "mongoose";

const PAYMENT_PRODUCT_TYPES = [
  "course",
  "testSeries",
  "webinar",
  "test",
  "liveClass",
];
const PAYMENT_STATUSES = [
  "created",
  "pending",
  "authorized",
  "succeeded",
  "failed",
  "refunded",
  "cancelled",
];

const paymentIntentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    productType: {
      type: String,
      enum: PAYMENT_PRODUCT_TYPES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "created",
      index: true,
    },
    razorpayOrderId: {
      type: String,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    receipt: {
      type: String,
    },
    expiresAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    productSnapshot: {
      type: mongoose.Schema.Types.Mixed,
    },
    errorReason: {
      type: String,
    },
    notes: {
      type: Map,
      of: String,
    },
    lastEvent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

paymentIntentSchema.index({ productId: 1, productType: 1 });
paymentIntentSchema.index({ createdAt: -1 });

export default mongoose.model("PaymentIntent", paymentIntentSchema);
