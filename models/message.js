import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "Conversation ID is required"],
      index: true,
    },
    sender: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "sender.userType",
      },
      userType: {
        type: String,
        required: true,
        enum: ["Educator", "Admin", "Student"],
      },
    },
    receiver: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "receiver.userType",
      },
      userType: {
        type: String,
        required: true,
        enum: ["Educator", "Admin", "Student"],
      },
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      maxlength: [5000, "Message cannot exceed 5000 characters"],
    },
    messageType: {
      type: String,
      enum: {
        values: ["text", "image", "file"],
        message: "{VALUE} is not a valid message type",
      },
      default: "text",
    },
    attachments: [
      {
        url: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["image", "pdf", "document"],
        },
        filename: {
          type: String,
        },
        size: {
          type: Number,
        },
      },
    ],
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    editedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ "sender.userId": 1 });
messageSchema.index({ "receiver.userId": 1, isRead: 1 });
messageSchema.index({ createdAt: -1 });

// Update conversation's lastMessage when a message is saved
messageSchema.post("save", async function () {
  try {
    const Conversation = mongoose.model("Conversation");
    await Conversation.findByIdAndUpdate(this.conversationId, {
      lastMessage: this._id,
      lastMessageAt: this.createdAt,
    });
  } catch (error) {
    console.error("Error updating conversation lastMessage:", error);
  }
});

// Mark message as read
messageSchema.methods.markAsRead = async function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
};

// Static method to get messages for a conversation
messageSchema.statics.findByConversation = async function (
  conversationId,
  page = 1,
  limit = 50
) {
  const skip = (page - 1) * limit;

  const messages = await this.find({ conversationId })
    .populate([
      {
        path: "sender.userId",
        select: "fullName username email profilePicture image",
      },
      {
        path: "receiver.userId",
        select: "fullName username email profilePicture image",
      },
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments({ conversationId });

  return {
    messages: messages.reverse(), // Reverse to show oldest first
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalMessages: total,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

// Static method to get unread count for a user
messageSchema.statics.getUnreadCount = async function (userId, userType) {
  return await this.countDocuments({
    "receiver.userId": userId,
    "receiver.userType": userType,
    isRead: false,
  });
};

// Static method to mark all messages as read in a conversation
messageSchema.statics.markAllAsReadInConversation = async function (
  conversationId,
  userId
) {
  return await this.updateMany(
    {
      conversationId,
      "receiver.userId": userId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    }
  );
};

const Message = mongoose.model("Message", messageSchema);

export default Message;
