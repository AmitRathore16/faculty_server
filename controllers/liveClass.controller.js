import { validationResult } from "express-validator";
import LiveClass from "../models/liveClass.js";
import notificationService from "../services/notification.service.js";

// Create a new live class
export const createLiveClass = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((err) => ({
          field: err.param,
          message: err.msg,
        })),
      });
    }

    const {
      educatorID,
      isCourseSpecific,
      assignInCourse,
      liveClassesFee,
      subject,
      liveClassSpecification,
      introVideo,
      classTiming,
      classDuration,
      liveClassTitle,
      class: classArray,
      description,
      maxStudents,
    } = req.body;

    // Create new live class
    const newLiveClass = new LiveClass({
      educatorID,
      isCourseSpecific,
      assignInCourse: isCourseSpecific ? assignInCourse : undefined,
      liveClassesFee,
      subject,
      liveClassSpecification,
      introVideo,
      classTiming,
      classDuration,
      liveClassTitle,
      class: classArray,
      description,
      maxStudents,
    });

    // Generate slug
    newLiveClass.slug = newLiveClass.generateSlug();

    await newLiveClass.save();

    // Send notification to all followers
    try {
      await notificationService.notifyFollowers(educatorID, "live_class", {
        _id: newLiveClass._id,
        title: newLiveClass.liveClassTitle,
        slug: newLiveClass.slug,
        classTiming: newLiveClass.classTiming,
        classDuration: newLiveClass.classDuration,
        description: newLiveClass.description,
        liveClassesFee: newLiveClass.liveClassesFee,
        subject: newLiveClass.subject,
        introVideo: newLiveClass.introVideo,
      });
    } catch (notificationError) {
      console.error("Error sending notifications:", notificationError);
      // Don't fail the request if notification fails
    }

    return res.status(201).json({
      success: true,
      message: "Live class created successfully",
      data: newLiveClass,
    });
  } catch (error) {
    console.error("Error creating live class:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating live class",
      error: error.message,
    });
  }
};

// Get all live classes with pagination and filtering
export const getAllLiveClasses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      subject,
      specification,
      class: classFilter,
      educatorID,
      isCourseSpecific,
      isActive,
      studentId,
      includePast,
      includeCompleted,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    const now = new Date();

    const normalizeSubjectFilter = (value) => {
      if (Array.isArray(value)) {
        return { $in: value.map((entry) => entry.toLowerCase()) };
      }
      return typeof value === "string" ? value.toLowerCase() : value;
    };

    const normalizeSpecificationFilter = (value) => {
      if (Array.isArray(value)) {
        return { $in: value.map((entry) => entry.toUpperCase()) };
      }
      return typeof value === "string" ? value.toUpperCase() : value;
    };

    // Build filter object
    const filter = {};
    if (subject) filter.subject = normalizeSubjectFilter(subject);
    if (specification)
      filter.liveClassSpecification =
        normalizeSpecificationFilter(specification);
    if (classFilter)
      filter.class = {
        $in: Array.isArray(classFilter) ? classFilter : [classFilter],
      };
    if (educatorID) filter.educatorID = educatorID;
    if (isCourseSpecific !== undefined)
      filter.isCourseSpecific = isCourseSpecific === "true";
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    } else {
      filter.isActive = true;
    }
    if (includeCompleted === "true") {
      // allow completed classes when explicitly requested
    } else {
      filter.isCompleted = false;
    }
    if (studentId) filter["enrolledStudents.studentId"] = studentId;

    // Default to upcoming classes only unless includePast is explicitly true
    if (includePast !== "true") {
      filter.classTiming = { $gte: now };
    }

    const totalLiveClasses = await LiveClass.countDocuments(filter);
    const liveClasses = await LiveClass.find(filter)
      .populate("educatorID", "fullName username firstName lastName email")
      .populate("assignInCourse", "name")
      .populate("enrolledStudents.studentId", "name email")
      .sort({ classTiming: 1 })
      .skip(skip)
      .limit(limitNum)
      .exec();

    const totalPages = Math.ceil(totalLiveClasses / limitNum);

    return res.status(200).json({
      success: true,
      message: "Live classes retrieved successfully",
      data: {
        liveClasses,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalLiveClasses,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching live classes:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching live classes",
      error: error.message,
    });
  }
};

// Get live class by ID
export const getLiveClassById = async (req, res) => {
  try {
    const { id } = req.params;

    const liveClass = await LiveClass.findById(id)
      .populate("educatorID", "fullName username firstName lastName email")
      .populate("assignInCourse", "name")
      .populate("enrolledStudents.studentId", "name email");

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Live class retrieved successfully",
      data: liveClass,
    });
  } catch (error) {
    console.error("Error fetching live class:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching live class",
      error: error.message,
    });
  }
};

// Get live class by slug
export const getLiveClassBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const liveClass = await LiveClass.findOne({ slug })
      .populate("educatorID", "fullName username firstName lastName email")
      .populate("assignInCourse", "name")
      .populate("enrolledStudents.studentId", "name email");

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Live class retrieved successfully",
      data: liveClass,
    });
  } catch (error) {
    console.error("Error fetching live class:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching live class",
      error: error.message,
    });
  }
};

// Get live class by liveClassID
export const getLiveClassByLiveClassID = async (req, res) => {
  try {
    const { liveClassID } = req.params;

    const liveClass = await LiveClass.findByLiveClassID(liveClassID)
      .populate("educatorID", "fullName username firstName lastName email")
      .populate("assignInCourse", "name")
      .populate("enrolledStudents.studentId", "name email");

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Live class retrieved successfully",
      data: liveClass,
    });
  } catch (error) {
    console.error("Error fetching live class:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching live class",
      error: error.message,
    });
  }
};

