import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          refPath: "participants.userType",
        },
        userType: {
          type: String,
          required: true,
          enum: ["Educator", "Admin", "Student"],
        },
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    conversationType: {
      type: String,
      enum: ["admin_educator", "student_educator"],
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
conversationSchema.index({ "participants.userId": 1 });
conversationSchema.index({ isActive: 1, lastMessageAt: -1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ conversationType: 1, "participants.userId": 1 });
conversationSchema.index({
  conversationType: 1,
  isActive: 1,
  lastMessageAt: -1,
});

// Validate conversation participants based on type
conversationSchema.pre("save", function (next) {
  if (this.participants.length !== 2) {
    return next(new Error("Conversation must have exactly 2 participants"));
  }

  const types = this.participants.map((p) => p.userType).sort();

  if (this.conversationType === "admin_educator") {
    if (types[0] !== "Admin" || types[1] !== "Educator") {
      return next(
        new Error(
          "admin_educator conversation must be between Admin and Educator"
        )
      );
    }
  } else if (this.conversationType === "student_educator") {
    if (!(types.includes("Student") && types.includes("Educator"))) {
      return next(
        new Error(
          "student_educator conversation must be between Student and Educator"
        )
      );
    }
  }

  next();
});

// Static method to find conversation by participants
conversationSchema.statics.findByParticipants = async function (
  educatorId,
  adminId
) {
  return this.findOne({
    participants: {
      $all: [
        { $elemMatch: { userId: educatorId, userType: "Educator" } },
        { $elemMatch: { userId: adminId, userType: "Admin" } },
      ],
    },
  }).populate([
    {
      path: "participants.userId",
      select: "fullName username email profilePicture image",
    },
    {
      path: "lastMessage",
      select: "content messageType isRead createdAt",
    },
  ]);
};

// Static method to get conversations for a user
conversationSchema.statics.findByUserId = async function (userId, userType) {
  return this.find({
    participants: {
      $elemMatch: { userId, userType },
    },
    isActive: true,
  })
    .populate([
      {
        path: "participants.userId",
        select: "fullName username email profilePicture image",
      },
      {
        path: "lastMessage",
        select: "content messageType isRead createdAt sender",
      },
    ])
    .sort({ lastMessageAt: -1 });
};

// Static method to find conversation by student and educator
conversationSchema.statics.findStudentEducatorConversation = async function (
  studentId,
  educatorId
) {
  return this.findOne({
    conversationType: "student_educator",
    participants: {
      $all: [
        { $elemMatch: { userId: studentId, userType: "Student" } },
        { $elemMatch: { userId: educatorId, userType: "Educator" } },
      ],
    },
  }).populate([
    {
      path: "participants.userId",
      select: "name fullName username email profilePicture image",
    },
    {
      path: "lastMessage",
      select: "content messageType isRead createdAt",
    },
  ]);
};

// Static method to get all educator queries (student-educator conversations)
conversationSchema.statics.getEducatorQueries = async function (educatorId) {
  return this.find({
    conversationType: "student_educator",
    participants: {
      $elemMatch: { userId: educatorId, userType: "Educator" },
    },
    isActive: true,
  })
    .populate([
      {
        path: "participants.userId",
        select:
          "name fullName username email profilePicture image mobileNumber",
      },
      {
        path: "lastMessage",
        select: "content messageType isRead createdAt sender",
      },
    ])
    .sort({ lastMessageAt: -1 });
};

// Method to get unread count for a user
conversationSchema.methods.getUnreadCount = async function (userId) {
  const Message = mongoose.model("Message");
  return await Message.countDocuments({
    conversationId: this._id,
    "receiver.userId": userId,
    isRead: false,
  });
};

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
