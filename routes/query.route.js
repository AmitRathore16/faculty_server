import express from "express";
import {
  createQuery,
  getEducatorQueries,
  getStudentQueries,
  getQueryById,
  replyToQuery,
  updateReply,
  resolveQuery,
  deleteQuery,
} from "../controllers/query.controller.js";
import {
  authenticateEducator,
  authenticateStudent,
} from "../middleware/auth.middleware.js";
import { body, param, query } from "express-validator";

const router = express.Router();

// Validation for creating query
const createQueryValidation = [
  body("studentId").isMongoId().withMessage("Invalid student ID"),
  body("educatorId").isMongoId().withMessage("Invalid educator ID"),
  body("subject")
    .notEmpty()
    .withMessage("Subject is required")
    .isLength({ max: 200 })
    .withMessage("Subject cannot exceed 200 characters")
    .trim(),
  body("initialMessage")
    .notEmpty()
    .withMessage("Initial message is required")
    .isLength({ max: 1000 })
    .withMessage("Initial message cannot exceed 1000 characters")
    .trim(),
];

// Validation for reply
const replyValidation = [
  param("id").isMongoId().withMessage("Invalid query ID"),
  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ max: 5000 })
    .withMessage("Message cannot exceed 5000 characters")
    .trim(),
];

// Validation for update reply
const updateReplyValidation = [
  param("messageId").isMongoId().withMessage("Invalid message ID"),
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ max: 5000 })
    .withMessage("Content cannot exceed 5000 characters")
    .trim(),
];

// Validation for query filters
const queryFiltersValidation = [
  query("status")
    .optional()
    .isIn(["pending", "replied", "resolved"])
    .withMessage("Invalid status"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

/**
 * @route   POST /api/queries
 * @desc    Create a new query (Student)
 * @access  Private (Student)
 * @body    {
 *   studentId: ObjectId,
 *   educatorId: ObjectId,
 *   subject: string (max 200),
 *   initialMessage: string (max 1000),
 *   metadata?: { courseId?, webinarId?, courseName?, webinarName? }
 * }
 */
router.post("/", authenticateStudent, createQueryValidation, createQuery);

/**
 * @route   GET /api/queries/educator/:educatorId
 * @desc    Get all queries for an educator
 * @access  Private (Educator)
 * @query   {
 *   status?: "pending" | "replied" | "resolved",
 *   search?: string,
 *   page?: number (default: 1),
 *   limit?: number (default: 20, max: 100)
 * }
 */
router.get(
  "/educator/:educatorId",
  authenticateEducator,
  [
    param("educatorId").isMongoId().withMessage("Invalid educator ID"),
    ...queryFiltersValidation,
  ],
  getEducatorQueries
);

/**
 * @route   GET /api/queries/student/:studentId
 * @desc    Get all queries for a student
 * @access  Private (Student)
 * @query   {
 *   status?: "pending" | "replied" | "resolved",
 *   page?: number (default: 1),
 *   limit?: number (default: 20, max: 100)
 * }
 */
router.get(
  "/student/:studentId",
  authenticateStudent,
  [
    param("studentId").isMongoId().withMessage("Invalid student ID"),
    ...queryFiltersValidation,
  ],
  getStudentQueries
);

/**
 * @route   GET /api/queries/:id
 * @desc    Get query by ID with messages
 * @access  Private (Student or Educator)
 * @param   id - Query ObjectId
 */
router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid query ID")],
  getQueryById
);

/**
 * @route   POST /api/queries/:id/reply
 * @desc    Reply to a query (Educator)
 * @access  Private (Educator)
 * @param   id - Query ObjectId
 * @body    { message: string (max 5000) }
 */
router.post("/:id/reply", authenticateEducator, replyValidation, replyToQuery);

/**
 * @route   PUT /api/queries/messages/:messageId
 * @desc    Update/edit a reply message
 * @access  Private (Educator)
 * @param   messageId - Message ObjectId
 * @body    { content: string (max 5000) }
 */
router.put(
  "/messages/:messageId",
  authenticateEducator,
  updateReplyValidation,
  updateReply
);

/**
 * @route   PUT /api/queries/:id/resolve
 * @desc    Mark query as resolved
 * @access  Private (Educator)
 * @param   id - Query ObjectId
 */
router.put(
  "/:id/resolve",
  authenticateEducator,
  [param("id").isMongoId().withMessage("Invalid query ID")],
  resolveQuery
);

/**
 * @route   DELETE /api/queries/:id
 * @desc    Delete query (soft delete)
 * @access  Private (Student or Educator)
 * @param   id - Query ObjectId
 */
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid query ID")],
  deleteQuery
);

export default router;
