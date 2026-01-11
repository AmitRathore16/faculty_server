import express from "express";
import {
  sendBroadcastMessage,
  getBroadcastHistory,
} from "../controllers/educatorMessage.controller.js";
import { authenticateEducator } from "../middleware/auth.middleware.js";
import { body, param } from "express-validator";

const router = express.Router();

// Validation for broadcast message
const broadcastMessageValidation = [
  param("id").isMongoId().withMessage("Invalid educator ID"),
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 200 })
    .withMessage("Title cannot exceed 200 characters")
    .trim(),
  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ max: 1000 })
    .withMessage("Message cannot exceed 1000 characters")
    .trim(),
];

/**
 * @route   POST /api/educators/:id/broadcast
 * @desc    Send broadcast message to all followers
 * @access  Private (Educator only - must be the authenticated educator)
 * @param   id - Educator ObjectId
 * @body    {
 *   title: string (required, max 200 chars),
 *   message: string (required, max 1000 chars)
 * }
 */
router.post(
  "/:id/broadcast",
  authenticateEducator,
  broadcastMessageValidation,
  sendBroadcastMessage
);

/**
 * @route   GET /api/educators/:id/broadcast-history
 * @desc    Get broadcast message history for an educator
 * @access  Private (Educator only - must be the authenticated educator)
 * @param   id - Educator ObjectId
 * @query   {
 *   page?: number (default: 1),
 *   limit?: number (default: 20)
 * }
 */
router.get(
  "/:id/broadcast-history",
  authenticateEducator,
  [param("id").isMongoId().withMessage("Invalid educator ID")],
  getBroadcastHistory
);

export default router;
