import Student from "../models/student.js";
import Course from "../models/course.js";
import Webinar from "../models/webinar.js";
import EducatorModel from "../models/educator.js";
import { validationResult } from "express-validator";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

const CLASS_SLUG_MAP = {
  "class-6th": "Class 6th",
  "class-7th": "Class 7th",
  "class-8th": "Class 8th",
  "class-9th": "Class 9th",
  "class-10th": "Class 10th",
  "class-11th": "Class 11th",
  "class-12th": "Class 12th",
  dropper: "Dropper",
};

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 50;

const NOTIFICATION_ENTITY_TYPES = {
  COURSE: "course",
  WEBINAR: "webinar",
};

const normalizeClassInput = (value) => {
  if (!value || typeof value !== "string") {
    return value;
  }

  const normalizedKey = value.toLowerCase().replace(/\s+/g, "-");
  return CLASS_SLUG_MAP[normalizedKey] || value;
};

// Create a new student
export const createStudent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const {
      name,
      username,
      password,
      mobileNumber,
      email,
      address,
      image,
      specialization,
      class: studentClass,
      deviceToken,
      preferences,
    } = req.body;

    const normalizedClass = normalizeClassInput(studentClass);

    const existingStudent = await Student.findOne({
      $or: [{ email }, { username }, { mobileNumber }],
    });

    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message:
          "Student with this email, username, or mobile number already exists",
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newStudent = new Student({
      name,
      username,
      password: hashedPassword,
      mobileNumber,
      email,
      address,
      image,
      specialization,
      class: normalizedClass,
      deviceToken,
      preferences,
    });

    const savedStudent = await newStudent.save();
    const studentResponse = savedStudent.toObject();
    delete studentResponse.password;

    res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: studentResponse,
    });
  } catch (error) {
    console.error("Error creating student:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all students with filtering and pagination
export const getAllStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      specialization,
      class: className,
      isActive = true,
      search,
      sortBy = "joinedAt",
      sortOrder = "desc",
    } = req.query;

    const filter = { isActive: isActive === "true" };

    if (specialization) {
      filter.specialization = specialization;
    }

    if (className) {
      filter.class = normalizeClassInput(className);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const students = await Student.find(filter)
      .populate({
        path: "courses.courseId",
        select: "title description",
        strictPopulate: false,
      })
      .populate({
        path: "followingEducators.educatorId",
        select: "name email subjects",
        strictPopulate: false,
      })
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    const totalStudents = await Student.countDocuments(filter);
    const totalPages = Math.ceil(totalStudents / parseInt(limit, 10));
    res.status(200).json({
      success: true,
      message: "Students retrieved successfully",
      data: {
        students: students || [],
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages,
          totalStudents,
          hasNextPage: parseInt(page, 10) < totalPages,
          hasPrevPage: parseInt(page, 10) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get student by ID
export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id)
      .populate("courses.courseId", "title description image duration")
      .populate("testSeries.testSeriesId", "title description totalTests")
      .populate("webinars.webinarId", "title scheduledDate duration")
      .populate({
        path: "followingEducators.educatorId",
        select:
          "fullName firstName lastName username email specialization subject image profilePicture rating yoe experience yearsExperience slug",
      })
      .populate("tests.testId", "title duration overallMarks")
      .select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student retrieved successfully",
      data: student,
    });
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get student by username
export const getStudentByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    const student = await Student.findOne({ username, isActive: true })
      .populate("courses.courseId", "title description")
      .populate({
        path: "followingEducators.educatorId",
        select:
          "fullName firstName lastName username email specialization subject image profilePicture rating yoe experience yearsExperience slug",
      })
      .select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student retrieved successfully",
      data: student,
    });
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update student
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const updateData = { ...req.body };

    delete updateData.password;
    delete updateData.role;
    delete updateData.joinedAt;
    delete updateData.tests;
    delete updateData.results;

    if (updateData.class) {
      updateData.class = normalizeClassInput(updateData.class);
    }

    if (updateData.email || updateData.username || updateData.mobileNumber) {
      const duplicateFilter = { _id: { $ne: id } };
      const orConditions = [];

      if (updateData.email) orConditions.push({ email: updateData.email });
      if (updateData.username)
        orConditions.push({ username: updateData.username });
      if (updateData.mobileNumber)
        orConditions.push({ mobileNumber: updateData.mobileNumber });

      duplicateFilter.$or = orConditions;

      const existingStudent = await Student.findOne(duplicateFilter);
      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: "Email, username, or mobile number already exists",
        });
      }
    }

    const updatedStudent = await Student.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("courses.courseId", "title description")
      .populate("followingEducators.educatorId", "name email")
      .select("-password");

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: updatedStudent,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete student (soft delete)
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Enroll student in course
export const enrollInCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { courseId } = req.body;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    await student.enrollInCourse(courseId);

    res.status(200).json({
      success: true,
      message: "Student enrolled in course successfully",
      data: {
        totalCourses: student.courses.length,
      },
    });
  } catch (error) {
    console.error("Error enrolling student in course:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Follow educator
export const followEducator = async (req, res) => {
  try {
    const { id } = req.params;
    const { educatorId } = req.body;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    await student.followEducator(educatorId);

    await EducatorModel.findByIdAndUpdate(
      educatorId,
      { $addToSet: { followers: id } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Educator followed successfully",
      data: {
        totalFollowing: student.followingEducators.length,
      },
    });
  } catch (error) {
    console.error("Error following educator:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Unfollow educator
export const unfollowEducator = async (req, res) => {
  try {
    const { id } = req.params;
    const { educatorId } = req.body;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    await student.unfollowEducator(educatorId);

    await EducatorModel.findByIdAndUpdate(
      educatorId,
      { $pull: { followers: id } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Educator unfollowed successfully",
      data: {
        totalFollowing: student.followingEducators.length,
      },
    });
  } catch (error) {
    console.error("Error unfollowing educator:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Register for webinar
export const registerForWebinar = async (req, res) => {
  try {
    const { id } = req.params;
    const { webinarId } = req.body;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    await student.registerForWebinar(webinarId);

    res.status(200).json({
      success: true,
      message: "Registered for webinar successfully",
      data: {
        totalWebinars: student.webinars.length,
      },
    });
  } catch (error) {
    console.error("Error registering for webinar:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get student statistics
export const getStudentStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const statistics = student.getStudentStats();

    res.status(200).json({
      success: true,
      message: "Student statistics retrieved successfully",
      data: statistics,
    });
  } catch (error) {
    console.error("Error fetching student statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get students by specialization
export const getStudentsBySpecialization = async (req, res) => {
  try {
    const { specialization } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const students = await Student.findBySpecialization(specialization)
      .select("-password")
      .sort({ joinedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalStudents = await Student.countDocuments({
      specialization,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Students by specialization retrieved successfully",
      data: {
        students,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalStudents / parseInt(limit, 10)),
          totalStudents,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching students by specialization:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get students by class
export const getStudentsByClass = async (req, res) => {
  try {
    const { className } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const normalizedClass = normalizeClassInput(className);
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const students = await Student.findByClass(normalizedClass)
      .select("-password")
      .sort({ joinedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const totalStudents = await Student.countDocuments({
      class: normalizedClass,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Students by class retrieved successfully",
      data: {
        students,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalStudents / parseInt(limit, 10)),
          totalStudents,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching students by class:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get notifications for a student
export const getStudentNotifications = async (req, res) => {
  try {
    const { id } = req.params;
    const limitParam = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(limitParam, MAX_NOTIFICATION_LIMIT))
      : DEFAULT_NOTIFICATION_LIMIT;

    const student = await Student.findById(id)
      .select("followingEducators isActive")
      .lean();

    if (!student || student.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const followings = Array.isArray(student.followingEducators)
      ? student.followingEducators
      : [];

    if (!followings.length) {
      return res.status(200).json({
        success: true,
        message: "No notifications available",
        data: {
          notifications: [],
          metadata: {
            total: 0,
          },
        },
      });
    }

    const educatorObjectIds = [];
    const seenEducatorIds = new Set();
    const followDateMap = new Map();

    followings.forEach((follow) => {
      if (!follow || !follow.educatorId) {
        return;
      }

      const educatorIdStr = follow.educatorId.toString();

      if (!seenEducatorIds.has(educatorIdStr)) {
        seenEducatorIds.add(educatorIdStr);
        educatorObjectIds.push(new mongoose.Types.ObjectId(educatorIdStr));
      }

      const followedAtValue = follow.followedAt
        ? new Date(follow.followedAt)
        : null;
      const existingFollowDate = followDateMap.get(educatorIdStr);

      if (
        !existingFollowDate ||
        (followedAtValue && existingFollowDate < followedAtValue)
      ) {
        followDateMap.set(educatorIdStr, followedAtValue);
      }
    });

    if (!educatorObjectIds.length) {
      return res.status(200).json({
        success: true,
        message: "No notifications available",
        data: {
          notifications: [],
          metadata: {
            total: 0,
          },
        },
      });
    }

    const [courses, webinars, educators] = await Promise.all([
      Course.find({
        educatorID: { $in: educatorObjectIds },
        isActive: true,
      })
        .select(
          "title educatorID createdAt updatedAt startDate subject courseType image courseThumbnail"
        )
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit * 2)
        .lean(),
      Webinar.find({
        educatorID: { $in: educatorObjectIds },
        isActive: true,
      })
        .select(
          "title educatorID createdAt updatedAt timing specialization class image webinarLink"
        )
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit * 2)
        .lean(),
      EducatorModel.find({ _id: { $in: educatorObjectIds } })
        .select(
          "fullName firstName lastName username image profilePicture specialization subject yoe experience yearsExperience"
        )
        .lean(),
    ]);

    const educatorInfoMap = new Map();
    educators.forEach((educator) => {
      const educatorIdStr = educator._id.toString();
      const compositeName = [
        educator.fullName,
        educator.name,
        [educator.firstName, educator.lastName]
          .filter(Boolean)
          .join(" ")
          .trim(),
      ].find((value) => value && value.length > 0);

      const profileImageUrl =
        educator.image?.url ||
        educator.image?.secure_url ||
        educator.profilePicture ||
        null;

      educatorInfoMap.set(educatorIdStr, {
        displayName: compositeName || educator.username || "Educator",
        avatar: profileImageUrl,
        specialization: educator.specialization,
        subject: educator.subject,
        experience:
          educator.yoe ??
          educator.yearsExperience ??
          educator.experience ??
          null,
      });
    });

    const deriveTimestamp = (document) => {
      if (!document) {
        return new Date();
      }

      if (document.createdAt) {
        const createdAtDate = new Date(document.createdAt);
        if (!Number.isNaN(createdAtDate.getTime())) {
          return createdAtDate;
        }
      }

      if (document.updatedAt) {
        const updatedAtDate = new Date(document.updatedAt);
        if (!Number.isNaN(updatedAtDate.getTime())) {
          return updatedAtDate;
        }
      }

      if (document._id && typeof document._id.getTimestamp === "function") {
        return document._id.getTimestamp();
      }

      return new Date();
    };

    const notifications = [];

    courses.forEach((course) => {
      const educatorId = course.educatorID
        ? course.educatorID.toString()
        : null;
      if (!educatorId) {
        return;
      }

      const createdAt = deriveTimestamp(course);
      const followedAt = followDateMap.get(educatorId);

      if (followedAt && createdAt < followedAt) {
        return;
      }

      const educatorInfo = educatorInfoMap.get(educatorId) || {};
      const educatorName = educatorInfo.displayName || "Educator";

      notifications.push({
        id: `course:${course._id.toString()}`,
        type: NOTIFICATION_ENTITY_TYPES.COURSE,
        entityId: course._id.toString(),
        educatorId,
        educatorName,
        title: course.title,
        message: `${educatorName} published a new course`,
        createdAt: createdAt.toISOString(),
        link: `/student-courses/${course._id.toString()}`,
        thumbnail:
          course.image || course.courseThumbnail || educatorInfo.avatar || null,
        metadata: {
          courseType: course.courseType || null,
          startDate: course.startDate
            ? new Date(course.startDate).toISOString()
            : null,
          subject: Array.isArray(course.subject) ? course.subject : [],
          educatorSpecialization: educatorInfo.specialization || null,
          educatorSubject: educatorInfo.subject || null,
          educatorExperience: educatorInfo.experience ?? null,
        },
      });
    });

    webinars.forEach((webinar) => {
      const educatorId = webinar.educatorID
        ? webinar.educatorID.toString()
        : null;
      if (!educatorId) {
        return;
      }

      const createdAt = deriveTimestamp(webinar);
      const followedAt = followDateMap.get(educatorId);

      if (followedAt && createdAt < followedAt) {
        return;
      }

      const educatorInfo = educatorInfoMap.get(educatorId) || {};
      const educatorName = educatorInfo.displayName || "Educator";

      notifications.push({
        id: `webinar:${webinar._id.toString()}`,
        type: NOTIFICATION_ENTITY_TYPES.WEBINAR,
        entityId: webinar._id.toString(),
        educatorId,
        educatorName,
        title: webinar.title,
        message: `${educatorName} announced a new webinar`,
        createdAt: createdAt.toISOString(),
        link: `/student-webinars/${webinar._id.toString()}`,
        thumbnail: webinar.image || educatorInfo.avatar || null,
        metadata: {
          timing: webinar.timing
            ? new Date(webinar.timing).toISOString()
            : null,
          specialization: Array.isArray(webinar.specialization)
            ? webinar.specialization
            : [],
          class: Array.isArray(webinar.class) ? webinar.class : [],
          educatorSpecialization: educatorInfo.specialization || null,
          educatorSubject: educatorInfo.subject || null,
          educatorExperience: educatorInfo.experience ?? null,
        },
      });
    });

    const sortedNotifications = notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: {
        notifications: sortedNotifications,
        metadata: {
          total: sortedNotifications.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching student notifications:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get enrolled students for an educator
export const getEducatorEnrolledStudents = async (req, res) => {
  try {
    const { educatorId } = req.params;

    const courses = await Course.find({
      educatorID: educatorId,
      isActive: true,
      status: { $ne: "deleted" },
    })
      .select("_id title courseType fees discount enrolledStudents")
      .lean();

    if (!courses || courses.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No courses found for this educator",
        data: [],
      });
    }

    const courseIds = courses.map((course) => course._id.toString());
    const courseMap = new Map(
      courses.map((course) => [course._id.toString(), course])
    );

    const enrolledStudentIds = new Set();
    courses.forEach((course) => {
      (course.enrolledStudents || []).forEach((studentId) => {
        enrolledStudentIds.add(studentId.toString());
      });
    });

    const students = await Student.find({
      isActive: true,
      $or: [
        { "courses.courseId": { $in: courseIds } },
        { _id: { $in: Array.from(enrolledStudentIds) } },
      ],
    })
      .select(
        "name email mobileNumber username specialization class address image joinedAt isEmailVerified courses"
      )
      .lean();

    const studentMap = new Map(
      students.map((student) => [student._id.toString(), student])
    );

    const seen = new Set();
    const normalizeCourseType = (courseType) =>
      courseType === "one-to-one" || courseType === "OTO" ? "OTO" : "OTA";
    const calcAmountPaid = (fees = 0, discount = 0) =>
      Math.max(0, Math.round(fees * (1 - discount / 100)));

    const enrollments = [];

    const addEnrollment = (studentId, courseId) => {
      const key = `${studentId}-${courseId}`;
      if (seen.has(key)) return;

      const student = studentMap.get(studentId);
      const course = courseMap.get(courseId);
      if (!student || !course) return;

      const discount =
        typeof course.discount === "number" ? course.discount : 0;

      enrollments.push({
        _id: student._id,
        name: student.name,
        email: student.email,
        mobileNumber: student.mobileNumber,
        username: student.username,
        specialization: student.specialization,
        class: student.class,
        address: student.address,
        image: student.image,
        joinedAt: student.joinedAt,
        isEmailVerified: student.isEmailVerified,
        courseId,
        courseTitle: course.title,
        courseType: normalizeCourseType(course.courseType),
        courseFees: course.fees || 0,
        courseDiscount: discount,
        amountPaid: calcAmountPaid(course.fees || 0, discount),
      });

      seen.add(key);
    };

    students.forEach((student) => {
      (student.courses || []).forEach((courseEntry) => {
        const courseId = courseEntry?.courseId?.toString();
        if (!courseId || !courseMap.has(courseId)) return;
        addEnrollment(student._id.toString(), courseId);
      });
    });

    courses.forEach((course) => {
      const courseId = course._id.toString();
      (course.enrolledStudents || []).forEach((studentId) => {
        addEnrollment(studentId.toString(), courseId);
      });
    });

    return res.status(200).json({
      success: true,
      message: "Enrolled students fetched successfully",
      data: enrollments,
    });
  } catch (error) {
    console.error("Error fetching enrolled students by educator:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update student password
export const updatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      student.password
    );
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    student.password = hashedNewPassword;
    await student.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default {
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
};
