import { validationResult } from "express-validator";
import ChatService from "../services/chat.service.js";
import Conversation from "../models/conversation.js";

const chatService = ChatService.getInstance();

/**
 * ✅ Middleware sends:
 * req.auth.userType = "student" | "educator" | "admin"
 * but DB stores: "Student" | "Educator" | "Admin"
 */
const mapUserType = (userType) => {
  if (userType === "student") return "Student";
  if (userType === "educator") return "Educator";
  if (userType === "admin") return "Admin";
  return null;
};

/**
 * ✅ Safe participant check
 * Handles: ObjectId, populated object, null
 */
const isUserParticipant = (conversation, authUserId) => {
  const uid = authUserId.toString();

  return conversation.participants.some((p) => {
    const pid = (p.userId?._id ?? p.userId)?.toString();
    return pid === uid;
  });
};

// ================= Upload chat image (optional) =================
export const uploadChatImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const url = req.file.path || req.file.secure_url;

    if (!url) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve uploaded image URL",
      });
    }

    const attachment = {
      url,
      type: "image",
      filename: req.file.originalname || req.file.filename,
      size: req.file.size,
    };

    return res.status(201).json({
      success: true,
      message: "Image uploaded successfully",
      data: { attachment },
    });
  } catch (error) {
    console.error("Error uploading chat image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
};

// ================= Conversation list =================
export const getConversations = async (req, res) => {
  try {
    const userId = req.auth.userId;

    const userType = mapUserType(req.auth.userType);
    if (!userType) {
      return res.status(403).json({
        success: false,
        message: "Invalid user type",
      });
    }

    const conversations = await chatService.getUserConversations(
      userId,
      userType
    );

    res.status(200).json({
      success: true,
      message: "Conversations retrieved successfully",
      data: { conversations },
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ================= Student create conversation =================
export const createConversation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { otherUserId } = req.body;

    const currentUserId = req.auth.userId;
    const currentUserType = req.auth.userType; // student | educator | admin

    /**
     * ✅ ONLY Student -> Educator supported here
     */
    if (currentUserType !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only Student can create chat with Educator",
      });
    }

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        message: "otherUserId (Educator) is required for student chat",
      });
    }

    const result =
      await chatService.getOrCreateStudentEducatorConversation(
        currentUserId,
        otherUserId
      );

    return res.status(200).json({
      success: true,
      message: result.isNew
        ? "Conversation created successfully"
        : "Conversation retrieved successfully",
      data: { conversation: result.conversation },
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ================= Get messages =================
export const getMessages = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    if (!isUserParticipant(conversation, req.auth.userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this conversation",
      });
    }

    const result = await chatService.getMessages(
      id,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      message: "Messages retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ================= Mark conversation read =================
export const markConversationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth.userId;

    const userType = mapUserType(req.auth.userType);
    if (!userType) {
      return res.status(403).json({
        success: false,
        message: "Invalid user type",
      });
    }

    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    if (!isUserParticipant(conversation, userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this conversation",
      });
    }

    await chatService.markAllAsReadInConversation(id, userId);

    const unreadCount = await chatService.getUnreadCount(userId, userType);

    return res.status(200).json({
      success: true,
      message: "Conversation marked as read",
      data: { conversationId: id, unreadCount },
    });
  } catch (error) {
    console.error("Error marking conversation as read:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ================= Send message =================
export const sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const {
      conversationId,
      receiverId,
      receiverType,
      content,
      messageType = "text",
      attachments = [],
    } = req.body;

    const senderId = req.auth.userId;
    const senderType = mapUserType(req.auth.userType);

    if (!senderType) {
      return res.status(403).json({
        success: false,
        message: "Invalid sender type",
      });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    if (!isUserParticipant(conversation, senderId)) {
      return res.status(403).json({
        success: false,
        message: "You are not a participant in this conversation",
      });
    }

    const message = await chatService.sendMessage(
      conversationId,
      senderId,
      senderType,
      receiverId,
      receiverType,
      content,
      messageType,
      attachments
    );

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: { message },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ================= Mark message read =================
export const markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth.userId;

    const message = await chatService.markAsRead(id, userId);

    res.status(200).json({
      success: true,
      message: "Message marked as read",
      data: { message },
    });
  } catch (error) {
    console.error("Error marking message as read:", error);

    if (error.message === "Message not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === "Only the receiver can mark message as read") {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ================= Get unread count =================
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.auth.userId;

    const userType = mapUserType(req.auth.userType);
    if (!userType) {
      return res.status(403).json({
        success: false,
        message: "Invalid user type",
      });
    }

    const unreadCount = await chatService.getUnreadCount(userId, userType);

    res.status(200).json({
      success: true,
      message: "Unread count retrieved successfully",
      data: { unreadCount },
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default {
  getConversations,
  createConversation,
  getMessages,
  markConversationAsRead,
  sendMessage,
  markMessageAsRead,
  getUnreadCount,
  uploadChatImage,
};
