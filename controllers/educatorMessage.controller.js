import { validationResult } from "express-validator";
import Educator from "../models/educator.js";
import Notification from "../models/notification.js";
import notificationService from "../services/notification.service.js";

// Send broadcast message to all followers
export const sendBroadcastMessage = async (req, res) => {
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
    const { title, message } = req.body;

    // Verify educator exists and is authenticated
    if (req.educator._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: "You can only send messages from your own account",
      });
    }

    const educator = await Educator.findById(id)
      .select("fullName username followers")
      .populate("followers", "preferences deviceToken");

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    if (!educator.followers || educator.followers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "You have no followers to send messages to",
      });
    }

    // Create notifications for all followers
    const notificationPromises = educator.followers.map(async (follower) => {
      const notification = new Notification({
        recipient: follower._id,
        sender: educator._id,
        type: "broadcast_message",
        title,
        message,
        metadata: {
          contentTitle: title,
        },
        deliveredAt: new Date(),
      });

      return await notification.save();
    });

    const createdNotifications = await Promise.all(notificationPromises);

    // Send real-time notifications via socket
    const io = notificationService.getSocketIO();
    if (io) {
      educator.followers.forEach((follower) => {
        const followerIdStr = follower._id.toString();

        // Emit to the notifications namespace for this student
        io.of("/notifications")
          .to(followerIdStr)
          .emit("notification", {
            notification: createdNotifications.find(
              (n) => n.recipient.toString() === followerIdStr
            ),
          });
      });
    }

    res.status(200).json({
      success: true,
      message: "Broadcast message sent successfully",
      data: {
        totalRecipients: educator.followers.length,
        notificationsSent: createdNotifications.length,
      },
    });
  } catch (error) {
    console.error("Error sending broadcast message:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get broadcast message history for an educator
export const getBroadcastHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Verify educator is authenticated
    if (req.educator._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own broadcast history",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get unique broadcast messages (group by title and message)
    const broadcasts = await Notification.aggregate([
      {
        $match: {
          sender: req.educator._id,
          type: "broadcast_message",
        },
      },
      {
        $group: {
          _id: {
            title: "$title",
            message: "$message",
            createdAt: "$createdAt",
          },
          count: { $sum: 1 },
          firstNotification: { $first: "$$ROOT" },
        },
      },
      {
        $sort: { "_id.createdAt": -1 },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
      {
        $project: {
          _id: "$firstNotification._id",
          title: "$_id.title",
          message: "$_id.message",
          recipientCount: "$count",
          sentAt: "$_id.createdAt",
        },
      },
    ]);

    const totalBroadcasts = await Notification.aggregate([
      {
        $match: {
          sender: req.educator._id,
          type: "broadcast_message",
        },
      },
      {
        $group: {
          _id: {
            title: "$title",
            message: "$message",
            createdAt: "$createdAt",
          },
        },
      },
      {
        $count: "total",
      },
    ]);

    const total = totalBroadcasts.length > 0 ? totalBroadcasts[0].total : 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Broadcast history retrieved successfully",
      data: {
        broadcasts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBroadcasts: total,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching broadcast history:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default {
  sendBroadcastMessage,
  getBroadcastHistory,
};
