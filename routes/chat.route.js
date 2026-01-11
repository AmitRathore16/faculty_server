import express from "express";
import {
  getConversations,
  createConversation,
  getMessages,
  markConversationAsRead,
  sendMessage,
  markMessageAsRead,
  getUnreadCount,
  uploadChatImage,
} from "../controllers/chat.controller.js";
import { authenticateAdminOrEducator } from "../middleware/auth.middleware.js";
import { body, param } from "express-validator";
import { uploadGenericImage } from "../config/cloudinary.js";

const router = express.Router();

// All routes require admin or educator authentication
router.use(authenticateAdminOrEducator);

/**
 * @route   GET /api/chat/conversations
 * @desc    Get all conversations for the authenticated user
 * @access  Private (Admin or Educator)
 */
router.get("/conversations", getConversations);

/**
 * @route   POST /api/chat/conversations
 * @desc    Create or get existing conversation
 * @access  Private (Admin or Educator)
 * @body    {
 *   otherUserId?: ObjectId (optional for educators - will use super admin)
 * }
 */
router.post(
  "/conversations",
  [
    body("otherUserId")
      .optional()
      .isMongoId()
      .withMessage("Invalid user ID format"),
  ],
  createConversation
);

/**
 * @route   GET /api/chat/conversations/:id/messages
 * @desc    Get messages for a specific conversation with pagination
 * @access  Private (Admin or Educator - must be participant)
 * @param   id - Conversation ObjectId
 * @query   {
 *   page?: number (default: 1),
 *   limit?: number (default: 50, max: 100)
 * }
 */
router.get(
  "/conversations/:id/messages",
  [param("id").isMongoId().withMessage("Invalid conversation ID")],
  getMessages
);

/**
 * @route   PUT /api/chat/conversations/:id/read
 * @desc    Mark all messages in a conversation as read
 * @access  Private (Admin or Educator - must be participant)
 * @param   id - Conversation ObjectId
 */
router.put(
  "/conversations/:id/read",
  [param("id").isMongoId().withMessage("Invalid conversation ID")],
  markConversationAsRead
);

/**
 * @route   POST /api/chat/upload/image
 * @desc    Upload chat image (Option A: images only)
 * @access  Private (Admin or Educator)
 * @body    form-data { image: File }
 */
router.post(
  "/upload/image",
  uploadGenericImage.single("image"),
  uploadChatImage
);

/**
 * @route   POST /api/chat/messages
 * @desc    Send a message (REST fallback - prefer WebSocket)
 * @access  Private (Admin or Educator - must be participant)
 * @body    {
 *   conversationId: ObjectId (required),
 *   receiverId: ObjectId (required),
 *   receiverType: "Admin" | "Educator" (required),
 *   content: string (required, max 5000 chars),
 *   messageType?: "text" | "image" | "file" (default: "text"),
 *   attachments?: array (optional)
 * }
 */
router.post(
  "/messages",
  [
    body("conversationId")
      .notEmpty()
      .withMessage("Conversation ID is required")
      .isMongoId()
      .withMessage("Invalid conversation ID format"),
    body("receiverId")
      .notEmpty()
      .withMessage("Receiver ID is required")
      .isMongoId()
      .withMessage("Invalid receiver ID format"),
    body("receiverType")
      .notEmpty()
      .withMessage("Receiver type is required")
      .isIn(["Admin", "Educator"])
      .withMessage("Receiver type must be Admin or Educator"),
    body("content")
      .notEmpty()
      .withMessage("Message content is required")
      .isLength({ max: 5000 })
      .withMessage("Message content cannot exceed 5000 characters")
      .trim(),
    body("messageType")
      .optional()
      .isIn(["text", "image", "file"])
      .withMessage("Message type must be text, image, or file"),
    body("attachments")
      .optional()
      .isArray()
      .withMessage("Attachments must be an array"),
  ],
  sendMessage
);

/**
 * @route   PUT /api/chat/messages/:id/read
 * @desc    Mark a message as read
 * @access  Private (Admin or Educator - must be receiver)
 * @param   id - Message ObjectId
 */
router.put(
  "/messages/:id/read",
  [param("id").isMongoId().withMessage("Invalid message ID")],
  markMessageAsRead
);

/**
 * @route   GET /api/chat/unread-count
 * @desc    Get unread message count for authenticated user
 * @access  Private (Admin or Educator)
 */
router.get("/unread-count", getUnreadCount);

export default router;
