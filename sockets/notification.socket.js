import {
  authenticateSocket,
  studentOnly,
} from "../middleware/socket.auth.middleware.js";
import notificationService from "../services/notification.service.js";

/**
 * Initialize notification socket handlers
 * @param {Server} io - Socket.io server instance
 */
export const initializeNotificationSocket = (io) => {
  // Create a Map to store user ID to socket ID mappings
  const userSockets = new Map();

  // Attach the Map to io instance so service can access it
  io.userSockets = userSockets;

  // Set socket.io instance in notification service
  notificationService.setSocketIO(io);

  // Create notification namespace
  const notificationNamespace = io.of("/notifications");

  // Apply authentication middleware
  notificationNamespace.use(authenticateSocket);
  notificationNamespace.use(studentOnly);

  // Handle connections
  notificationNamespace.on("connection", (socket) => {
    console.log(
      `Student connected to notifications: ${socket.userId} (Socket: ${socket.id})`
    );

    // Store user-socket mapping
    userSockets.set(socket.userId, socket.id);

    // Send connection success event
    socket.emit("connected", {
      message: "Connected to notification service",
      userId: socket.userId,
    });

    // Send unread count on connection
    notificationService
      .getUnreadCount(socket.userId)
      .then((result) => {
        socket.emit("unread_count", { count: result.unreadCount });
      })
      .catch((error) => {
        console.error("Error fetching unread count:", error);
      });

    // Handle mark as read event
    socket.on("mark_as_read", async (data) => {
      try {
        const { notificationId } = data;

        if (!notificationId) {
          socket.emit("error", { message: "Notification ID is required" });
          return;
        }

        const result = await notificationService.markAsRead(
          notificationId,
          socket.userId
        );

        socket.emit("notification_read", {
          notificationId,
          message: result.message,
        });

        // Send updated unread count
        const countResult = await notificationService.getUnreadCount(
          socket.userId
        );
        socket.emit("unread_count", { count: countResult.unreadCount });
      } catch (error) {
        console.error("Error marking notification as read:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Handle mark all as read event
    socket.on("mark_all_as_read", async () => {
      try {
        const result = await notificationService.markAllAsRead(socket.userId);

        socket.emit("all_notifications_read", {
          message: result.message,
          modifiedCount: result.modifiedCount,
        });

        // Send updated unread count (should be 0)
        socket.emit("unread_count", { count: 0 });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Handle get notifications event
    socket.on("get_notifications", async (data = {}) => {
      try {
        const { page = 1, limit = 20, unreadOnly = false, type = null } = data;

        const result = await notificationService.getNotificationsByStudent(
          socket.userId,
          { page, limit, unreadOnly, type }
        );

        socket.emit("notifications_list", result);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Handle disconnect
    socket.on("disconnect", (reason) => {
      console.log(
        `Student disconnected from notifications: ${socket.userId} (Reason: ${reason})`
      );

      // Remove user-socket mapping
      userSockets.delete(socket.userId);
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  // Handle namespace connection errors
  notificationNamespace.on("connect_error", (error) => {
    console.error("Notification namespace connection error:", error);
  });

  console.log("Notification socket initialized at /notifications namespace");

  return notificationNamespace;
};

export default initializeNotificationSocket;
