import express from "express";
import {
  createPaymentOrder,
  getPaymentStatus,
  handleRazorpayWebhook,
  verifyPaymentSignature,
} from "../controllers/payment.controller.js";
import {
  createPaymentOrderValidation,
  validatePaymentIntentIdParam,
} from "../util/validation.js";

const router = express.Router();

router.post("/orders", createPaymentOrderValidation, createPaymentOrder);
router.get("/:id", validatePaymentIntentIdParam, getPaymentStatus);
router.post("/webhook", handleRazorpayWebhook);
router.post("/verify", verifyPaymentSignature);

export default router;
