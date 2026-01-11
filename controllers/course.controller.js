import fs from "fs/promises";
import { validationResult } from "express-validator";
import Course from "../models/course.js";
import notificationService from "../services/notification.service.js";
import { getVimeoStatus, uploadVideoAndResolve } from "../util/vimeo.js";

// ==================== CRUD Operations ====================

// Create a new course
export const createCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      courseType,
      educatorID,
      specialization,
      class: classArray,
      subject,
      fees,
      discount,
      image,
      courseThumbnail,
      startDate,
      endDate,
      courseDuration,
      validDate,
      videos,
      introVideo,
      studyMaterials,
      courseObjectives,
      prerequisites,
      language,
      certificateAvailable,
      maxStudents,
    } = req.body;

    // Check if course with same title exists for this educator
    const existingCourse = await Course.findOne({
      title,
      educatorID,
      isActive: true,
    });

    if (existingCourse) {
      return res.status(400).json({
        message: "A course with this title already exists for this educator",
      });
    }

    // Validate date logic
    const start = new Date(startDate);
    const end = new Date(endDate);
    const valid = new Date(validDate);

    if (start >= end) {
      return res.status(400).json({
        message: "End date must be after start date",
      });
    }

    if (valid < end) {
      return res.status(400).json({
        message: "Valid date must be after or equal to end date",
      });
    }

    const course = new Course({
      title,
      description,
      courseType,
      educatorID,
      specialization,
      class: classArray,
      subject,
      fees,
      discount: discount || 0,
      image,
      courseThumbnail,
      startDate,
      endDate,
      courseDuration,
      validDate,
      videos: videos || [],
      introVideo,
      studyMaterials: studyMaterials || [],
      courseObjectives: courseObjectives || [],
      prerequisites: prerequisites || [],
      language: language || "English",
      certificateAvailable: certificateAvailable || false,
      maxStudents: maxStudents || 100,
    });

    // Generate slug
    course.slug = course.generateSlug();

    await course.save();

    // Notify all followers of the educator
    try {
      await notificationService.notifyFollowers(educatorID, "course", {
        _id: course._id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        image: course.image,
        courseThumbnail: course.courseThumbnail,
        fees: course.fees,
        courseType: course.courseType,
        startDate: course.startDate,
        validDate: course.validDate,
      });
    } catch (notificationError) {
      console.error("Error sending notifications:", notificationError);
      // Don't fail the course creation if notification fails
    }

    res.status(201).json({
      message: "Course created successfully",
      course,
    });
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const uploadCourseIntroVideo = async (req, res) => {
  const cleanup = async () => {
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (_) {
        // ignore cleanup errors
      }
    }
  };

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Video file is required",
      });
    }

    const { id } = req.params;
    const course = await Course.findById(id).select(
      "title description introVideo introVideoVimeoUri"
    );

    if (!course) {
      await cleanup();
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const meta = {
      name: `${course.title} | Intro`,
      description: course.description || undefined,
    };

    const result = await uploadVideoAndResolve(req.file.path, meta);

    course.introVideoVimeoUri = result.uri;
    course.introVideo = result.embedUrl || result.link || course.introVideo;
    await course.save();

    res.status(200).json({
      success: true,
      message: "Intro video uploaded to Vimeo",
      data: {
        introVideo: course.introVideo,
        vimeoUri: course.introVideoVimeoUri,
        status: result.status,
        link: result.link,
        embedUrl: result.embedUrl,
      },
    });
  } catch (error) {
    console.error("Error uploading course intro video:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload intro video",
      error: error.message,
    });
  } finally {
    await cleanup();
  }
};

export const getCourseIntroVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id).select(
      "title introVideo introVideoVimeoUri"
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (!course.introVideoVimeoUri) {
      return res.status(400).json({
        success: false,
        message: "No Vimeo intro video found for this course",
      });
    }

    const statusInfo = await getVimeoStatus(course.introVideoVimeoUri);

    if (statusInfo.embedUrl && statusInfo.embedUrl !== course.introVideo) {
      course.introVideo = statusInfo.embedUrl;
      await course.save();
    }

    res.status(200).json({
      success: true,
      data: {
        status: statusInfo.status,
        introVideo: course.introVideo,
        vimeoUri: course.introVideoVimeoUri,
        link: statusInfo.link,
        embedUrl: statusInfo.embedUrl,
      },
    });
  } catch (error) {
    console.error("Error fetching course intro video status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch intro video status",
      error: error.message,
    });
  }
};

