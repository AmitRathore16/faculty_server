import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanupOldNotifications,
} from "../controllers/notification.controller.js";
import { validateObjectId } from "../util/validation.js";

const router = Router();

/**
 * @route   GET /api/notifications/:studentId
 * @desc    Get all notifications for a student with pagination and filters
 * @access  Private (Student)
 * @param   studentId - Student ObjectId
 * @query   {
 *   page?: number (default: 1),
 *   limit?: number (default: 20),
 *   unreadOnly?: boolean (default: false),
 *   type?: "course" | "webinar" | "post" | "test_series"
 * }
 */
router.get("/:studentId", validateObjectId(), getNotifications);

/**
 * @route   GET /api/notifications/:studentId/unread-count
 * @desc    Get unread notification count for a student
 * @access  Private (Student)
 * @param   studentId - Student ObjectId
 */
router.get("/:studentId/unread-count", validateObjectId(), getUnreadCount);

/**
 * @route   PUT /api/notifications/:studentId/read-all
 * @desc    Mark all notifications as read for a student
 * @access  Private (Student)
 * @param   studentId - Student ObjectId
 */
router.put("/:studentId/read-all", validateObjectId(), markAllAsRead);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a specific notification as read
 * @access  Private (Student)
 * @param   id - Notification ObjectId
 * @body    { studentId: ObjectId }
 */
router.put("/:id/read", validateObjectId(), markAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private (Student)
 * @param   id - Notification ObjectId
 * @body    { studentId: ObjectId }
 */
router.delete("/:id", validateObjectId(), deleteNotification);

/**
 * @route   POST /api/notifications/cleanup
 * @desc    Clean up old read notifications (Admin only - older than 30 days)
 * @access  Private (Admin)
 */
router.post("/cleanup", cleanupOldNotifications);

export default router;
