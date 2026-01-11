import Conversation from "../models/conversation.js";
import Message from "../models/message.js";
import Admin from "../models/admin.js";
import Educator from "../models/educator.js";

class ChatService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // Maps userId to socketId
  }

  static instance = null;

  static getInstance() {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  setSocketIO(io) {
    this.io = io;
  }

  setUserSocket(userId, socketId) {
    this.userSockets.set(userId.toString(), socketId);
  }

  removeUserSocket(userId) {
    this.userSockets.delete(userId.toString());
  }

  getSocketIdByUserId(userId) {
    return this.userSockets.get(userId.toString());
  }

  // Create or get existing conversation
  async getOrCreateConversation(educatorId, adminId) {
    try {
      // Check if conversation already exists
      let conversation = await Conversation.findByParticipants(
        educatorId,
        adminId
      );

      if (conversation) {
        return conversation;
      }

      // Create new conversation
      conversation = new Conversation({
        participants: [
          { userId: educatorId, userType: "Educator" },
          { userId: adminId, userType: "Admin" },
        ],
        conversationType: "admin_educator",
        isActive: true,
      });

      await conversation.save();

      // Populate participants
      await conversation.populate([
        {
          path: "participants.userId",
          select: "fullName username email profilePicture image",
        },
      ]);

      return conversation;
    } catch (error) {
      console.error("Error creating/getting conversation:", error);
      throw error;
    }
  }

  // Send a message
  async sendMessage(
    conversationId,
    senderId,
    senderType,
    receiverId,
    receiverType,
    content,
    messageType = "text",
    attachments = []
  ) {
    try {
      const message = new Message({
        conversationId,
        sender: {
          userId: senderId,
          userType: senderType,
        },
        receiver: {
          userId: receiverId,
          userType: receiverType,
        },
        content,
        messageType,
        attachments,
      });

      await message.save();

      // Populate sender and receiver
      await message.populate([
        {
          path: "sender.userId",
          select: "fullName username email profilePicture image",
        },
        {
          path: "receiver.userId",
          select: "fullName username email profilePicture image",
        },
      ]);

      // Deliver message via socket if receiver is online
      await this.deliverMessage(receiverId, message);

      return message;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  // Deliver message to online user via socket
  async deliverMessage(receiverId, message) {
    if (!this.io) {
      return;
    }

    const receiverSocketId = this.getSocketIdByUserId(receiverId.toString());

    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit("new_message", { message });
    }
  }

  // Get messages for a conversation
  async getMessages(conversationId, page = 1, limit = 50) {
    try {
      return await Message.findByConversation(conversationId, page, limit);
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  }

  // Mark message as read
  async markAsRead(messageId, userId) {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        throw new Error("Message not found");
      }

      // Only receiver can mark as read
      if (message.receiver.userId.toString() !== userId.toString()) {
        throw new Error("Only the receiver can mark message as read");
      }

      await message.markAsRead();

      // Emit read receipt to sender if online
      if (this.io) {
        const senderSocketId = this.getSocketIdByUserId(
          message.sender.userId.toString()
        );

        if (senderSocketId) {
          this.io.to(senderSocketId).emit("message_read", {
            messageId: message._id,
            readAt: message.readAt,
          });
        }
      }

      return message;
    } catch (error) {
      console.error("Error marking message as read:", error);
      throw error;
    }
  }

  // Mark all messages in conversation as read
  async markAllAsReadInConversation(conversationId, userId) {
    try {
      await Message.markAllAsReadInConversation(conversationId, userId);
    } catch (error) {
      console.error("Error marking all messages as read:", error);
      throw error;
    }
  }

  // Get unread count for a user
  async getUnreadCount(userId, userType) {
    try {
      return await Message.getUnreadCount(userId, userType);
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw error;
    }
  }

  // Get conversations for a user
  async getUserConversations(userId, userType) {
    try {
      const conversations = await Conversation.findByUserId(userId, userType);

      // Add unread count for each conversation
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          const unreadCount = await conv.getUnreadCount(userId);
          return {
            ...conv.toObject(),
            unreadCount,
          };
        })
      );

      return conversationsWithUnread;
    } catch (error) {
      console.error("Error fetching user conversations:", error);
      throw error;
    }
  }

  // Get the other participant in a conversation
  getOtherParticipant(conversation, currentUserId) {
    return conversation.participants.find(
      (p) => p.userId._id.toString() !== currentUserId.toString()
    );
  }

  // Emit typing indicator
  emitTyping(senderId, receiverId, conversationId, isTyping) {
    if (!this.io) {
      return;
    }

    const receiverSocketId = this.getSocketIdByUserId(receiverId.toString());

    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit("typing", {
        conversationId,
        userId: senderId,
        isTyping,
      });
    }
  }
}

export default ChatService;
