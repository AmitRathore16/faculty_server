import Payout from "../models/payout.js";
import { createPayout as createRazorpayPayout } from "../services/razorpay.service.js";
import { calculatePayoutsForMonth } from "../services/payout.service.js";

// Calculate Payouts for a specific month
export const calculateMonthlyPayouts = async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required",
      });
    }

    const payoutRecords = await calculatePayoutsForMonth(month, year);

    res.status(200).json({
      success: true,
      message: "Payouts calculated successfully",
      data: {
        count: payoutRecords.length,
        payouts: payoutRecords,
      },
    });
  } catch (error) {
    console.error("Error calculating payouts:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Process (Pay) a specific Payout
export const processPayout = async (req, res) => {
  try {
    const { payoutId } = req.body;

    if (!payoutId) {
      return res
        .status(400)
        .json({ success: false, message: "Payout ID is required" });
    }

    const payout = await Payout.findById(payoutId).populate("educatorId");

    if (!payout) {
      return res
        .status(404)
        .json({ success: false, message: "Payout record not found" });
    }

    if (payout.status !== "pending" && payout.status !== "failed") {
      return res
        .status(400)
        .json({
          success: false,
          message: `Payout is already ${payout.status}`,
        });
    }

    const educator = payout.educatorId;
    if (!educator.razorpayFundAccountId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Educator does not have a linked Fund Account",
        });
    }

    // Call Razorpay Service (payout.amount is already in paise)
    const razorpayPayout = await createRazorpayPayout({
      fundAccountId: educator.razorpayFundAccountId,
      amount: Math.round(payout.amount),
      currency: payout.currency,
      referenceId: payout.payoutCheckId,
      narration: `Payout for ${payout.month}/${payout.year}`,
    });

    // Update Payout Record
    payout.status = "processing"; // Razorpay returns 'processing' usually
    payout.razorpayPayoutId = razorpayPayout.id;
    await payout.save();

    res.status(200).json({
      success: true,
      message: "Payout initiated successfully",
      data: payout,
    });
  } catch (error) {
    console.error("Error processing payout:", error);
    res.status(500).json({
      success: false,
      message: "Payout failed",
      error: error.message,
    });
  }
};

// Get all payouts
export const getAllPayouts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, month, year } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (month) filter.month = month;
    if (year) filter.year = year;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payouts = await Payout.find(filter)
      .populate("educatorId", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payout.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        payouts,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getEducatorPayouts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, month, year } = req.query;
    const filter = { educatorId: req.educator?._id };
    if (status) filter.status = status;
    if (month) filter.month = month;
    if (year) filter.year = year;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Payout.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        payouts,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
