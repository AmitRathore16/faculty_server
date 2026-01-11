import express from "express";
import {
  loginEducator,
  loginStudent,
  logoutEducator,
  refreshEducatorToken,
  signupEducator,
  signupStudent,
  getCurrentEducatorProfile,
  requestPasswordReset,
  resetPassword,
  adminLogin,
  adminSignup,
  logoutAdmin,
  getCurrentAdminProfile,
} from "../controllers/auth.controller.js";
import {
  educatorLoginValidation,
  educatorSignupValidation,
  studentLoginValidation,
  studentSignupValidation,
  validateRefreshTokenBody,
  passwordResetRequestValidation,
  passwordResetConfirmValidation,
} from "../util/validation.js";
import {
  authenticateEducator,
  authenticateAdmin,
} from "../middleware/auth.middleware.js";
import { body } from "express-validator";

const router = express.Router();

// Admin validation
const adminAuthValidation = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];

const adminSignupValidation = [
  ...adminAuthValidation,
  body("username")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-z0-9_]+$/)
    .withMessage(
      "Username can only contain lowercase letters, numbers, and underscores"
    ),
  body("fullName")
    .isLength({ min: 3, max: 100 })
    .withMessage("Full name must be between 3 and 100 characters"),
];

// Educator routes
router.post("/ed-signup", educatorSignupValidation, signupEducator);
router.post("/ed-login", educatorLoginValidation, loginEducator);
router.post("/ed-refresh", validateRefreshTokenBody, refreshEducatorToken);
router.post("/ed-logout", validateRefreshTokenBody, logoutEducator);

// Student routes
router.post("/signup-student", studentSignupValidation, signupStudent);
router.post("/login-student", studentLoginValidation, loginStudent);
router.post(
  "/forgot-password",
  passwordResetRequestValidation,
  requestPasswordReset
);
router.post("/reset-password", passwordResetConfirmValidation, resetPassword);

// Admin routes
router.post("/admin-signup", adminSignupValidation, adminSignup);
router.post("/admin-login", adminAuthValidation, adminLogin);
router.post("/admin-logout", validateRefreshTokenBody, logoutAdmin);
router.get("/admin/me", authenticateAdmin, getCurrentAdminProfile);

// Profile routes
router.get("/educator/me", authenticateEducator, getCurrentEducatorProfile);

export default router;
