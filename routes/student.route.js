import { Router } from "express";
import {
  createStudent,
  getAllStudents,
  getStudentById,
  getStudentByUsername,
  updateStudent,
  deleteStudent,
  enrollInCourse,
  followEducator,
  unfollowEducator,
  registerForWebinar,
  getStudentStatistics,
  getStudentsBySpecialization,
  getStudentsByClass,
  getStudentNotifications,
  getEducatorEnrolledStudents,
  updatePassword,
} from "../controllers/student.controller.js";

import {
  createStudentValidation,
  updateStudentValidation,
  studentQueryValidation,
  studentUsernameValidation,
  studentSpecializationValidation,
  studentClassValidation,
  studentPasswordValidation,
  studentEnrollmentValidation,
  studentFollowValidation,
  studentWebinarValidation,
  validateId,
  validateEducatorIdParam,
} from "../util/validation.js";

const router = Router();

router.post("/", createStudentValidation, createStudent);

router.get("/", studentQueryValidation, getAllStudents);

/**
 * @route   GET /api/students/:id
 * @desc    Get student by ID
 * @access  Public
 * @param   id - Student ObjectId
 */

router.get(
  "/username/:username",
  studentUsernameValidation,
  getStudentByUsername
);

router.put("/:id", updateStudentValidation, updateStudent);

router.delete("/:id", validateId, deleteStudent);

// ======================= Student Course Management Routes =======================

router.post("/:id/enroll", studentEnrollmentValidation, enrollInCourse);

// ======================= Student Educator Management Routes =======================

router.post("/:id/follow", studentFollowValidation, followEducator);

router.delete("/:id/unfollow", studentFollowValidation, unfollowEducator);

// ======================= Student Webinar Management Routes =======================

router.post(
  "/:id/register-webinar",
  studentWebinarValidation,
  registerForWebinar
);

// ======================= Student Statistics and Analytics Routes =======================

router.get("/:id/statistics", validateId, getStudentStatistics);

router.get("/:id/notifications", validateId, getStudentNotifications);

// ======================= Specialization and Class Specific Routes =======================

router.get(
  "/specialization/:specialization",
  [studentSpecializationValidation, studentQueryValidation],
  getStudentsBySpecialization
);

router.get(
  "/class/:className",
  [studentClassValidation, studentQueryValidation],
  getStudentsByClass
);
router.get("/:id", validateId, getStudentById);

// ======================= Password Management Routes =======================

router.put("/:id/password", studentPasswordValidation, updatePassword);

export default router;
