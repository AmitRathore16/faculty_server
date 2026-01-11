import mongoose from "mongoose";

const payoutSchema = new mongoose.Schema(
  {
    educatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Educator",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Payout amount cannot be negative"],
    },
    grossAmount: {
      type: Number,
      required: true,
      min: [0, "Gross amount cannot be negative"],
    },
    commissionAmount: {
      type: Number,
      required: true,
      min: [0, "Commission amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "paid", "failed", "reversed"],
      default: "pending",
      index: true,
    },
    razorpayPayoutId: {
      type: String,
      index: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    payoutCheckId: {
      type: String,
      unique: true,
      required: true,
    },
    month: {
      type: Number, // 1-12
      required: true,
    },
    year: {
      type: Number, // e.g. 2024
      required: true,
    },
    failureReason: {
      type: String,
    },
    narration: {
        type: String,
        default: "Payout"
    }
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate payouts for the same educator same month
// payoutSchema.index({ educatorId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model("Payout", payoutSchema);
