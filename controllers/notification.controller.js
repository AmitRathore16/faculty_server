import notificationService from "../services/notification.service.js";
import { validationResult } from "express-validator";

/**
 * Get all notifications for a student
 * @route GET /api/notifications/:studentId
 */
export const getNotifications = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 20, unreadOnly = false, type } = req.query;

    const result = await notificationService.getNotificationsByStudent(
      studentId,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        unreadOnly: unreadOnly === "true",
        type,
      }
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get unread notification count for a student
 * @route GET /api/notifications/:studentId/unread-count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const { studentId } = req.params;

    const result = await notificationService.getUnreadCount(studentId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Mark a notification as read
 * @route PUT /api/notifications/:id/read
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required",
      });
    }

    const result = await notificationService.markAsRead(id, studentId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error marking notification as read:", error);

    if (error.message === "Notification not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Mark all notifications as read for a student
 * @route PUT /api/notifications/:studentId/read-all
 */
export const markAllAsRead = async (req, res) => {
  try {
    const { studentId } = req.params;

    const result = await notificationService.markAllAsRead(studentId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Delete a notification
 * @route DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required",
      });
    }

    const result = await notificationService.deleteNotification(id, studentId);

    res.status(200).json(result);
  } catch (error) {
    console.error("Error deleting notification:", error);

    if (error.message === "Notification not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Clean up old notifications (admin endpoint)
 * @route POST /api/notifications/cleanup
 */
export const cleanupOldNotifications = async (req, res) => {
  try {
    const result = await notificationService.cleanupOldNotifications();

    res.status(200).json(result);
  } catch (error) {
    console.error("Error cleaning up notifications:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanupOldNotifications,
};
