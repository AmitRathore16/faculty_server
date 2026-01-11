import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  createCourse,
  getAllCourses,
  getCourseById,
  getCourseBySlug,
  updateCourse,
  deleteCourse,
  getCourseIntroVideoStatus,
  uploadCourseIntroVideo,
  getCoursesByEducator,
  getCoursesBySpecialization,
  getCoursesBySubject,
  getCoursesByClass,
  getCoursesByRating,
  getCoursesByDateRange,
  getOngoingCourses,
  getUpcomingCourses,
  enrollStudent,
  addPurchase,
  addLiveClass,
  removeLiveClass,
  addTestSeries,
  removeTestSeries,
  updateCourseRating,
  addVideo,
  removeVideo,
  addStudyMaterial,
  removeStudyMaterial,
  getCourseStatistics,
  getOverallStatistics,
} from "../controllers/course.controller.js";

import {
  createCourseValidation,
  updateCourseValidation,
  enrollStudentValidation,
  addPurchaseValidation,
  liveClassOperationValidation,
  testSeriesOperationValidation,
  addVideoValidation,
  removeVideoValidation,
  addStudyMaterialValidation,
  removeStudyMaterialValidation,
  dateRangeValidation,
  validateObjectId,
  validateSlug,
  validateEducatorIdParam,
  validateSpecializationParam,
  validateSubjectParam,
  validateClassParam,
  validateRatingParam,
  validateRating,
} from "../util/validation.js";

const ensureUploadDir = () => {
  const uploadDir = path.join(process.cwd(), "tmp", "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
};

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, ensureUploadDir());
      } catch (error) {
        cb(error, "");
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file?.originalname || "");
      cb(null, `${Date.now()}-${file.fieldname}${ext}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB cap for intro videos
  },
});

const router = express.Router();

// ==================== CRUD Routes ====================

// Create a new course
router.post("/", createCourseValidation, createCourse);

// Get all courses with filters
router.get("/", getAllCourses);

// Get course by slug (place before ID route so it doesn't get captured by :id)
router.get("/slug/:slug", validateSlug, getCourseBySlug);

// Get course by ID
router.get("/:id", validateObjectId("id"), getCourseById);

// Update course by ID
router.put("/:id", updateCourseValidation, updateCourse);

// Delete course by ID (soft delete)
router.delete("/:id", validateObjectId("id"), deleteCourse);

// ==================== Intro Video (Vimeo) ====================

router.post(
  "/:id/intro-video/upload",
  validateObjectId("id"),
  videoUpload.single("video"),
  uploadCourseIntroVideo
);

router.get(
  "/:id/intro-video/status",
  validateObjectId("id"),
  getCourseIntroVideoStatus
);

// ==================== Filter Routes ====================

// Get courses by educator
router.get(
  "/educator/:educatorId",
  validateEducatorIdParam,
  getCoursesByEducator
);

// Get courses by specialization
router.get(
  "/specialization/:specialization",
  validateSpecializationParam,
  getCoursesBySpecialization
);

// Get courses by subject
router.get("/subject/:subject", validateSubjectParam, getCoursesBySubject);

// Get courses by class
router.get("/class/:className", validateClassParam, getCoursesByClass);

// Get courses by rating
router.get("/rating/:minRating", validateRatingParam, getCoursesByRating);

// Get courses by date range
router.get("/date-range", dateRangeValidation, getCoursesByDateRange);

// Get ongoing courses
router.get("/status/ongoing", getOngoingCourses);

// Get upcoming courses
router.get("/status/upcoming", getUpcomingCourses);

// ==================== Enrollment Routes ====================

// Enroll student in course
router.post("/:id/enroll", enrollStudentValidation, enrollStudent);

// Add student to purchase list
router.post("/:id/purchase", addPurchaseValidation, addPurchase);

// ==================== Live Class Routes ====================

// Add live class to course
router.post("/:id/live-class", liveClassOperationValidation, addLiveClass);

// Remove live class from course
router.delete("/:id/live-class", liveClassOperationValidation, removeLiveClass);

// ==================== Test Series Routes ====================

// Add test series to course
router.post("/:id/test-series", testSeriesOperationValidation, addTestSeries);

// Remove test series from course
router.delete(
  "/:id/test-series",
  testSeriesOperationValidation,
  removeTestSeries
);

// ==================== Rating Routes ====================

// Update course rating
router.post(
  "/:id/rating",
  validateObjectId("id"),
  validateRating,
  updateCourseRating
);

// ==================== Video Routes ====================

// Add video to course
router.post("/:id/videos", addVideoValidation, addVideo);

// Remove video from course
router.delete("/:id/videos/:videoId", removeVideoValidation, removeVideo);

// ==================== Study Material Routes ====================

// Add study material to course
router.post(
  "/:id/study-materials",
  addStudyMaterialValidation,
  addStudyMaterial
);

// Remove study material from course
router.delete(
  "/:id/study-materials/:materialId",
  removeStudyMaterialValidation,
  removeStudyMaterial
);

// ==================== Statistics Routes ====================

// Get course statistics
router.get("/:id/statistics", validateObjectId("id"), getCourseStatistics);

// Get overall platform statistics
router.get("/statistics/overall", getOverallStatistics);

export default router;
