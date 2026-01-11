import {
  authenticateSocket,
  adminOrEducatorOnly,
} from "../middleware/socket.auth.middleware.js";
import ChatService from "../services/chat.service.js";
import Admin from "../models/admin.js";
import Educator from "../models/educator.js";

/**
 * Initialize the admin-educator chat namespace
 * @param {Server} io - Socket.IO server instance
 */
export const initializeChatNamespace = (io) => {
  const chatService = ChatService.getInstance();
  chatService.setSocketIO(io);

  const chatNamespace = io.of("/admin-educator-chat");

  // Apply authentication middleware
  chatNamespace.use(authenticateSocket);
  chatNamespace.use(adminOrEducatorOnly);

  chatNamespace.on("connection", async (socket) => {
    console.log(
      `✅ User connected to chat: ${socket.userId} (${socket.userRole})`
    );

    // Store user socket for real-time messaging
    chatService.setUserSocket(socket.userId, socket.id);

    // Send connection confirmation
    socket.emit("connected", {
      userId: socket.userId,
      userRole: socket.userRole,
      message: "Successfully connected to chat",
    });

    // Handle send_message event
    socket.on("send_message", async (data) => {
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

        // Send message via service
        const message = await chatService.sendMessage(
          conversationId,
          socket.userId,
          socket.userRole === "admin" ? "Admin" : "Educator",
          receiverId,
          receiverType,
          content,
          messageType,
          attachments
        );

        // Emit confirmation to sender
        socket.emit("message_sent", { message });

        console.log(
          `📨 Message sent from ${socket.userId} to ${receiverId} in conversation ${conversationId}`
        );
      } catch (error) {
        console.error("Error handling send_message:", error);
        socket.emit("error", {
          message: "Failed to send message",
          error: error.message,
        });
      }
    });

    // Handle typing indicator
    socket.on("typing", async (data) => {
      try {
        const { conversationId, receiverId, isTyping } = data;

        if (!conversationId || !receiverId) {
          return;
        }

        chatService.emitTyping(
          socket.userId,
          receiverId,
          conversationId,
          isTyping
        );

        console.log(
          `⌨️  User ${socket.userId} is ${
            isTyping ? "typing" : "stopped typing"
          } in conversation ${conversationId}`
        );
      } catch (error) {
        console.error("Error handling typing indicator:", error);
      }
    });

    // Handle mark_read event
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

        // Emit confirmation to sender (read receipt already emitted in service)
        socket.emit("marked_read", {
          messageId: message._id,
          readAt: message.readAt,
        });

        console.log(
          `✅ Message ${messageId} marked as read by ${socket.userId}`
        );
      } catch (error) {
        console.error("Error handling mark_read:", error);
        socket.emit("error", {
          message: "Failed to mark message as read",
          error: error.message,
        });
      }
    });

    // Handle mark_all_read event (mark all messages in a conversation as read)
    socket.on("mark_all_read", async (data) => {
      try {
        const { conversationId } = data;

        if (!conversationId) {
          socket.emit("error", {
            message: "Conversation ID is required",
          });
          return;
        }

        await chatService.markAllAsReadInConversation(
          conversationId,
          socket.userId
        );

        socket.emit("all_marked_read", {
          conversationId,
        });

        console.log(
          `✅ All messages in conversation ${conversationId} marked as read by ${socket.userId}`
        );
      } catch (error) {
        console.error("Error handling mark_all_read:", error);
        socket.emit("error", {
          message: "Failed to mark all messages as read",
          error: error.message,
        });
      }
    });

    // Handle get_unread_count event
    socket.on("get_unread_count", async () => {
      try {
        const userType = socket.userRole === "admin" ? "Admin" : "Educator";
        const unreadCount = await chatService.getUnreadCount(
          socket.userId,
          userType
        );

        socket.emit("unread_count", {
          count: unreadCount,
        });

        console.log(`📊 Unread count for ${socket.userId}: ${unreadCount}`);
      } catch (error) {
        console.error("Error getting unread count:", error);
        socket.emit("error", {
          message: "Failed to get unread count",
          error: error.message,
        });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(
        `❌ User disconnected from chat: ${socket.userId} (${socket.userRole})`
      );
      chatService.removeUserSocket(socket.userId);
    });

    // Handle error
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  console.log("✅ Chat namespace initialized at /admin-educator-chat");

  return chatNamespace;
};

export default initializeChatNamespace;
