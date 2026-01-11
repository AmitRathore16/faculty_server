import { validationResult } from "express-validator";
import Query from "../models/query.js";
import Conversation from "../models/conversation.js";
import Message from "../models/message.js";
import Student from "../models/student.js";
import Educator from "../models/educator.js";

// Create a new query (Student creates)
export const createQuery = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { studentId, educatorId, subject, initialMessage, metadata } =
      req.body;

    // Verify student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Verify educator exists
    const educator = await Educator.findById(educatorId);
    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findStudentEducatorConversation(
      studentId,
      educatorId
    );

    // Create new conversation if doesn't exist
    if (!conversation) {
      conversation = new Conversation({
        participants: [
          { userId: studentId, userType: "Student" },
          { userId: educatorId, userType: "Educator" },
        ],
        conversationType: "student_educator",
        isActive: true,
      });
      await conversation.save();
    }

    // Create initial message
    const message = new Message({
      conversationId: conversation._id,
      sender: {
        userId: studentId,
        userType: "Student",
      },
      receiver: {
        userId: educatorId,
        userType: "Educator",
      },
      content: initialMessage,
      messageType: "text",
    });
    await message.save();

    // Create query
    const query = new Query({
      conversationId: conversation._id,
      studentId,
      educatorId,
      subject,
      initialMessage,
      metadata: metadata || {},
      status: "pending",
    });
    await query.save();

    // Populate for response
    await query.populate([
      { path: "studentId", select: "name username email" },
      { path: "educatorId", select: "fullName username email" },
      { path: "conversationId" },
    ]);

    res.status(201).json({
      success: true,
      message: "Query created successfully",
      data: query,
    });
  } catch (error) {
    console.error("Error creating query:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educator queries with filters
export const getEducatorQueries = async (req, res) => {
  try {
    const { educatorId } = req.params;
    const { status, search, page, limit } = req.query;

    // Verify educator
    const educator = await Educator.findById(educatorId);
    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    // Get queries
    const result = await Query.getEducatorQueries(educatorId, {
      status,
      search,
      page,
      limit,
    });

    // Get message counts for each query
    const queriesWithMessages = await Promise.all(
      result.queries.map(async (query) => {
        const messageCount = await Message.countDocuments({
          conversationId: query.conversationId,
        });
        const unreadCount = await Message.countDocuments({
          conversationId: query.conversationId,
          "receiver.userId": educatorId,
          isRead: false,
        });
        return {
          ...query.toObject(),
          messageCount,
          unreadCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Queries retrieved successfully",
      data: {
        queries: queriesWithMessages,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error("Error fetching educator queries:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get student queries
export const getStudentQueries = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status, page, limit } = req.query;

    // Verify student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Get queries
    const result = await Query.getStudentQueries(studentId, {
      status,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      message: "Queries retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching student queries:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get query by ID
export const getQueryById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = await Query.findById(id)
      .populate("studentId", "name username email mobileNumber image")
      .populate("educatorId", "fullName username email image")
      .populate("conversationId");

    if (!query) {
      return res.status(404).json({
        success: false,
        message: "Query not found",
      });
    }

    // Get messages for this query
    const messages = await Message.find({
      conversationId: query.conversationId,
    })
      .populate([
        {
          path: "sender.userId",
          select: "name fullName username email image",
        },
        {
          path: "receiver.userId",
          select: "name fullName username email image",
        },
      ])
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      message: "Query retrieved successfully",
      data: {
        query,
        messages,
      },
    });
  } catch (error) {
    console.error("Error fetching query:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Reply to query (Educator)
export const replyToQuery = async (req, res) => {
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
    const { message: content } = req.body;

    const query = await Query.findById(id);
    if (!query) {
      return res.status(404).json({
        success: false,
        message: "Query not found",
      });
    }

    // Create reply message
    const message = new Message({
      conversationId: query.conversationId,
      sender: {
        userId: query.educatorId,
        userType: "Educator",
      },
      receiver: {
        userId: query.studentId,
        userType: "Student",
      },
      content,
      messageType: "text",
    });
    await message.save();

    // Update query status
    await query.markAsReplied();

    // Populate message for response
    await message.populate([
      {
        path: "sender.userId",
        select: "fullName username email image",
      },
      {
        path: "receiver.userId",
        select: "name username email image",
      },
    ]);

    res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: {
        message,
        query,
      },
    });
  } catch (error) {
    console.error("Error replying to query:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update reply message (Edit)
export const updateReply = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Update message content and add editedAt timestamp
    message.content = content;
    message.editedAt = new Date();
    await message.save();

    // Populate for response
    await message.populate([
      {
        path: "sender.userId",
        select: "name fullName username email image",
      },
      {
        path: "receiver.userId",
        select: "name fullName username email image",
      },
    ]);

    res.status(200).json({
      success: true,
      message: "Reply updated successfully",
      data: message,
    });
  } catch (error) {
    console.error("Error updating reply:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Resolve query
export const resolveQuery = async (req, res) => {
  try {
    const { id } = req.params;

    const query = await Query.findById(id);
    if (!query) {
      return res.status(404).json({
        success: false,
        message: "Query not found",
      });
    }

    await query.markAsResolved();

    res.status(200).json({
      success: true,
      message: "Query marked as resolved",
      data: query,
    });
  } catch (error) {
    console.error("Error resolving query:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete query (soft delete)
export const deleteQuery = async (req, res) => {
  try {
    const { id } = req.params;

    const query = await Query.findById(id);
    if (!query) {
      return res.status(404).json({
        success: false,
        message: "Query not found",
      });
    }

    // Soft delete query
    query.isActive = false;
    await query.save();

    // Soft delete conversation
    await Conversation.findByIdAndUpdate(query.conversationId, {
      isActive: false,
    });

    res.status(200).json({
      success: true,
      message: "Query deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting query:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default {
  createQuery,
  getEducatorQueries,
  getStudentQueries,
  getQueryById,
  replyToQuery,
  updateReply,
  resolveQuery,
  deleteQuery,
};
