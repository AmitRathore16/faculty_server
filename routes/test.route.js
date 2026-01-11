import { Router } from "express";
import {
  createTest,
  getAllTests,
  getTestById,
  getTestBySlug,
  getTestsByEducator,
  getTestsByTestSeries,
  updateTest,
  deleteTest,
  addQuestionToTest,
  removeQuestionFromTest,
  getTestQuestions,
  getTestStatistics,
  getFilteredTests
} from "../controllers/test.controller.js";

import {
  createTestValidation,
  updateTestValidation,
  testQuestionManagementValidation,
  testQueryValidation,
  testEducatorValidation,
  testSeriesValidation,
  testSlugValidation,
  validateId
} from "../util/validation.js";

const router = Router();

// ======================== Test CRUD Routes ========================

/**
 * @route   POST /api/tests
 * @desc    Create a new test
 * @access  Private (Educator)
 * @body    {
 *   title: string (required),
 *   description: string (required),
 *   image?: string (optional),
 *   subjects: Array<string> (required),
 *   class: Array<string> (required),
 *   specialization: Array<string> (required),
 *   duration: number (required, in minutes),
 *   overallMarks: number (required),
 *   markingType: "overall" | "per_question" (required),
 *   educatorID: ObjectId (required),
 *   isTestSeriesSpecific?: boolean (optional, default: false),
 *   testSeriesID?: ObjectId (optional, required if isTestSeriesSpecific is true),
 *   instructions?: string (optional),
 *   passingMarks?: number (optional),
 *   negativeMarking?: boolean (optional, default: false),
 *   negativeMarkingRatio?: number (optional, 0-1),
 *   shuffleQuestions?: boolean (optional, default: false),
 *   showResult?: boolean (optional, default: true),
 *   allowReview?: boolean (optional, default: true)
 * }
 */
router.post("/", createTestValidation, createTest);

/**
 * @route   GET /api/tests
 * @desc    Get all tests with optional filtering and pagination
 * @access  Public
 * @query   {
 *   page?: number (optional, default: 1),
 *   limit?: number (optional, default: 10, max: 100),
 *   subjects?: string | Array<string> (optional),
 *   class?: string | Array<string> (optional),
 *   specialization?: string | Array<string> (optional),
 *   markingType?: "overall" | "per_question" (optional),
 *   minDuration?: number (optional),
 *   maxDuration?: number (optional),
 *   minMarks?: number (optional),
 *   maxMarks?: number (optional),
 *   educatorID?: ObjectId (optional),
 *   testSeriesID?: ObjectId (optional),
 *   isTestSeriesSpecific?: "true" | "false" (optional),
 *   search?: string (optional, searches in title and description)
 * }
 */
router.get("/", testQueryValidation, getAllTests);

/**
 * @route   GET /api/tests/filtered
 * @desc    Get filtered tests with advanced search options
 * @access  Public
 * @query   Same as GET /api/tests but with additional filtering logic
 */
router.get("/filtered", testQueryValidation, getFilteredTests);

/**
 * @route   GET /api/tests/:id
 * @desc    Get test by ID
 * @access  Public
 * @param   id - Test ObjectId
 */
router.get("/:id", validateId, getTestById);

/**
 * @route   GET /api/tests/slug/:slug
 * @desc    Get test by slug
 * @access  Public
 * @param   slug - Test slug (URL-friendly identifier)
 */
router.get("/slug/:slug", testSlugValidation, getTestBySlug);

/**
 * @route   PUT /api/tests/:id
 * @desc    Update test by ID
 * @access  Private (Educator - only test creator)
 * @param   id - Test ObjectId
 * @body    Partial test data (any field from create test except educatorID)
 */
router.put("/:id", updateTestValidation, updateTest);

/**
 * @route   DELETE /api/tests/:id
 * @desc    Delete test by ID
 * @access  Private (Educator - only test creator)
 * @param   id - Test ObjectId
 */
router.delete("/:id", validateId, deleteTest);

// ======================= Test Question Management Routes =======================

/**
 * @route   POST /api/tests/:id/questions
 * @desc    Add a question to a test
 * @access  Private (Educator - only test creator)
 * @param   id - Test ObjectId
 * @body    {
 *   questionId: ObjectId (required) - ID of the question to add
 * }
 */
router.post("/:id/questions", testQuestionManagementValidation, addQuestionToTest);

/**
 * @route   DELETE /api/tests/:id/questions
 * @desc    Remove a question from a test
 * @access  Private (Educator - only test creator)
 * @param   id - Test ObjectId
 * @body    {
 *   questionId: ObjectId (required) - ID of the question to remove
 * }
 */
router.delete("/:id/questions", testQuestionManagementValidation, removeQuestionFromTest);

/**
 * @route   GET /api/tests/:id/questions
 * @desc    Get all questions in a test
 * @access  Public
 * @param   id - Test ObjectId
 * @query   {
 *   page?: number (optional, default: 1),
 *   limit?: number (optional, default: 20)
 * }
 */
router.get("/:id/questions", [validateId, testQueryValidation], getTestQuestions);

// ======================= Test Statistics and Analytics Routes =======================

/**
 * @route   GET /api/tests/:id/statistics
 * @desc    Get test statistics (question count, difficulty distribution, etc.)
 * @access  Public
 * @param   id - Test ObjectId
 */
router.get("/:id/statistics", validateId, getTestStatistics);

// ======================= Educator-Specific Routes =======================

/**
 * @route   GET /api/tests/educator/:educatorId
 * @desc    Get all tests created by a specific educator
 * @access  Public
 * @param   educatorId - Educator ObjectId
 * @query   {
 *   page?: number (optional, default: 1),
 *   limit?: number (optional, default: 10),
 *   subjects?: string | Array<string> (optional),
 *   class?: string | Array<string> (optional),
 *   specialization?: string | Array<string> (optional),
 *   markingType?: "overall" | "per_question" (optional),
 *   isTestSeriesSpecific?: "true" | "false" (optional),
 *   search?: string (optional)
 * }
 */
router.get("/educator/:educatorId", [testEducatorValidation, testQueryValidation], getTestsByEducator);

// ======================= Test Series-Specific Routes =======================

/**
 * @route   GET /api/tests/test-series/:testSeriesId
 * @desc    Get all tests belonging to a specific test series
 * @access  Public
 * @param   testSeriesId - Test Series ObjectId
 * @query   {
 *   page?: number (optional, default: 1),
 *   limit?: number (optional, default: 10),
 *   subjects?: string | Array<string> (optional),
 *   class?: string | Array<string> (optional),
 *   specialization?: string | Array<string> (optional),
 *   search?: string (optional)
 * }
 */
router.get("/test-series/:testSeriesId", [testSeriesValidation, testQueryValidation], getTestsByTestSeries);

export default router;
