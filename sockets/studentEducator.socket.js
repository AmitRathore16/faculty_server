import {
  authenticateSocket,
  studentOrEducatorOnly,
} from "../middleware/socket.auth.middleware.js";
import ChatService from "../services/chat.service.js";
import Query from "../models/query.js";
import Message from "../models/message.js";

/**
 * Initialize the student-educator query namespace
 * @param {Server} io - Socket.IO server instance
 */
export const initializeStudentEducatorQueryNamespace = (io) => {
  const chatService = ChatService.getInstance();
  chatService.setSocketIO(io);

  const queryNamespace = io.of("/educator-student-queries");

  // Apply authentication middleware
  queryNamespace.use(authenticateSocket);
  queryNamespace.use(studentOrEducatorOnly);

  queryNamespace.on("connection", async (socket) => {
    console.log(
      `✅ User connected to queries: ${socket.userId} (${socket.userRole})`
    );

    // Store user socket for real-time messaging
    chatService.setUserSocket(socket.userId, socket.id);

    // Send connection confirmation
    socket.emit("connected", {
      userId: socket.userId,
      userRole: socket.userRole,
      message: "Successfully connected to query system",
    });

    // Handle send_query_message event
    socket.on("send_query_message", async (data) => {
      try {
        const {
          conversationId,
          receiverId,
          receiverType,
          content,
          messageType = "text",
          attachments = [],
        } = data;

        // Validate data
        if (!conversationId || !receiverId || !receiverType || !content) {
          socket.emit("error", {
            message:
              "Missing required fields: conversationId, receiverId, receiverType, content",
          });
          return;
        }

        if (!["text", "image", "file"].includes(messageType)) {
          socket.emit("error", {
            message: "Invalid message type. Must be text, image, or file",
          });
          return;
        }

        if (content.length > 5000) {
          socket.emit("error", {
            message: "Message content cannot exceed 5000 characters",
          });
          return;
        }

        // Determine sender type based on role
        const senderType =
          socket.userRole === "student"
            ? "Student"
            : socket.userRole === "educator"
            ? "Educator"
            : null;

        if (!senderType) {
          socket.emit("error", {
            message: "Invalid user role for query messaging",
          });
          return;
        }

        // Send message via service
        const message = await chatService.sendMessage(
          conversationId,
          socket.userId,
          senderType,
          receiverId,
          receiverType,
          content,
          messageType,
          attachments
        );

        // Update query status if this is educator's first reply
        if (senderType === "Educator") {
          const query = await Query.findOne({ conversationId });
          if (query && query.status === "pending") {
            await query.markAsReplied();

            // Emit query status update to both parties
            socket.emit("query_status_updated", {
              queryId: query._id,
              status: query.status,
            });

            // Emit to student
            chatService.deliverMessage(receiverId, "query_status_updated", {
              queryId: query._id,
              status: query.status,
            });
          }
        }

        // Send confirmation to sender
        socket.emit("message_sent", {
          message,
          tempId: data.tempId, // For client-side optimistic updates
        });

        console.log(`Message sent in conversation ${conversationId}`);
      } catch (error) {
        console.error("Error sending query message:", error);
        socket.emit("error", {
          message: "Failed to send message",
          error: error.message,
        });
      }
    });

    // Handle typing indicator
    socket.on("typing", async (data) => {
      try {
        const { conversationId, receiverId } = data;

        if (!conversationId || !receiverId) {
          return;
        }

        await chatService.emitTyping(
          socket.userId,
          receiverId,
          conversationId,
          true
        );
      } catch (error) {
        console.error("Error handling typing indicator:", error);
      }
    });

    // Handle stop typing
    socket.on("stop_typing", async (data) => {
      try {
        const { conversationId, receiverId } = data;

        if (!conversationId || !receiverId) {
          return;
        }

        await chatService.emitTyping(
          socket.userId,
          receiverId,
          conversationId,
          false
        );
      } catch (error) {
        console.error("Error handling stop typing:", error);
      }
    });

    // Handle mark message as read
    socket.on("mark_read", async (data) => {
      try {
        const { messageId } = data;

        if (!messageId) {
          socket.emit("error", {
            message: "Message ID is required",
          });
          return;
        }

        const message = await chatService.markAsRead(messageId, socket.userId);

        socket.emit("marked_read", {
          messageId,
          readAt: message.readAt,
        });

        console.log(`Message ${messageId} marked as read`);
      } catch (error) {
        console.error("Error marking message as read:", error);
        socket.emit("error", {
          message: "Failed to mark message as read",
          error: error.message,
        });
      }
    });

    // Handle mark all messages in conversation as read
    socket.on("mark_all_read", async (data) => {
      try {
        const { conversationId } = data;

        if (!conversationId) {
          socket.emit("error", {
            message: "Conversation ID is required",
          });
          return;
        }

        await Message.markAllAsReadInConversation(
          conversationId,
          socket.userId
        );

        socket.emit("all_marked_read", {
          conversationId,
        });

        console.log(
          `All messages in conversation ${conversationId} marked as read`
        );
      } catch (error) {
        console.error("Error marking all messages as read:", error);
        socket.emit("error", {
          message: "Failed to mark all messages as read",
          error: error.message,
        });
      }
    });

    // Handle get unread count
    socket.on("get_unread_count", async () => {
      try {
        const userType =
          socket.userRole === "student"
            ? "Student"
            : socket.userRole === "educator"
            ? "Educator"
            : null;

        if (!userType) {
          socket.emit("error", {
            message: "Invalid user role",
          });
          return;
        }

        const unreadCount = await chatService.getUnreadCount(
          socket.userId,
          userType
        );

        socket.emit("unread_count", {
          count: unreadCount,
        });
      } catch (error) {
        console.error("Error getting unread count:", error);
        socket.emit("error", {
          message: "Failed to get unread count",
          error: error.message,
        });
      }
    });

    // Handle resolve query
    socket.on("resolve_query", async (data) => {
      try {
        const { queryId } = data;

        if (!queryId) {
          socket.emit("error", {
            message: "Query ID is required",
          });
          return;
        }

        const query = await Query.findById(queryId);
        if (!query) {
          socket.emit("error", {
            message: "Query not found",
          });
          return;
        }

        await query.markAsResolved();

        // Emit to both parties
        socket.emit("query_resolved", {
          queryId: query._id,
          status: query.status,
        });

        // Emit to the other party
        const otherUserId =
          socket.userId.toString() === query.studentId.toString()
            ? query.educatorId
            : query.studentId;

        chatService.deliverMessage(otherUserId.toString(), "query_resolved", {
          queryId: query._id,
          status: query.status,
        });

        console.log(`Query ${queryId} marked as resolved`);
      } catch (error) {
        console.error("Error resolving query:", error);
        socket.emit("error", {
          message: "Failed to resolve query",
          error: error.message,
        });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(
        `❌ User disconnected from queries: ${socket.userId} (${socket.userRole})`
      );
      chatService.removeUserSocket(socket.userId);
    });
  });

  console.log("✅ Student-Educator Query namespace initialized");
};

export default {
  initializeStudentEducatorQueryNamespace,
};
