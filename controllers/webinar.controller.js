import Webinar from "../models/webinar.js";
import { validationResult } from "express-validator";
import notificationService from "../services/notification.service.js";

// Create a new webinar
export const createWebinar = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const {
      title,
      description,
      webinarType,
      timing,
      subject,
      fees,
      duration,
      specialization,
      seatLimit,
      class: classes,
      image,
      educatorID,
      webinarLink,
      assetsLink,
    } = req.body;

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Check if slug already exists
    const existingWebinar = await Webinar.findOne({ slug });
    if (existingWebinar) {
      return res.status(400).json({
        success: false,
        message: "A webinar with this title already exists",
      });
    }

    // Create new webinar
    const newWebinar = new Webinar({
      title,
      description,
      webinarType,
      timing,
      subject,
      fees,
      duration,
      specialization,
      seatLimit,
      class: classes,
      image,
      educatorID,
      webinarLink,
      assetsLink,
      slug,
    });

    const savedWebinar = await newWebinar.save();

    // Notify all followers of the educator
    try {
      await notificationService.notifyFollowers(educatorID, "webinar", {
        _id: savedWebinar._id,
        title: savedWebinar.title,
        slug: savedWebinar.slug,
        timing: savedWebinar.timing,
        scheduledDate: savedWebinar.timing,
        description: savedWebinar.description,
        image: savedWebinar.image,
        webinarType: savedWebinar.webinarType,
        duration: savedWebinar.duration,
        fees: savedWebinar.fees,
        class: savedWebinar.class,
        specialization: savedWebinar.specialization,
      });
    } catch (notificationError) {
      console.error("Error sending notifications:", notificationError);
      // Don't fail the webinar creation if notification fails
    }

    res.status(201).json({
      success: true,
      message: "Webinar created successfully",
      data: savedWebinar,
    });
  } catch (error) {
    console.error("Error creating webinar:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all webinars with filtering and pagination
export const getAllWebinars = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      subject,
      specialization,
      class: className,
      webinarType,
      educatorID,
      upcoming,
      search,
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (subject) {
      filter.subject = { $in: Array.isArray(subject) ? subject : [subject] };
    }

    if (specialization) {
      filter.specialization = {
        $in: Array.isArray(specialization) ? specialization : [specialization],
      };
    }

    if (className) {
      filter.class = {
        $in: Array.isArray(className) ? className : [className],
      };
    }

    if (webinarType) {
      filter.webinarType = webinarType;
    }

    if (educatorID) {
      filter.educatorID = educatorID;
    }

    if (upcoming === "true") {
      filter.timing = { $gte: new Date() };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get webinars with population
    const webinars = await Webinar.find(filter)
      .populate("educatorID", "name email")
      .populate("studentEnrolled", "name email")
      .sort({ timing: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalWebinars = await Webinar.countDocuments(filter);
    const totalPages = Math.ceil(totalWebinars / parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Webinars retrieved successfully",
      data: {
        webinars,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalWebinars,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching webinars:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get webinar by ID
export const getWebinarById = async (req, res) => {
  try {
    const { id } = req.params;

    const webinar = await Webinar.findById(id)
      .populate("educatorID", "name email profile")
      .populate("studentEnrolled", "name email profile");

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Webinar retrieved successfully",
      data: webinar,
    });
  } catch (error) {
    console.error("Error fetching webinar:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get webinar by slug
export const getWebinarBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const webinar = await Webinar.findOne({ slug, isActive: true })
      .populate("educatorID", "name email profile")
      .populate("studentEnrolled", "name email profile");

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Webinar retrieved successfully",
      data: webinar,
    });
  } catch (error) {
    console.error("Error fetching webinar:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update webinar
export const updateWebinar = async (req, res) => {
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

    // If title is being updated, regenerate slug
    if (updateData.title) {
      const newSlug = updateData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Check if new slug conflicts with existing webinar (excluding current one)
      const existingWebinar = await Webinar.findOne({
        slug: newSlug,
        _id: { $ne: id },
      });

      if (existingWebinar) {
        return res.status(400).json({
          success: false,
          message: "A webinar with this title already exists",
        });
      }

      updateData.slug = newSlug;
    }

    const updatedWebinar = await Webinar.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("educatorID", "name email");

    if (!updatedWebinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Webinar updated successfully",
      data: updatedWebinar,
    });
  } catch (error) {
    console.error("Error updating webinar:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete webinar (soft delete)
export const deleteWebinar = async (req, res) => {
  try {
    const { id } = req.params;

    const webinar = await Webinar.findByIdAndDelete(id);

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Webinar deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting webinar:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Enroll student in webinar
export const enrollStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    const webinar = await Webinar.findById(id);

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found",
      });
    }

    // Check if webinar is full
    if (webinar.studentEnrolled.length >= webinar.seatLimit) {
      return res.status(400).json({
        success: false,
        message: "Webinar is full",
      });
    }

    // Check if student is already enrolled
    if (webinar.studentEnrolled.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Student is already enrolled",
      });
    }

    // Check if webinar has already started
    if (new Date(webinar.timing) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Cannot enroll in a webinar that has already started",
      });
    }

    // Add student to enrolled list
    webinar.studentEnrolled.push(studentId);
    await webinar.save();

    res.status(200).json({
      success: true,
      message: "Student enrolled successfully",
      data: {
        enrolledCount: webinar.studentEnrolled.length,
        seatsRemaining: webinar.seatLimit - webinar.studentEnrolled.length,
      },
    });
  } catch (error) {
    console.error("Error enrolling student:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Unenroll student from webinar
export const unenrollStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    const webinar = await Webinar.findById(id);

    if (!webinar) {
      return res.status(404).json({
        success: false,
        message: "Webinar not found",
      });
    }

    // Check if student is enrolled
    const studentIndex = webinar.studentEnrolled.indexOf(studentId);
    if (studentIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Student is not enrolled in this webinar",
      });
    }

    // Remove student from enrolled list
    webinar.studentEnrolled.splice(studentIndex, 1);
    await webinar.save();

    res.status(200).json({
      success: true,
      message: "Student unenrolled successfully",
      data: {
        enrolledCount: webinar.studentEnrolled.length,
        seatsRemaining: webinar.seatLimit - webinar.studentEnrolled.length,
      },
    });
  } catch (error) {
    console.error("Error unenrolling student:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get upcoming webinars
export const getUpcomingWebinars = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const upcomingWebinars = await Webinar.findUpcoming()
      .populate("educatorID", "name email")
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Upcoming webinars retrieved successfully",
      data: upcomingWebinars,
    });
  } catch (error) {
    console.error("Error fetching upcoming webinars:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get webinars by educator
export const getWebinarsByEducator = async (req, res) => {
  try {
    const { educatorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const webinars = await Webinar.findByEducator(educatorId)
      .populate("studentEnrolled", "name email")
      .sort({ timing: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalWebinars = await Webinar.countDocuments({
      educatorID: educatorId,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Educator webinars retrieved successfully",
      data: {
        webinars,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalWebinars / parseInt(limit)),
          totalWebinars,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educator webinars:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
