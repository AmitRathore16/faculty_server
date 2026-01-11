import fs from "fs/promises";
import { validationResult } from "express-validator";
import Educator from "../models/educator.js";
import { getVimeoStatus, uploadVideoAndResolve } from "../util/vimeo.js";
import { createContact, createFundAccount } from "../services/razorpay.service.js";

// Get all educators with filtering and pagination
export const getAllEducators = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      specialization,
      subject,
      class: className,
      status,
      minRating,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    } else {
      filter.status = "active"; // Default to active educators
    }

    if (specialization) {
      filter.specialization = {
        $in: Array.isArray(specialization) ? specialization : [specialization],
      };
    }

    if (subject) {
      filter.subject = {
        $in: Array.isArray(subject) ? subject : [subject],
      };
    }

    if (className) {
      filter.class = {
        $in: Array.isArray(className) ? className : [className],
      };
    }

    if (minRating) {
      filter["rating.average"] = { $gte: parseFloat(minRating) };
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get educators with population
    const educators = await Educator.find(filter)
      .select("-password")
      .populate("followers", "fullName email")
      .populate("courses", "title slug")
      .populate("webinars", "title slug timing")
      .populate("testSeries", "title slug")
      .populate("tests", "title")
      .populate("questions", "question")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalEducators = await Educator.countDocuments(filter);
    const totalPages = Math.ceil(totalEducators / parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Educators retrieved successfully",
      data: {
        educators,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalEducators,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educators:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educator by ID
export const getEducatorById = async (req, res) => {
  try {
    const { id } = req.params;

    const educator = await Educator.findById(id)
      .select("-password")
      .populate("followers", "name fullName email profilePicture image")
      .populate({
        path: "courses",
        select: "title description slug fees image duration",
        options: { strictPopulate: false },
      })
      .populate({
        path: "webinars",
        select: "title description slug scheduledDate duration fees",
        options: { strictPopulate: false },
      })
      .populate({
        path: "testSeries",
        select: "title description slug totalTests",
        options: { strictPopulate: false },
      });

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Educator retrieved successfully",
      data: { educator },
    });
  } catch (error) {
    console.error("Error fetching educator:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educator by username
export const getEducatorByUsername = async (req, res) => {
  try {
    const { username } = req.params;

    const educator = await Educator.findOne({ username })
      .select("-password")
      .populate("followers", "fullName email profilePicture")
      .populate("courses", "title description slug fees")
      .populate("webinars", "title description slug timing fees")
      .populate("testSeries", "title description slug")
      .populate("tests", "title totalMarks duration")
      .populate("questions", "question subject difficulty");

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Educator retrieved successfully",
      data: educator,
    });
  } catch (error) {
    console.error("Error fetching educator:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educator by slug
export const getEducatorBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const educator = await Educator.findOne({ slug, status: "active" })
      .select("-password")
      .populate("followers", "fullName email profilePicture")
      .populate("courses", "title description slug fees")
      .populate("webinars", "title description slug timing fees")
      .populate("testSeries", "title description slug")
      .populate("tests", "title totalMarks duration")
      .populate("questions", "question subject difficulty");

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Educator retrieved successfully",
      data: educator,
    });
  } catch (error) {
    console.error("Error fetching educator:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update educator
export const updateEducator = async (req, res) => {
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

    // Don't allow password update through this route
    if (updateData.password) {
      delete updateData.password;
    }

    // If username is being updated, regenerate slug
    if (updateData.username) {
      const newSlug = updateData.username
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Check if new username/slug conflicts with existing educator (excluding current one)
      const existingEducator = await Educator.findOne({
        $or: [{ username: updateData.username }, { slug: newSlug }],
        _id: { $ne: id },
      });

      if (existingEducator) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }

      updateData.slug = newSlug;
    }

    const updatedEducator = await Educator.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updatedEducator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Educator updated successfully",
      data: updatedEducator,
    });
  } catch (error) {
    console.error("Error updating educator:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete educator (soft delete by setting status to inactive)
export const deleteEducator = async (req, res) => {
  try {
    const { id } = req.params;

    const educator = await Educator.findByIdAndUpdate(
      id,
      { status: "inactive" },
      { new: true }
    ).select("-password");

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Educator deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting educator:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educators by specialization
export const getEducatorsBySpecialization = async (req, res) => {
  try {
    const { specialization } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const educators = await Educator.findBySpecialization(specialization)
      .select("-password")
      .sort({ "rating.average": -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalEducators = await Educator.countDocuments({
      specialization: specialization,
      status: "active",
    });

    res.status(200).json({
      success: true,
      message: "Educators retrieved successfully",
      data: {
        educators,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalEducators / parseInt(limit)),
          totalEducators,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educators by specialization:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educators by subject
export const getEducatorsBySubject = async (req, res) => {
  try {
    const { subject } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const educators = await Educator.findBySubject(subject)
      .select("-password")
      .sort({ "rating.average": -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalEducators = await Educator.countDocuments({
      subject: subject,
      status: "active",
    });

    res.status(200).json({
      success: true,
      message: "Educators retrieved successfully",
      data: {
        educators,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalEducators / parseInt(limit)),
          totalEducators,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educators by subject:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educators by class
export const getEducatorsByClass = async (req, res) => {
  try {
    const { className } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const educators = await Educator.findByClass(className)
      .select("-password")
      .sort({ "rating.average": -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalEducators = await Educator.countDocuments({
      class: className,
      status: "active",
    });

    res.status(200).json({
      success: true,
      message: "Educators retrieved successfully",
      data: {
        educators,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalEducators / parseInt(limit)),
          totalEducators,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educators by class:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educators by minimum rating
export const getEducatorsByRating = async (req, res) => {
  try {
    const { minRating } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const educators = await Educator.findByMinRating(parseFloat(minRating))
      .select("-password")
      .skip(skip)
      .limit(parseInt(limit));

    const totalEducators = await Educator.countDocuments({
      "rating.average": { $gte: parseFloat(minRating) },
      status: "active",
    });

    res.status(200).json({
      success: true,
      message: "Educators retrieved successfully",
      data: {
        educators,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalEducators / parseInt(limit)),
          totalEducators,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educators by rating:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Search educators by name or username
export const searchEducators = async (req, res) => {
  try {
    const { query } = req.query;
    const { page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const educators = await Educator.find({
      $or: [
        { fullName: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
      ],
      status: "active",
    })
      .select("-password")
      .sort({ "rating.average": -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalEducators = await Educator.countDocuments({
      $or: [
        { fullName: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
      ],
      status: "active",
    });

    res.status(200).json({
      success: true,
      message: "Educators retrieved successfully",
      data: {
        educators,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalEducators / parseInt(limit)),
          totalEducators,
        },
      },
    });
  } catch (error) {
    console.error("Error searching educators:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Add follower to educator
export const addFollower = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    const educator = await Educator.findById(id);

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    // Check if student is already following
    if (educator.followers.includes(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Student is already following this educator",
      });
    }

    educator.followers.push(studentId);
    await educator.save();

    res.status(200).json({
      success: true,
      message: "Follower added successfully",
      data: {
        followerCount: educator.followers.length,
      },
    });
  } catch (error) {
    console.error("Error adding follower:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Remove follower from educator
export const removeFollower = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    const educator = await Educator.findById(id);

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    // Check if student is following
    const followerIndex = educator.followers.indexOf(studentId);
    if (followerIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Student is not following this educator",
      });
    }

    educator.followers.splice(followerIndex, 1);
    await educator.save();

    res.status(200).json({
      success: true,
      message: "Follower removed successfully",
      data: {
        followerCount: educator.followers.length,
      },
    });
  } catch (error) {
    console.error("Error removing follower:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educator's followers
export const getEducatorFollowers = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const educator = await Educator.findById(id)
      .select("followers")
      .populate({
        path: "followers",
        select: "fullName email profilePicture",
        options: {
          skip: (parseInt(page) - 1) * parseInt(limit),
          limit: parseInt(limit),
        },
      });

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const totalFollowers = educator.followers.length;

    res.status(200).json({
      success: true,
      message: "Followers retrieved successfully",
      data: {
        followers: educator.followers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalFollowers / parseInt(limit)),
          totalFollowers,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching followers:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update educator rating
export const updateEducatorRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required",
      });
    }

    const numericRating = Number(rating);

    if (Number.isNaN(numericRating) || numericRating < 0 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 0 and 5",
      });
    }

    const educator = await Educator.findById(id);

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    if (!Array.isArray(educator.studentRatings)) {
      educator.studentRatings = [];
    }

    const studentIdString = studentId.toString();

    const existingRatingIndex = educator.studentRatings.findIndex(
      (entry) => entry.student?.toString() === studentIdString
    );

    if (existingRatingIndex > -1) {
      educator.studentRatings[existingRatingIndex].value = numericRating;
      educator.studentRatings[existingRatingIndex].ratedAt = new Date();
    } else {
      educator.studentRatings.push({
        student: studentId,
        value: numericRating,
        ratedAt: new Date(),
      });
    }

    const totalRatings = educator.studentRatings.length;
    const ratingSum = educator.studentRatings.reduce(
      (sum, entry) => sum + Number(entry.value ?? 0),
      0
    );

    const newAverage = totalRatings > 0 ? ratingSum / totalRatings : 0;

    educator.rating.average = parseFloat(newAverage.toFixed(2));
    educator.rating.count = totalRatings;

    await educator.save();

    res.status(200).json({
      success: true,
      message:
        existingRatingIndex > -1
          ? "Rating updated successfully"
          : "Rating submitted successfully",
      data: {
        rating: educator.rating,
      },
    });
  } catch (error) {
    console.error("Error updating rating:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update educator revenue
export const updateEducatorRevenue = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, courseId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    const educator = await Educator.findById(id);

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    // Update total income
    educator.revenue.totalIncome += amount;

    // Update income per course if courseId is provided
    if (courseId) {
      const currentCourseIncome =
        educator.revenue.incomePerCourse.get(courseId) || 0;
      educator.revenue.incomePerCourse.set(
        courseId,
        currentCourseIncome + amount
      );
    }

    await educator.save();

    res.status(200).json({
      success: true,
      message: "Revenue updated successfully",
      data: {
        revenue: educator.revenue,
      },
    });
  } catch (error) {
    console.error("Error updating revenue:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get top rated educators
export const getTopRatedEducators = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const educators = await Educator.find({ status: "active" })
      .select("-password")
      .sort({ "rating.average": -1, "rating.count": -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Top rated educators retrieved successfully",
      data: educators,
    });
  } catch (error) {
    console.error("Error fetching top rated educators:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get educator statistics
export const getEducatorStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    const educator = await Educator.findById(id)
      .select("-password")
      .populate("courses")
      .populate("webinars")
      .populate("testSeries")
      .populate("tests")
      .populate("questions");

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const statistics = {
      totalCourses: educator.courses.length,
      totalWebinars: educator.webinars.length,
      totalTestSeries: educator.testSeries.length,
      totalTests: educator.tests.length,
      totalQuestions: educator.questions.length,
      totalFollowers: educator.followers.length,
      rating: educator.rating,
      revenue: educator.revenue,
      yearsOfExperience: educator.yoe,
    };

    res.status(200).json({
      success: true,
      message: "Educator statistics retrieved successfully",
      data: statistics,
    });
  } catch (error) {
    console.error("Error fetching educator statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const uploadEducatorIntroVideo = async (req, res) => {
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
    const educator = await Educator.findById(id).select(
      "fullName username introVideo introVideoVimeoUri"
    );

    if (!educator) {
      await cleanup();
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const meta = {
      name: `${educator.fullName || educator.username} | Intro`,
      description: "Educator intro video",
    };

    const result = await uploadVideoAndResolve(req.file.path, meta);

    educator.introVideoVimeoUri = result.uri;

    if (result.embedUrl || result.link) {
      educator.introVideo = result.embedUrl || result.link;
    }

    await educator.save();

    res.status(200).json({
      success: true,
      message: "Intro video uploaded to Vimeo",
      data: {
        introVideo: educator.introVideo,
        vimeoUri: educator.introVideoVimeoUri,
        status: result.status,
        link: result.link,
        embedUrl: result.embedUrl,
      },
    });
  } catch (error) {
    console.error("Error uploading educator intro video:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload intro video",
      error: error.message,
    });
  } finally {
    await cleanup();
  }
};

export const getEducatorIntroVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const educator = await Educator.findById(id).select(
      "introVideo introVideoVimeoUri fullName username"
    );

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    if (!educator.introVideoVimeoUri) {
      return res.status(400).json({
        success: false,
        message: "No Vimeo intro video found for this educator",
      });
    }

    const statusInfo = await getVimeoStatus(educator.introVideoVimeoUri);

    if (statusInfo.embedUrl && statusInfo.embedUrl !== educator.introVideo) {
      educator.introVideo = statusInfo.embedUrl;
      await educator.save();
    }

    res.status(200).json({
      success: true,
      data: {
        status: statusInfo.status,
        introVideo: educator.introVideo,
        vimeoUri: educator.introVideoVimeoUri,
        link: statusInfo.link,
        embedUrl: statusInfo.embedUrl,
      },
    });
  } catch (error) {
    console.error("Error fetching educator intro video status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch intro video status",
      error: error.message,
    });
  }
};

// Update educator bank details
export const updateEducatorBankDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { bankDetails } = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const educator = await Educator.findById(id);

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    // Update in DB
    educator.bankDetails = { ...educator.bankDetails, ...bankDetails };
    await educator.save();

    // Razorpay Integration
    try {
      // 1. Create Contact if not exists
      if (!educator.razorpayContactId) {
        const contact = await createContact(educator);
        educator.razorpayContactId = contact.id;
        await educator.save();
      }

      // 2. Create Fund Account (Always create new if details updated)
      const fundAccount = await createFundAccount(
        educator.razorpayContactId,
        educator.bankDetails
      );
      educator.razorpayFundAccountId = fundAccount.id;
      await educator.save();
    } catch (rpError) {
      console.error("Razorpay Onboarding Error:", rpError);
      return res.status(500).json({
        success: false,
        message: "Bank details saved, but failed to register with payout system",
        error: rpError.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Bank details updated and registered successfully",
      data: {
        bankDetails: educator.bankDetails,
        isPayoutReady: !!educator.razorpayFundAccountId,
      },
    });
  } catch (error) {
    console.error("Error updating bank details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

