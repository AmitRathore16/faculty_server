import express from "express";
import {
  createTestSeries,
  getAllTestSeries,
  getTestSeriesById,
  getTestSeriesBySlug,
  updateTestSeries,
  updateTestSeriesImage,
  deleteTestSeries,
  getTestSeriesByEducator,
  getTestSeriesBySpecialization,
  getTestSeriesBySubject,
  getTestSeriesByRating,
  searchTestSeriesByTitle,
  getTestSeriesByCourse,
  enrollStudent,
  removeStudent,
  addTest,
  removeTest,
  bulkAddTests,
  bulkRemoveTests,
  updateTestSeriesRating,
  getTestSeriesStatistics,
  getOverallStatistics,
  assignTestSeriesToCourse,
} from "../controllers/testSeries.controller.js";

import { uploadGenericImage } from "../config/cloudinary.js";

import {
  createTestSeriesValidation,
  updateTestSeriesValidation,
  enrollStudentInTestSeriesValidation,
  testSeriesTestOperationValidation,
  bulkTestSeriesTestOperationValidation,
  rateTestSeriesValidation,
  validateObjectId,
  validateSlug,
  validateEducatorIdParam,
  validateSpecializationParam,
  validateSubjectParam,
  validateRatingParam,
  validateCourseIdParam,
} from "../util/validation.js";

const router = express.Router();

// ==================== CRUD Routes ====================

// Create a new test series
router.post("/", createTestSeriesValidation, createTestSeries);

// Get all test series with filters
router.get("/", getAllTestSeries);

// Get test series by slug (placed before :id to avoid route shadowing)
router.get("/slug/:slug", validateSlug, getTestSeriesBySlug);

// Get test series by ID
router.get("/:id", validateObjectId("id"), getTestSeriesById);

// Update test series by ID
router.put("/:id", updateTestSeriesValidation, updateTestSeries);

// Update test series banner image
router.put(
  "/:id/image",
  validateObjectId("id"),
  uploadGenericImage.single("image"),
  updateTestSeriesImage
);

// Delete test series by ID (soft delete)
router.delete("/:id", validateObjectId("id"), deleteTestSeries);

// Assign test series to course
router.put(
  "/:id/assign-course",
  validateObjectId("id"),
  assignTestSeriesToCourse
);

// ==================== Filter Routes ====================

// Search test series by title
router.get("/search/title", searchTestSeriesByTitle);

// Get test series by educator
router.get(
  "/educator/:educatorId",
  validateEducatorIdParam,
  getTestSeriesByEducator
);

// Get test series by specialization
router.get(
  "/specialization/:specialization",
  validateSpecializationParam,
  getTestSeriesBySpecialization
);

// Get test series by subject
router.get("/subject/:subject", validateSubjectParam, getTestSeriesBySubject);

// Get test series by rating
router.get("/rating/:minRating", validateRatingParam, getTestSeriesByRating);

// Get test series by course
router.get("/course/:courseId", validateCourseIdParam, getTestSeriesByCourse);

// ==================== Enrollment Routes ====================

// Enroll student in test series
router.post("/:id/enroll", enrollStudentInTestSeriesValidation, enrollStudent);

// Remove student from test series
router.delete(
  "/:id/enroll",
  enrollStudentInTestSeriesValidation,
  removeStudent
);

// ==================== Test Management Routes ====================

// Add test to test series
router.post("/:id/tests", testSeriesTestOperationValidation, addTest);

// Remove test from test series
router.delete("/:id/tests", testSeriesTestOperationValidation, removeTest);

// Bulk add tests to test series
router.post(
  "/:id/tests/bulk",
  bulkTestSeriesTestOperationValidation,
  bulkAddTests
);

// Bulk remove tests from test series
router.delete(
  "/:id/tests/bulk",
  bulkTestSeriesTestOperationValidation,
  bulkRemoveTests
);

// ==================== Rating Routes ====================

// Update test series rating
router.post("/:id/rating", rateTestSeriesValidation, updateTestSeriesRating);

// ==================== Statistics Routes ====================

// Get test series statistics
router.get("/:id/statistics", validateObjectId("id"), getTestSeriesStatistics);

// Get overall platform statistics
router.get("/statistics/overall", getOverallStatistics);

export default router;
