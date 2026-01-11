import express from "express";
const router = express.Router();

import {
  createQuestion,
  getAllQuestions,
  getQuestionById,
  getQuestionBySlug,
  updateQuestion,
  deleteQuestion,
  getQuestionsByEducator,
  getQuestionsBySubject,
  getQuestionsBySpecialization,
  getQuestionsByDifficulty,
  getQuestionsByClass,
  getQuestionsByTopics,
  getQuestionsByTags,
  addQuestionToTest,
  removeQuestionFromTest,
  getQuestionStatistics,
  bulkUploadQuestions,
} from "../controllers/question.controller.js";

import {
  validateObjectId,
  validateSlug,
  validateEducatorIdParam,
  validateSubjectParam,
  validateSpecializationParam,
  validateDifficulty,
  validateClassParam,
  createQuestionValidation,
  updateQuestionValidation,
  testOperationValidation,
} from "../util/validation.js";

import multer from "multer";

const upload = multer();

// Routes

// GET /api/questions - Get all questions with filtering and pagination
router.get("/", getAllQuestions);

// GET /api/questions/statistics - Get question statistics
router.get("/statistics", getQuestionStatistics);

// GET /api/questions/topics - Get questions by topics
router.get("/topics", getQuestionsByTopics);

// GET /api/questions/tags - Get questions by tags
router.get("/tags", getQuestionsByTags);

// GET /api/questions/educator/:educatorId - Get questions by educator
router.get(
  "/educator/:educatorId",
  validateEducatorIdParam,
  getQuestionsByEducator
);

// GET /api/questions/subject/:subject - Get questions by subject
router.get("/subject/:subject", validateSubjectParam, getQuestionsBySubject);

// GET /api/questions/specialization/:specialization - Get questions by specialization
router.get(
  "/specialization/:specialization",
  validateSpecializationParam,
  getQuestionsBySpecialization
);

// GET /api/questions/difficulty/:difficulty - Get questions by difficulty
router.get(
  "/difficulty/:difficulty",
  validateDifficulty,
  getQuestionsByDifficulty
);

// GET /api/questions/class/:className - Get questions by class
router.get("/class/:className", validateClassParam, getQuestionsByClass);

// GET /api/questions/slug/:slug - Get question by slug
router.get("/slug/:slug", validateSlug, getQuestionBySlug);

// GET /api/questions/:id - Get question by ID
router.get("/:id", validateObjectId(), getQuestionById);

// POST /api/questions - Create new question
router.post("/", createQuestionValidation, createQuestion);

// POST /api/questions/bulk-upload - Upload CSV to create questions in bulk
// Form field: file (multipart/form-data)
router.post("/bulk-upload", upload.single("file"), bulkUploadQuestions);

// POST /api/questions/:id/add-to-test - Add question to test
router.post("/:id/add-to-test", testOperationValidation, addQuestionToTest);

// PUT /api/questions/:id - Update question
router.put("/:id", updateQuestionValidation, updateQuestion);

// DELETE /api/questions/:id - Delete question (soft delete)
router.delete("/:id", validateObjectId(), deleteQuestion);

// DELETE /api/questions/:id/remove-from-test - Remove question from test
router.delete(
  "/:id/remove-from-test",
  testOperationValidation,
  removeQuestionFromTest
);

export default router;
