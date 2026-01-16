import Conversation from "../models/conversation.js";
import Message from "../models/message.js";

class ChatService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> socketId
  }

  static instance = null;

  static getInstance() {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // ================= SOCKET HELPERS =================
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

  // ================= STUDENT ↔ EDUCATOR =================

  /**
   * ✅ Create or get Student ↔ Educator conversation
   * Returns: {isNew: boolean, conversation: Conversation}
   */
  async getOrCreateStudentEducatorConversation(studentId, educatorId) {
    try {
      let conv = await Conversation.findOne({
        conversationType: "student_educator",
        participants: {
          $all: [
            { $elemMatch: { userId: studentId, userType: "Student" } },
            { $elemMatch: { userId: educatorId, userType: "Educator" } },
          ],
        },
      })
        .populate({
          path: "participants.userId",
          select: "fullName name username email profilePicture image",
        })
        .populate({
          path: "lastMessage",
          select: "content messageType attachments createdAt",
        });

      if (conv) {
        return { isNew: false, conversation: conv };
      }

      conv = await Conversation.create({
        conversationType: "student_educator",
        isActive: true,
        participants: [
          { userId: studentId, userType: "Student" },
          { userId: educatorId, userType: "Educator" },
        ],
      });

      conv = await Conversation.findById(conv._id)
        .populate({
          path: "participants.userId",
          select: "fullName name username email profilePicture image",
        })
        .populate({
          path: "lastMessage",
          select: "content messageType attachments createdAt",
        });

      return { isNew: true, conversation: conv };
    } catch (error) {
      console.error("Error in getOrCreateStudentEducatorConversation:", error);
      throw error;
    }
  }

  /**
   * ✅ Get conversations list for user (Student/Educator)
   * Populates participants for showing name + profile
   */
  async getUserConversations(userId, userType) {
    try {
      const conversations = await Conversation.find({
        participants: { $elemMatch: { userId, userType } },
        isActive: true,
      })
        .populate({
          path: "participants.userId",
          select: "fullName name username email profilePicture image",
        })
        .populate({
          path: "lastMessage",
          select: "content messageType attachments createdAt",
        })
        .sort({ lastMessageAt: -1, updatedAt: -1 });

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

  // ================= MESSAGES =================

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

      await message.populate([
        {
          path: "sender.userId",
          select: "fullName name username email profilePicture image",
        },
        {
          path: "receiver.userId",
          select: "fullName name username email profilePicture image",
        },
      ]);

      await this.deliverMessage(receiverId, message);

      return message;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  async deliverMessage(receiverId, message) {
    if (!this.io) return;

    const receiverSocketId = this.getSocketIdByUserId(receiverId.toString());
    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit("new_message", { message });
    }
  }

  async getMessages(conversationId, page = 1, limit = 50) {
    try {
      return await Message.findByConversation(conversationId, page, limit);
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  }

  async markAsRead(messageId, userId) {
    try {
      const message = await Message.findById(messageId);

      if (!message) throw new Error("Message not found");

      if (message.receiver.userId.toString() !== userId.toString()) {
        throw new Error("Only the receiver can mark message as read");
      }

      await message.markAsRead();

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

  async markAllAsReadInConversation(conversationId, userId) {
    try {
      await Message.markAllAsReadInConversation(conversationId, userId);
    } catch (error) {
      console.error("Error marking all messages as read:", error);
      throw error;
    }
  }

  async getUnreadCount(userId, userType) {
    try {
      return await Message.getUnreadCount(userId, userType);
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw error;
    }
  }
}

export default ChatService;
