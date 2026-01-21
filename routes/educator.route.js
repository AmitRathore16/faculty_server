import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
const router = express.Router();

import {
  getAllEducators,
  getEducatorById,
  getEducatorByUsername,
  getEducatorBySlug,
  updateEducator,
  deleteEducator,
  getEducatorsBySpecialization,
  getEducatorsBySubject,
  getEducatorsByClass,
  getEducatorsByRating,
  searchEducators,
  addFollower,
  removeFollower,
  getEducatorFollowers,
  updateEducatorRating,
  updateEducatorRevenue,
  getTopRatedEducators,
  getEducatorStatistics,
  uploadEducatorIntroVideo,
  getEducatorIntroVideoStatus,
  updateEducatorBankDetails, 
} from "../controllers/educator.controller.js";
import { signupEducator as createEducatorProfile } from "../controllers/auth.controller.js";

import {
  validateObjectId,
  validateUsername,
  validateSlug,
  validateFullName,
  validateUsernameField,
  validateEmail,
  validateDescription,
  validateSpecialization,
  validateClass,
  validateMobileNumber,
  validateURL,
  validateVimeoEmbed,
  validatePayPerHourFee,
  validateSubject,
  validateStatus,
  validateStudentId,
  validateRating,
  educatorSignupValidation,
  validateRevenue,
  validateSpecializationParam,
  validateSubjectParam,
  validateClassParam,
  validateRatingParam,
  validateBankDetails,
} from "../util/validation.js";
import { authenticateEducator } from "../middleware/auth.middleware.js";
import { getEducatorPaymentHistory } from "../controllers/payment.controller.js";
import { getEducatorPayouts } from "../controllers/payout.controller.js";

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
    fileSize: 500 * 1024 * 1024,
  },
});

// Validation middleware for updating educator
const updateEducatorValidation = [
  ...validateObjectId(),
  validateFullName(true),
  validateUsernameField(true),
  validateEmail(true),
  validateDescription[0],
  validateSpecialization(true),
  validateClass(true),
  validateMobileNumber(true),
  validateURL("profilePicture"),
  ...validateVimeoEmbed("introVideo"),
  validatePayPerHourFee(true),
  validateSubject(true),
  validateStatus[0],
];

// Validation middleware for follower operations
const followerValidation = [...validateObjectId(), ...validateStudentId];

// Validation middleware for rating
const ratingValidation = [
  ...validateObjectId(),
  ...validateStudentId,
  ...validateRating,
];

// Validation middleware for revenue update
const revenueValidation = [...validateObjectId(), ...validateRevenue];

// Routes

// POST /api/educators - Create educator profile (signup)
router.post("/", educatorSignupValidation, createEducatorProfile);

// GET /api/educators - Get all educators with filtering and pagination
router.get("/", getAllEducators);
router.get("/me/payments", authenticateEducator, getEducatorPaymentHistory);
router.get("/me/payouts", authenticateEducator, getEducatorPayouts);

// GET /api/educators/search - Search educators by name or username
router.get("/search", searchEducators);

// GET /api/educators/top-rated - Get top rated educators
router.get("/top-rated", getTopRatedEducators);

// GET /api/educators/specialization/:specialization - Get educators by specialization
router.get(
  "/specialization/:specialization",
  validateSpecializationParam,
  getEducatorsBySpecialization
);

// GET /api/educators/subject/:subject - Get educators by subject
router.get("/subject/:subject", validateSubjectParam, getEducatorsBySubject);

// GET /api/educators/class/:className - Get educators by class
router.get("/class/:className", validateClassParam, getEducatorsByClass);

// GET /api/educators/rating/:minRating - Get educators by minimum rating
router.get("/rating/:minRating", validateRatingParam, getEducatorsByRating);

// GET /api/educators/username/:username - Get educator by username
router.get("/username/:username", validateUsername, getEducatorByUsername);

// GET /api/educators/slug/:slug - Get educator by slug
router.get("/slug/:slug", validateSlug, getEducatorBySlug);

// GET /api/educators/:id - Get educator by ID
router.get("/:id", validateObjectId(), getEducatorById);

// GET /api/educators/:id/followers - Get educator's followers
router.get("/:id/followers", validateObjectId(), getEducatorFollowers);

// GET /api/educators/:id/statistics - Get educator statistics
router.get("/:id/statistics", validateObjectId(), getEducatorStatistics);

// POST /api/educators/:id/intro-video/upload - Upload intro video to Vimeo
router.post(
  "/:id/intro-video/upload",
  validateObjectId(),
  videoUpload.single("video"),
  uploadEducatorIntroVideo
);

// GET /api/educators/:id/intro-video/status - Poll Vimeo transcode status
router.get(
  "/:id/intro-video/status",
  validateObjectId(),
  getEducatorIntroVideoStatus
);

// POST /api/educators/:id/followers - Add follower to educator
router.post("/:id/followers", followerValidation, addFollower);

// POST /api/educators/:id/rating - Update educator rating
router.post("/:id/rating", ratingValidation, updateEducatorRating);

// POST /api/educators/:id/revenue - Update educator revenue
router.post("/:id/revenue", revenueValidation, updateEducatorRevenue);

// POST /api/educators/:id/bank-details - Update educator bank details & onboarding
router.post(
  "/:id/bank-details",
  [...validateObjectId(), ...validateBankDetails],
  updateEducatorBankDetails
);

// PUT /api/educators/:id - Update educator
router.put("/:id", updateEducatorValidation, updateEducator);

// DELETE /api/educators/:id - Delete educator (soft delete)
router.delete("/:id", validateObjectId(), deleteEducator);

// DELETE /api/educators/:id/followers - Remove follower from educator
router.delete("/:id/followers", followerValidation, removeFollower);

export default router;
