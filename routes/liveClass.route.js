import express from 'express';
import {
    createLiveClass,
    getAllLiveClasses,
    getLiveClassById,
    getLiveClassBySlug,
    updateLiveClass,
    deleteLiveClass,
    getLiveClassesByEducator,
    enrollStudentInLiveClass,
    removeStudentFromLiveClass,
    markStudentAttendance,
    getLiveClassStatistics,
    getUpcomingLiveClasses,
    markLiveClassAsCompleted
} from '../controllers/liveClass.controller.js';
import {
    createLiveClassValidation,
    updateLiveClassValidation,
    enrollLiveClassValidation,
    markAttendanceValidation
} from '../util/validation.js';

const router = express.Router();

// Create a new live class
router.post('/', createLiveClassValidation, createLiveClass);

// Get all live classes with filtering and pagination
router.get('/', getAllLiveClasses);

// Get upcoming live classes
router.get('/upcoming', getUpcomingLiveClasses);

// Get live class by slug
router.get('/slug/:slug', getLiveClassBySlug);

// Get live classes by educator
router.get('/educator/:educatorID', getLiveClassesByEducator);

// Get live class by ID
router.get('/:id', getLiveClassById);

// Update live class
router.put('/:id', updateLiveClassValidation, updateLiveClass);

// Delete live class
router.delete('/:id', deleteLiveClass);

// Enroll student in live class
router.post('/:liveClassId/enroll', enrollLiveClassValidation, enrollStudentInLiveClass);

// Remove student from live class
router.delete('/:liveClassId/student/:studentId', removeStudentFromLiveClass);

// Mark student attendance
router.post('/:liveClassId/attendance/:studentId', markAttendanceValidation, markStudentAttendance);

// Get live class statistics
router.get('/:liveClassId/statistics', getLiveClassStatistics);

// Mark live class as completed
router.put('/:liveClassId/completed', markLiveClassAsCompleted);

export default router;
