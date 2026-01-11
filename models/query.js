import mongoose from "mongoose";

const querySchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "Conversation ID is required"],
      unique: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student ID is required"],
      index: true,
    },
    educatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Educator",
      required: [true, "Educator ID is required"],
      index: true,
    },
    subject: {
      type: String,
      required: [true, "Query subject is required"],
      trim: true,
      maxlength: [200, "Subject cannot exceed 200 characters"],
    },
    initialMessage: {
      type: String,
      required: [true, "Initial message is required"],
      trim: true,
      maxlength: [1000, "Initial message cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "replied", "resolved"],
        message: "{VALUE} is not a valid status",
      },
      default: "pending",
      index: true,
    },
    lastReplyAt: {
      type: Date,
    },
    metadata: {
      courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
      webinarId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Webinar",
      },
      courseName: {
        type: String,
        trim: true,
      },
      webinarName: {
        type: String,
        trim: true,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for better query performance
querySchema.index({ educatorId: 1, status: 1, createdAt: -1 });
querySchema.index({ studentId: 1, status: 1, createdAt: -1 });
querySchema.index({ educatorId: 1, isActive: 1, lastReplyAt: -1 });
querySchema.index({ status: 1, createdAt: -1 });

// Virtual to get message count
querySchema.virtual("messageCount", {
  ref: "Message",
  localField: "conversationId",
  foreignField: "conversationId",
  count: true,
});

// Method to mark query as replied
querySchema.methods.markAsReplied = async function () {
  if (this.status === "pending") {
    this.status = "replied";
    this.lastReplyAt = new Date();
    await this.save();
  }
  return this;
};

// Method to mark query as resolved
querySchema.methods.markAsResolved = async function () {
  this.status = "resolved";
  await this.save();
  return this;
};

// Static method to get queries for an educator
querySchema.statics.getEducatorQueries = async function (
  educatorId,
  filters = {}
) {
  const query = {
    educatorId,
    isActive: true,
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.search) {
    query.$or = [
      { subject: { $regex: filters.search, $options: "i" } },
      { initialMessage: { $regex: filters.search, $options: "i" } },
    ];
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const queries = await this.find(query)
    .populate("studentId", "name username email mobileNumber image")
    .populate("conversationId", "lastMessage lastMessageAt")
    .sort({ lastReplyAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    queries,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalQueries: total,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

// Static method to get queries for a student
querySchema.statics.getStudentQueries = async function (
  studentId,
  filters = {}
) {
  const query = {
    studentId,
    isActive: true,
  };

  if (filters.status) {
    query.status = filters.status;
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const skip = (page - 1) * limit;

  const queries = await this.find(query)
    .populate("educatorId", "fullName username email image")
    .populate("conversationId", "lastMessage lastMessageAt")
    .sort({ lastReplyAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    queries,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalQueries: total,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

const Query = mongoose.model("Query", querySchema);

export default Query;