// Get all courses with filters and pagination
export const getAllCourses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      specialization,
      subject,
      class: className,
      minRating,
      maxFees,
      courseType,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      status, // ongoing, upcoming, completed
      includePast,
    } = req.query;

    const query = { isActive: true, status: { $ne: "deleted" } };
    const now = new Date();

    // By default, show only ongoing or upcoming courses
    if (!status && includePast !== "true") {
      query.$or = [
        { startDate: { $gt: now } },
        { startDate: { $lte: now }, endDate: { $gte: now } },
      ];
    }

    // Apply filters
    if (specialization) {
      query.specialization = {
        $in: Array.isArray(specialization) ? specialization : [specialization],
      };
    }

    if (subject) {
      query.subject = {
        $in: Array.isArray(subject) ? subject : [subject],
      };
    }

    if (className) {
      query.class = {
        $in: Array.isArray(className) ? className : [className],
      };
    }

    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    if (maxFees) {
      query.fees = { $lte: parseFloat(maxFees) };
    }

    if (courseType) {
      query.courseType = courseType;
    }

    // Status filter
    if (status === "ongoing") {
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
    } else if (status === "upcoming") {
      query.startDate = { $gt: now };
    } else if (status === "completed") {
      query.endDate = { $lt: now };
    }

    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const courses = await Course.find(query)
      .populate("educatorID", "fullName username email profilePicture")
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Course.countDocuments(query);

    res.status(200).json({
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCourses: total,
        coursesPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get course by ID
export const getCourseById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    })
      .populate(
        "educatorID",
        "fullName username email profilePicture specialization"
      )
      .populate("enrolledStudents", "fullName email")
      .populate("purchase", "fullName email")
      .populate("liveClass", "title timing duration")
      .populate("testSeries", "title description");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({ course });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get course by slug
export const getCourseBySlug = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { slug } = req.params;

    const course = await Course.findOne({
      slug,
      isActive: true,
      status: { $ne: "deleted" },
    })
      .populate(
        "educatorID",
        "fullName username email profilePicture specialization"
      )
      .populate("enrolledStudents", "fullName email")
      .populate("liveClass", "title timing duration")
      .populate("testSeries", "title description");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({ course });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update course
