import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Recipient is required"],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Educator",
      required: [true, "Sender is required"],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: [
          "course",
          "webinar",
          "post",
          "test_series",
          "live_class",
          "broadcast_message",
        ],
        message: "{VALUE} is not a valid notification type",
      },
      required: [true, "Notification type is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [500, "Message cannot exceed 500 characters"],
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
      postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
      testSeriesId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TestSeries",
      },
      liveClassId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LiveClass",
      },
      resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true,
      },
      resourceType: {
        type: String,
        enum: [
          "course",
          "webinar",
          "post",
          "test_series",
          "live_class",
        ],
      },
      resourceRoute: {
        type: String,
        trim: true,
      },
      link: {
        type: String,
        trim: true,
      },
      thumbnail: {
        type: String,
        trim: true,
      },
      summary: {
        type: String,
        trim: true,
        maxlength: [280, "Summary cannot exceed 280 characters"],
      },
      contentTitle: {
        type: String,
        trim: true,
      },
      contentSlug: {
        type: String,
        trim: true,
      },
      scheduledDate: {
        type: Date,
      },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for better query performance
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ sender: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ "metadata.resourceId": 1, type: 1 });

// Static method to get unread count for a student
notificationSchema.statics.getUnreadCount = function (studentId) {
  return this.countDocuments({ recipient: studentId, isRead: false });
};

// Static method to mark all as read for a student
notificationSchema.statics.markAllAsRead = async function (studentId) {
  return this.updateMany(
    { recipient: studentId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Static method to get recent notifications for a student
notificationSchema.statics.getRecent = function (studentId, limit = 20) {
  return this.find({ recipient: studentId })
    .populate("sender", "fullName username profilePicture slug")
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to delete old read notifications (older than 30 days)
notificationSchema.statics.cleanupOldNotifications = async function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    isRead: true,
    readAt: { $lt: thirtyDaysAgo },
  });
};

// Method to mark notification as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Method to mark notification as delivered
notificationSchema.methods.markAsDelivered = function () {
  this.deliveredAt = new Date();
  return this.save();
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
