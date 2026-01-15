import Test from "../models/test.js";
import mongoose from "mongoose";
import { validationResult } from "express-validator";
import Student from "../models/student.js";

// Create a new test
export const createTest = async (req, res) => {
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
      image,
      subjects,
      class: classes,
      specialization,
      duration,
      overallMarks,
      markingType,
      questions,
      isTestSeriesSpecific,
      testSeriesID,
      educatorID,
      instructions,
      passingMarks,
      negativeMarking,
      negativeMarkingRatio,
      shuffleQuestions,
      showResult,
      allowReview,
    } = req.body;

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Check if slug already exists
    const existingTest = await Test.findOne({ slug });
    if (existingTest) {
      return res.status(400).json({
        success: false,
        message: "A test with this title already exists",
      });
    }

    // Validate test series ID if test series specific
    if (isTestSeriesSpecific && !testSeriesID) {
      return res.status(400).json({
        success: false,
        message: "Test Series ID is required when test is test series specific",
      });
    }

    // Validate passing marks
    if (passingMarks && passingMarks > overallMarks) {
      return res.status(400).json({
        success: false,
        message: "Passing marks cannot be greater than overall marks",
      });
    }

    // Create new test
    const newTest = new Test({
      title,
      description,
      image,
      subjects,
      class: classes,
      specialization,
      duration,
      overallMarks,
      markingType: markingType || "per_question",
      questions: questions || [],
      isTestSeriesSpecific: isTestSeriesSpecific || false,
      testSeriesID: isTestSeriesSpecific ? testSeriesID : undefined,
      educatorID,
      instructions,
      passingMarks,
      negativeMarking: negativeMarking || false,
      negativeMarkingRatio: negativeMarkingRatio || 0.25,
      shuffleQuestions: shuffleQuestions || false,
      showResult: showResult !== undefined ? showResult : true,
      allowReview: allowReview !== undefined ? allowReview : true,
      slug,
    });

    const savedTest = await newTest.save();

    // Update educator's tests array
    try {
      await mongoose
        .model("Educator")
        .findByIdAndUpdate(educatorID, { $push: { tests: savedTest._id } });
    } catch (error) {
      console.error("Error updating educator tests array:", error);
      // Continue even if educator update fails
    }

    res.status(201).json({
      success: true,
      message: "Test created successfully",
      data: savedTest,
    });
  } catch (error) {
    console.error("Error creating test:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all tests with filtering and pagination
export const getAllTests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      subjects,
      class: className,
      specialization,
      educatorID,
      testSeriesID,
      isTestSeriesSpecific,
      markingType,
      search,
      minDuration,
      maxDuration,
      minMarks,
      maxMarks,
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (subjects) {
      filter.subjects = {
        $in: Array.isArray(subjects) ? subjects : [subjects],
      };
    }

    if (className) {
      filter.class = {
        $in: Array.isArray(className) ? className : [className],
      };
    }

    if (specialization) {
      filter.specialization = {
        $in: Array.isArray(specialization) ? specialization : [specialization],
      };
    }

    if (educatorID) {
      filter.educatorID = educatorID;
    }

    if (testSeriesID) {
      filter.testSeriesID = testSeriesID;
    }

    if (isTestSeriesSpecific !== undefined) {
      filter.isTestSeriesSpecific = isTestSeriesSpecific === "true";
    }

    if (markingType) {
      filter.markingType = markingType;
    }

    if (minDuration || maxDuration) {
      filter.duration = {};
      if (minDuration) filter.duration.$gte = parseInt(minDuration);
      if (maxDuration) filter.duration.$lte = parseInt(maxDuration);
    }

    if (minMarks || maxMarks) {
      filter.overallMarks = {};
      if (minMarks) filter.overallMarks.$gte = parseInt(minMarks);
      if (maxMarks) filter.overallMarks.$lte = parseInt(maxMarks);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get tests with population
    const tests = await Test.find(filter)
      .populate({
        path: "educatorID",
        select: "name email",
        strictPopulate: false,
      })
      .populate({
        path: "testSeriesID",
        select: "title description",
        strictPopulate: false,
      })
      .populate({
        path: "questions",
        select: "title difficulty marks",
        strictPopulate: false,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalTests = await Test.countDocuments(filter);
    const totalPages = Math.ceil(totalTests / parseInt(limit));

    console.log("Found tests:", tests.length, "Total tests:", totalTests);

    res.status(200).json({
      success: true,
      message: "Tests retrieved successfully",
      data: {
        tests: tests || [],
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTests,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching tests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get test by ID
export const getTestById = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findById(id)
      .populate("educatorID", "name email profile")
      .populate("testSeriesID", "title description")
      .populate("questions", "title questionType difficulty marks topics");

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Test retrieved successfully",
      data: test,
    });
  } catch (error) {
    console.error("Error fetching test:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get test by slug
export const getTestBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const test = await Test.findOne({ slug, isActive: true })
      .populate("educatorID", "name email profile")
      .populate("testSeriesID", "title description")
      .populate("questions", "title questionType difficulty marks topics");

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Test retrieved successfully",
      data: test,
    });
  } catch (error) {
    console.error("Error fetching test:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update test
export const updateTest = async (req, res) => {
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

      // Check if new slug conflicts with existing test (excluding current one)
      const existingTest = await Test.findOne({
        slug: newSlug,
        _id: { $ne: id },
      });

      if (existingTest) {
        return res.status(400).json({
          success: false,
          message: "A test with this title already exists",
        });
      }

      updateData.slug = newSlug;
    }

    // Validate test series specific logic
    if (updateData.isTestSeriesSpecific !== undefined) {
      if (updateData.isTestSeriesSpecific && !updateData.testSeriesID) {
        return res.status(400).json({
          success: false,
          message:
            "Test Series ID is required when test is test series specific",
        });
      }
      if (!updateData.isTestSeriesSpecific) {
        updateData.testSeriesID = undefined;
      }
    }

    // Validate passing marks
    if (
      updateData.passingMarks &&
      updateData.overallMarks &&
      updateData.passingMarks > updateData.overallMarks
    ) {
      return res.status(400).json({
        success: false,
        message: "Passing marks cannot be greater than overall marks",
      });
    }

    const updatedTest = await Test.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("educatorID", "name email")
      .populate("testSeriesID", "title description");

    if (!updatedTest) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Test updated successfully",
      data: updatedTest,
    });
  } catch (error) {
    console.error("Error updating test:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete test (soft delete)
export const deleteTest = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Remove from educator's tests array
    try {
      await mongoose
        .model("Educator")
        .findByIdAndUpdate(test.educatorID, { $pull: { tests: id } });
    } catch (error) {
      console.error("Error updating educator tests array:", error);
      // Continue even if educator update fails
    }

    res.status(200).json({
      success: true,
      message: "Test deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting test:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Add question to test
export const addQuestionToTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionId } = req.body;

    const test = await Test.findById(id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Check if question is already in the test
    if (test.questions.includes(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Question is already added to this test",
      });
    }

    // Add question to test
    await test.addQuestion(questionId);

    res.status(200).json({
      success: true,
      message: "Question added to test successfully",
      data: {
        questionCount: test.questions.length,
      },
    });
  } catch (error) {
    console.error("Error adding question to test:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Remove question from test
export const removeQuestionFromTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { questionId } = req.body;

    const test = await Test.findById(id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    // Check if question is in the test
    if (!test.questions.includes(questionId)) {
      return res.status(400).json({
        success: false,
        message: "Question is not part of this test",
      });
    }

    // Remove question from test
    await test.removeQuestion(questionId);

    res.status(200).json({
      success: true,
      message: "Question removed from test successfully",
      data: {
        questionCount: test.questions.length,
      },
    });
  } catch (error) {
    console.error("Error removing question from test:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get tests by educator
export const getTestsByEducator = async (req, res) => {
  try {
    const { educatorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tests = await Test.findByEducator(educatorId)
      .populate("testSeriesID", "title description")
      .populate("questions", "title difficulty")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalTests = await Test.countDocuments({
      educatorID: educatorId,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Educator tests retrieved successfully",
      data: {
        tests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTests / parseInt(limit)),
          totalTests,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educator tests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get test series specific tests
export const getTestSeriesSpecificTests = async (req, res) => {
  try {
    const { testSeriesId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tests = await Test.findTestSeriesSpecific(testSeriesId)
      .populate("educatorID", "name email")
      .populate("testSeriesID", "title description")
      .populate("questions", "title difficulty")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalTests = await Test.countDocuments({
      testSeriesID: testSeriesId,
      isTestSeriesSpecific: true,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Test series specific tests retrieved successfully",
      data: {
        tests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTests / parseInt(limit)),
          totalTests,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching test series specific tests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get standalone tests (not part of any test series)
export const getStandaloneTests = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tests = await Test.findStandalone()
      .populate("educatorID", "name email")
      .populate("questions", "title difficulty")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalTests = await Test.countDocuments({
      isTestSeriesSpecific: false,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Standalone tests retrieved successfully",
      data: {
        tests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTests / parseInt(limit)),
          totalTests,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching standalone tests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get test statistics
export const getTestStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findById(id).populate(
      "questions",
      "difficulty marks"
    );

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    const statistics = test.getTestStatistics();

    // Calculate difficulty distribution
    const difficultyStats = test.questions.reduce((acc, question) => {
      const difficulty = question.difficulty?.toLowerCase() || "unknown";
      acc[difficulty] = (acc[difficulty] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: "Test statistics retrieved successfully",
      data: {
        ...statistics,
        difficultyDistribution: difficultyStats,
        createdAt: test.createdAt,
        updatedAt: test.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching test statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get tests by test series
export const getTestsByTestSeries = async (req, res) => {
  try {
    const { testSeriesId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tests = await Test.find({
      testSeriesID: testSeriesId,
      isTestSeriesSpecific: true,
      isActive: true,
    })
      .populate("educatorID", "name email")
      .populate("questions", "title difficulty")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalTests = await Test.countDocuments({
      testSeriesID: testSeriesId,
      isTestSeriesSpecific: true,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Test series tests retrieved successfully",
      data: {
        tests,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTests / parseInt(limit)),
          totalTests,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching test series tests:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get test questions
export const getTestQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const test = await Test.findById(id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get paginated questions
    const questions = await Test.findById(id)
      .populate({
        path: "questions",
        options: {
          skip: skip,
          limit: parseInt(limit),
        },
      })
      .select("questions");

    const totalQuestions = test.questions.length;

    res.status(200).json({
      success: true,
      message: "Test questions retrieved successfully",
      data: {
        questions: questions.questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalQuestions / parseInt(limit)),
          totalQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching test questions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get filtered tests (alias for getAllTests with advanced filtering)
export const getFilteredTests = async (req, res) => {
  // This is the same as getAllTests but with more advanced filtering
  return getAllTests(req, res);
};
// POST /api/tests/:id/submit

// POST /api/tests/:id/submit
export const submitTest = async (req, res) => {
  try {
    const { id: testId } = req.params;

    const {
      studentId,
      score,
      totalMarks,
      percentage,
      correctAnswers,
      wrongAnswers,
      unattempted
    } = req.body;

    // ✅ get student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // ✅ get test (for title)
    const test = await Test.findById(testId).select("title");
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    // ✅ save result with title snapshot
    student.results.push({
      testId,
      title: test.title, // ✅ IMPORTANT
      score,
      totalMarks,
      percentage,
      correctAnswers,
      wrongAnswers,
      unattempted,
      completedAt: new Date(),
    });

    await student.save();

    return res.json({ success: true, message: "Result saved" });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};



export default {
  createTest,
  getAllTests,
  getTestById,
  getTestBySlug,
  updateTest,
  deleteTest,
  addQuestionToTest,
  removeQuestionFromTest,
  getTestsByEducator,
  getTestsByTestSeries,
  getTestQuestions,
  getTestSeriesSpecificTests,
  getStandaloneTests,
  getTestStatistics,
  getFilteredTests,
  submitTest
};