export const updateCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Validate date logic if dates are being updated
    if (updateData.startDate || updateData.endDate || updateData.validDate) {
      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      const start = new Date(updateData.startDate || course.startDate);
      const end = new Date(updateData.endDate || course.endDate);
      const valid = new Date(updateData.validDate || course.validDate);

      if (start >= end) {
        return res.status(400).json({
          message: "End date must be after start date",
        });
      }

      if (valid < end) {
        return res.status(400).json({
          message: "Valid date must be after or equal to end date",
        });
      }
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.purchase;
    delete updateData.enrolledStudents;
    delete updateData.liveClass;
    delete updateData.testSeries;
    delete updateData.rating;
    delete updateData.ratingCount;

    const course = await Course.findOneAndUpdate(
      { _id: id, isActive: true, status: { $ne: "deleted" } },
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate("educatorID", "fullName username email");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({
      message: "Course updated successfully",
      course,
    });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete course (soft delete)
export const deleteCourse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    // Hard-delete the course document so it is fully removed from the database
    const course = await Course.findOne({ _id: id });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    await course.deleteOne();

    res.status(200).json({
      message: "Course deleted successfully",
      courseId: id,
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ==================== Additional Controllers ====================

// Get courses by educator
export const getCoursesByEducator = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { educatorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.findByEducator(educatorId)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Course.countDocuments({
      educatorID: educatorId,
      isActive: true,
      status: { $ne: "deleted" },
    });

    res.status(200).json({
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCourses: total,
      },
    });
  } catch (error) {
    console.error("Error fetching courses by educator:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get courses by specialization
export const getCoursesBySpecialization = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { specialization } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.findBySpecialization(specialization)
      .populate("educatorID", "fullName username")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ rating: -1 });

    const total = await Course.countDocuments({
      specialization: specialization,
      isActive: true,
      status: { $ne: "deleted" },
    });

    res.status(200).json({
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCourses: total,
      },
    });
  } catch (error) {
    console.error("Error fetching courses by specialization:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get courses by subject
export const getCoursesBySubject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subject } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.findBySubject(subject)
      .populate("educatorID", "fullName username")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ rating: -1 });

    const total = await Course.countDocuments({
      subject: subject,
      isActive: true,
      status: { $ne: "deleted" },
    });

    res.status(200).json({
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCourses: total,
      },
    });
  } catch (error) {
    console.error("Error fetching courses by subject:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get courses by class
export const getCoursesByClass = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { className } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.findByClass(className)
      .populate("educatorID", "fullName username")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ rating: -1 });

    const total = await Course.countDocuments({
      class: className,
      isActive: true,
      status: { $ne: "deleted" },
    });

    res.status(200).json({
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCourses: total,
      },
    });
  } catch (error) {
    console.error("Error fetching courses by class:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get courses by rating
export const getCoursesByRating = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { minRating } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.findByMinRating(parseFloat(minRating))
      .populate("educatorID", "fullName username")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ rating: -1 });

    const total = await Course.countDocuments({
      rating: { $gte: parseFloat(minRating) },
      isActive: true,
      status: { $ne: "deleted" },
    });

    res.status(200).json({
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCourses: total,
      },
    });
  } catch (error) {
    console.error("Error fetching courses by rating:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get courses by date range
export const getCoursesByDateRange = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate } = req.query;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.findByDateRange(
      new Date(startDate),
      new Date(endDate)
    )
      .populate("educatorID", "fullName username")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ startDate: 1 });

    const total = await Course.countDocuments({
      startDate: { $gte: new Date(startDate) },
      endDate: { $lte: new Date(endDate) },
      isActive: true,
      status: { $ne: "deleted" },
    });

    res.status(200).json({
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCourses: total,
      },
    });
  } catch (error) {
    console.error("Error fetching courses by date range:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get ongoing courses
export const getOngoingCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.findOngoing()
      .populate("educatorID", "fullName username")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ rating: -1 });

    const now = new Date();
    const total = await Course.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
      status: { $ne: "deleted" },
    });

    res.status(200).json({
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCourses: total,
      },
    });
  } catch (error) {
    console.error("Error fetching ongoing courses:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get upcoming courses
export const getUpcomingCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const courses = await Course.findUpcoming()
      .populate("educatorID", "fullName username")
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Course.countDocuments({
      startDate: { $gt: new Date() },
      isActive: true,
      status: { $ne: "deleted" },
    });

    res.status(200).json({
      courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCourses: total,
      },
    });
  } catch (error) {
    console.error("Error fetching upcoming courses:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Enroll student in course
export const enrollStudent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { studentId } = req.body;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if course is full
    if (course.isFull) {
      return res.status(400).json({ message: "Course is full" });
    }

    // Check if student is already enrolled
    if (course.enrolledStudents.includes(studentId)) {
      return res.status(400).json({
        message: "Student is already enrolled in this course",
      });
    }

    course.enrolledStudents.push(studentId);
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Student enrolled successfully",
      course,
    });
  } catch (error) {
    console.error("Error enrolling student:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add student to purchase list
export const addPurchase = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { studentId } = req.body;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if student has already purchased
    if (course.purchase.includes(studentId)) {
      return res.status(400).json({
        message: "Student has already purchased this course",
      });
    }

    course.purchase.push(studentId);
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Purchase recorded successfully",
      course,
    });
  } catch (error) {
    console.error("Error recording purchase:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add live class to course
export const addLiveClass = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { liveClassId } = req.body;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if live class is already added
    if (course.liveClass.includes(liveClassId)) {
      return res.status(400).json({
        message: "Live class already added to this course",
      });
    }

    course.liveClass.push(liveClassId);
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Live class added successfully",
      course,
    });
  } catch (error) {
    console.error("Error adding live class:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Remove live class from course
export const removeLiveClass = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { liveClassId } = req.body;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.liveClass = course.liveClass.filter(
      (classId) => classId.toString() !== liveClassId
    );
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Live class removed successfully",
      course,
    });
  } catch (error) {
    console.error("Error removing live class:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add test series to course
export const addTestSeries = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { testSeriesId } = req.body;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if test series is already added
    if (course.testSeries.includes(testSeriesId)) {
      return res.status(400).json({
        message: "Test series already added to this course",
      });
    }

    course.testSeries.push(testSeriesId);
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Test series added successfully",
      course,
    });
  } catch (error) {
    console.error("Error adding test series:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Remove test series from course
export const removeTestSeries = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { testSeriesId } = req.body;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.testSeries = course.testSeries.filter(
      (seriesId) => seriesId.toString() !== testSeriesId
    );
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Test series removed successfully",
      course,
    });
  } catch (error) {
    console.error("Error removing test series:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update course rating
export const updateCourseRating = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { rating } = req.body;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Calculate new average rating
    const totalRating = course.rating * course.ratingCount + rating;
    course.ratingCount += 1;
    course.rating = totalRating / course.ratingCount;
    course.updatedAt = Date.now();

    await course.save();

    res.status(200).json({
      message: "Rating updated successfully",
      course: {
        id: course._id,
        rating: course.rating,
        ratingCount: course.ratingCount,
      },
    });
  } catch (error) {
    console.error("Error updating rating:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add video to course
export const addVideo = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, link, duration, sequenceNumber } = req.body;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if sequence number already exists
    const existingVideo = course.videos.find(
      (v) => v.sequenceNumber === sequenceNumber
    );

    if (existingVideo) {
      return res.status(400).json({
        message: "A video with this sequence number already exists",
      });
    }

    course.videos.push({ title, link, duration, sequenceNumber });
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Video added successfully",
      course,
    });
  } catch (error) {
    console.error("Error adding video:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Remove video from course
export const removeVideo = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id, videoId } = req.params;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.videos = course.videos.filter(
      (video) => video._id.toString() !== videoId
    );
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Video removed successfully",
      course,
    });
  } catch (error) {
    console.error("Error removing video:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add study material to course
export const addStudyMaterial = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, link, fileType } = req.body;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.studyMaterials.push({ title, link, fileType: fileType || "PDF" });
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Study material added successfully",
      course,
    });
  } catch (error) {
    console.error("Error adding study material:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Remove study material from course
export const removeStudyMaterial = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id, materialId } = req.params;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.studyMaterials = course.studyMaterials.filter(
      (material) => material._id.toString() !== materialId
    );
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      message: "Study material removed successfully",
      course,
    });
  } catch (error) {
    console.error("Error removing study material:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get course statistics
export const getCourseStatistics = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    const course = await Course.findOne({
      _id: id,
      isActive: true,
      status: { $ne: "deleted" },
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const statistics = {
      courseId: course._id,
      title: course.title,
      enrolledCount: course.enrolledCount,
      purchaseCount: course.purchaseCount,
      rating: course.rating,
      ratingCount: course.ratingCount,
      seatsAvailable: course.seatsAvailable,
      isFull: course.isFull,
      videoCount: course.videoCount,
      liveClassCount: course.liveClassCount,
      testSeriesCount: course.testSeriesCount,
      studyMaterialsCount: course.studyMaterials.length,
      discountedPrice: course.discountedPrice,
      isOngoing: course.isOngoing,
      isCompleted: course.isCompleted,
      isUpcoming: course.isUpcoming,
      isAccessValid: course.isAccessValid,
    };

    res.status(200).json({ statistics });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get overall platform statistics
export const getOverallStatistics = async (req, res) => {
  try {
    const totalCourses = await Course.countDocuments({
      isActive: true,
      status: { $ne: "deleted" },
    });
    const now = new Date();

    const ongoingCourses = await Course.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
      status: { $ne: "deleted" },
    });

    const upcomingCourses = await Course.countDocuments({
      startDate: { $gt: now },
      isActive: true,
      status: { $ne: "deleted" },
    });

    const completedCourses = await Course.countDocuments({
      endDate: { $lt: now },
      isActive: true,
      status: { $ne: "deleted" },
    });

    // Statistics by specialization
    const specializationStats = await Course.aggregate([
      { $match: { isActive: true, status: { $ne: "deleted" } } },
      { $unwind: "$specialization" },
      {
        $group: {
          _id: "$specialization",
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          totalEnrolled: { $sum: { $size: "$enrolledStudents" } },
        },
      },
    ]);

    // Statistics by subject
    const subjectStats = await Course.aggregate([
      { $match: { isActive: true, status: { $ne: "deleted" } } },
      { $unwind: "$subject" },
      {
        $group: {
          _id: "$subject",
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" },
        },
      },
    ]);

    // Top rated courses
    const topRatedCourses = await Course.find({
      isActive: true,
      status: { $ne: "deleted" },
    })
      .sort({ rating: -1, ratingCount: -1 })
      .limit(10)
      .select("title rating ratingCount educatorID")
      .populate("educatorID", "fullName username");

    // Most enrolled courses
    const mostEnrolledCourses = await Course.aggregate([
      { $match: { isActive: true, status: { $ne: "deleted" } } },
      {
        $project: {
          title: 1,
          educatorID: 1,
          enrolledCount: { $size: "$enrolledStudents" },
        },
      },
      { $sort: { enrolledCount: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      totalCourses,
      ongoingCourses,
      upcomingCourses,
      completedCourses,
      specializationStats,
      subjectStats,
      topRatedCourses,
      mostEnrolledCourses,
    });
  } catch (error) {
    console.error("Error fetching overall statistics:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
