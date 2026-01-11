import Razorpay from "razorpay";

let razorpayInstance;

export const getRazorpayClient = () => {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error("Razorpay credentials are not configured");
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
};

export const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID;

export const getRazorpayKeySecret = () => process.env.RAZORPAY_KEY_SECRET;

export const getRazorpayWebhookSecret = () =>
  process.env.RAZORPAY_WEBHOOK_SECRET || "";