// Update live class
export const updateLiveClass = async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((err) => ({
          field: err.param,
          message: err.msg,
        })),
      });
    }

    const liveClass = await LiveClass.findByIdAndUpdate(
      id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    )
      .populate("educatorID", "fullName username firstName lastName email")
      .populate("assignInCourse", "name")
      .populate("enrolledStudents.studentId", "name email");

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Live class updated successfully",
      data: liveClass,
    });
  } catch (error) {
    console.error("Error updating live class:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating live class",
      error: error.message,
    });
  }
};

// Delete live class
export const deleteLiveClass = async (req, res) => {
  try {
    const { id } = req.params;

    const liveClass = await LiveClass.findByIdAndDelete(id);

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Live class deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting live class:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting live class",
      error: error.message,
    });
  }
};

// Get live classes by educator
export const getLiveClassesByEducator = async (req, res) => {
  try {
    const { educatorID } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const totalLiveClasses = await LiveClass.countDocuments({
      educatorID,
      isActive: true,
    });
    const liveClasses = await LiveClass.find({ educatorID, isActive: true })
      .populate("educatorID", "fullName username firstName lastName email")
      .populate("assignInCourse", "name")
      .populate("enrolledStudents.studentId", "name email")
      .sort({ classTiming: 1 })
      .skip(skip)
      .limit(limitNum)
      .exec();

    return res.status(200).json({
      success: true,
      message: "Educator live classes retrieved successfully",
      data: {
        liveClasses,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalLiveClasses / limitNum),
          totalLiveClasses,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educator live classes:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching educator live classes",
      error: error.message,
    });
  }
};

// Enroll student in live class
export const enrollStudentInLiveClass = async (req, res) => {
  try {
    const { liveClassId } = req.params;
    const { studentId } = req.body;

    const liveClass = await LiveClass.findById(liveClassId);

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    await liveClass.enrollStudent(studentId);

    return res.status(200).json({
      success: true,
      message: "Student enrolled in live class successfully",
      data: liveClass,
    });
  } catch (error) {
    console.error("Error enrolling student:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error enrolling student in live class",
    });
  }
};

// Remove student from live class
export const removeStudentFromLiveClass = async (req, res) => {
  try {
    const { liveClassId, studentId } = req.params;

    const liveClass = await LiveClass.findById(liveClassId);

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    await liveClass.removeStudent(studentId);

    return res.status(200).json({
      success: true,
      message: "Student removed from live class successfully",
      data: liveClass,
    });
  } catch (error) {
    console.error("Error removing student:", error);
    return res.status(500).json({
      success: false,
      message: "Error removing student from live class",
      error: error.message,
    });
  }
};

// Mark student attendance
export const markStudentAttendance = async (req, res) => {
  try {
    const { liveClassId, studentId } = req.params;
    const { attendanceTime } = req.body;

    const liveClass = await LiveClass.findById(liveClassId);

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    await liveClass.markAttendance(studentId, attendanceTime);

    return res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      data: liveClass,
    });
  } catch (error) {
    console.error("Error marking attendance:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Error marking attendance",
    });
  }
};

// Get live class statistics
export const getLiveClassStatistics = async (req, res) => {
  try {
    const { liveClassId } = req.params;

    const liveClass = await LiveClass.findById(liveClassId);

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    const stats = liveClass.getLiveClassStats();

    return res.status(200).json({
      success: true,
      message: "Live class statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching live class statistics",
      error: error.message,
    });
  }
};

// Get upcoming live classes
export const getUpcomingLiveClasses = async (req, res) => {
  try {
    const { page = 1, limit = 10, specification, subject } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      classTiming: { $gt: new Date() },
      isActive: true,
      isCompleted: false,
    };

    const normalizeSubjectFilter = (value) => {
      if (Array.isArray(value)) {
        return { $in: value.map((entry) => entry.toLowerCase()) };
      }
      return typeof value === "string" ? value.toLowerCase() : value;
    };

    const normalizeSpecificationFilter = (value) => {
      if (Array.isArray(value)) {
        return { $in: value.map((entry) => entry.toUpperCase()) };
      }
      return typeof value === "string" ? value.toUpperCase() : value;
    };

    if (specification)
      filter.liveClassSpecification =
        normalizeSpecificationFilter(specification);
    if (subject) filter.subject = normalizeSubjectFilter(subject);

    const totalLiveClasses = await LiveClass.countDocuments(filter);
    const liveClasses = await LiveClass.find(filter)
      .populate("educatorID", "fullName username firstName lastName email")
      .populate("assignInCourse", "name")
      .sort({ classTiming: 1 })
      .skip(skip)
      .limit(limitNum)
      .exec();

    return res.status(200).json({
      success: true,
      message: "Upcoming live classes retrieved successfully",
      data: {
        liveClasses,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalLiveClasses / limitNum),
          totalLiveClasses,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching upcoming live classes:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching upcoming live classes",
      error: error.message,
    });
  }
};

// Mark live class as completed
export const markLiveClassAsCompleted = async (req, res) => {
  try {
    const { liveClassId } = req.params;
    const { recordingURL } = req.body;

    const liveClass = await LiveClass.findByIdAndUpdate(
      liveClassId,
      {
        isCompleted: true,
        recordingURL: recordingURL || undefined,
        updatedAt: Date.now(),
      },
      { new: true }
    );

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: "Live class not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Live class marked as completed successfully",
      data: liveClass,
    });
  } catch (error) {
    console.error("Error marking live class as completed:", error);
    return res.status(500).json({
      success: false,
      message: "Error marking live class as completed",
      error: error.message,
    });
  }
};
