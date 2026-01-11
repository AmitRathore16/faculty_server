import Question from "../models/question.js";
import Educator from "../models/educator.js";
import { validationResult } from "express-validator";
import { parse } from "csv-parse/sync";

// Create a new question
export const createQuestion = async (req, res) => {
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
      title,
      questionType,
      educatorId,
      questionImage,
      subject,
      specialization,
      class: classes,
      topics,
      options,
      correctOptions,
      difficulty,
      marks,
      explanation,
      tags,
    } = req.body;

    // Create new question
    const newQuestion = new Question({
      title,
      questionType,
      educatorId,
      questionImage,
      subject,
      specialization,
      class: classes,
      topics,
      options,
      correctOptions,
      difficulty,
      marks,
      explanation,
      tags,
    });

    const savedQuestion = await newQuestion.save();

    if (educatorId) {
      await Educator.findByIdAndUpdate(
        educatorId,
        { $addToSet: { questions: savedQuestion._id } },
        { new: true }
      );
    }

    res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: savedQuestion,
    });
  } catch (error) {
    console.error("Error creating question:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all questions with filtering and pagination
export const getAllQuestions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      educatorId,
      subject,
      specialization,
      class: className,
      difficulty,
      questionType,
      topics,
      tags,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (educatorId) {
      filter.educatorId = educatorId;
    }

    if (subject) {
      filter.subject = {
        $in: Array.isArray(subject) ? subject : [subject],
      };
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

    if (difficulty) {
      filter.difficulty = difficulty;
    }

    if (questionType) {
      filter.questionType = questionType;
    }

    if (topics) {
      filter.topics = {
        $in: Array.isArray(topics) ? topics : [topics],
      };
    }

    if (tags) {
      filter.tags = {
        $in: Array.isArray(tags) ? tags : [tags],
      };
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
        { topics: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get questions with population
    const questions = await Question.find(filter)
      .populate("educatorId", "fullName username email")
      .populate("tests", "title")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalQuestions = await Question.countDocuments(filter);
    const totalPages = Math.ceil(totalQuestions / parseInt(limit));

    res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalQuestions,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get question by ID
export const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await Question.findById(id)
      .populate("educatorId", "fullName username email profilePicture")
      .populate("tests", "title description");

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Question retrieved successfully",
      data: question,
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get question by slug
export const getQuestionBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const question = await Question.findOne({ slug, isActive: true })
      .populate("educatorId", "fullName username email profilePicture")
      .populate("tests", "title description");

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Question retrieved successfully",
      data: question,
    });
  } catch (error) {
    console.error("Error fetching question:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update question
export const updateQuestion = async (req, res) => {
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
        .replace(/(^-|-$)/g, "")
        .substring(0, 100);

      updateData.slug = newSlug;
    }

    const updatedQuestion = await Question.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("educatorId", "fullName username email")
      .populate("tests", "title");

    if (!updatedQuestion) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: updatedQuestion,
    });
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete question (soft delete)
export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await Question.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get questions by educator
export const getQuestionsByEducator = async (req, res) => {
  try {
    const { educatorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.findByEducator(educatorId)
      .populate("tests", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalQuestions = await Question.countDocuments({
      educatorId,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalQuestions / parseInt(limit)),
          totalQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educator questions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get questions by subject
export const getQuestionsBySubject = async (req, res) => {
  try {
    const { subject } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.findBySubject(subject)
      .populate("educatorId", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalQuestions = await Question.countDocuments({
      subject: subject,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalQuestions / parseInt(limit)),
          totalQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching questions by subject:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get questions by specialization
export const getQuestionsBySpecialization = async (req, res) => {
  try {
    const { specialization } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.findBySpecialization(specialization)
      .populate("educatorId", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalQuestions = await Question.countDocuments({
      specialization: specialization,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalQuestions / parseInt(limit)),
          totalQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching questions by specialization:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get questions by difficulty
export const getQuestionsByDifficulty = async (req, res) => {
  try {
    const { difficulty } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.findByDifficulty(difficulty)
      .populate("educatorId", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalQuestions = await Question.countDocuments({
      difficulty: difficulty,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalQuestions / parseInt(limit)),
          totalQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching questions by difficulty:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get questions by class
export const getQuestionsByClass = async (req, res) => {
  try {
    const { className } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.findByClass(className)
      .populate("educatorId", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalQuestions = await Question.countDocuments({
      class: className,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalQuestions / parseInt(limit)),
          totalQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching questions by class:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get questions by topics
export const getQuestionsByTopics = async (req, res) => {
  try {
    const { topics } = req.query;
    const { page = 1, limit = 10 } = req.query;

    if (!topics) {
      return res.status(400).json({
        success: false,
        message: "Topics parameter is required",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const topicsArray = Array.isArray(topics) ? topics : [topics];

    const questions = await Question.findByTopics(topicsArray)
      .populate("educatorId", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalQuestions = await Question.countDocuments({
      topics: { $in: topicsArray },
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalQuestions / parseInt(limit)),
          totalQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching questions by topics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get questions by tags
export const getQuestionsByTags = async (req, res) => {
  try {
    const { tags } = req.query;
    const { page = 1, limit = 10 } = req.query;

    if (!tags) {
      return res.status(400).json({
        success: false,
        message: "Tags parameter is required",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tagsArray = Array.isArray(tags) ? tags : [tags];

    const questions = await Question.findByTags(tagsArray)
      .populate("educatorId", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalQuestions = await Question.countDocuments({
      tags: { $in: tagsArray },
      isActive: true,
    });

    res.status(200).json({
      success: true,
      message: "Questions retrieved successfully",
      data: {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalQuestions / parseInt(limit)),
          totalQuestions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching questions by tags:", error);
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
    const { testId } = req.body;

    const question = await Question.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Check if test is already added
    if (question.tests.includes(testId)) {
      return res.status(400).json({
        success: false,
        message: "Question is already part of this test",
      });
    }

    question.tests.push(testId);
    await question.save();

    res.status(200).json({
      success: true,
      message: "Question added to test successfully",
      data: {
        testCount: question.tests.length,
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
    const { testId } = req.body;

    const question = await Question.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Check if test exists in question
    const testIndex = question.tests.indexOf(testId);
    if (testIndex === -1) {
      return res.status(400).json({
        success: false,
        message: "Question is not part of this test",
      });
    }

    question.tests.splice(testIndex, 1);
    await question.save();

    res.status(200).json({
      success: true,
      message: "Question removed from test successfully",
      data: {
        testCount: question.tests.length,
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

// Get question statistics
export const getQuestionStatistics = async (req, res) => {
  try {
    const totalQuestions = await Question.countDocuments({ isActive: true });

    const byDifficulty = await Question.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
    ]);

    const byType = await Question.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$questionType", count: { $sum: 1 } } },
    ]);

    const bySubject = await Question.aggregate([
      { $match: { isActive: true } },
      { $unwind: "$subject" },
      { $group: { _id: "$subject", count: { $sum: 1 } } },
    ]);

    const bySpecialization = await Question.aggregate([
      { $match: { isActive: true } },
      { $unwind: "$specialization" },
      { $group: { _id: "$specialization", count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      message: "Question statistics retrieved successfully",
      data: {
        totalQuestions,
        byDifficulty,
        byType,
        bySubject,
        bySpecialization,
      },
    });
  } catch (error) {
    console.error("Error fetching question statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Bulk upload questions via CSV
// Expected CSV headers (case-insensitive):
// title,questionType,educatorId,questionImage,subject,specialization,class,topics,A,B,C,D,correctOptions,difficulty,marksPositive,marksNegative,explanation,tags
export const bulkUploadQuestions = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res
        .status(400)
        .json({ success: false, message: "CSV file is required" });
    }

    const csvString = req.file.buffer.toString("utf8");

    const records = parse(csvString, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const created = [];
    const failed = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // considering header row

      try {
        // Normalize and map fields
        const title = row.title || row.Title || "";
        const questionType = (
          row.questionType ||
          row.QuestionType ||
          ""
        ).toLowerCase();
        const educatorId = row.educatorId || row.EducatorId || "";
        const questionImage = row.questionImage || row.QuestionImage || "";
        const subject = (row.subject || row.Subject || "")
          .split(/[,;|]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const specialization = (row.specialization || row.Specialization || "")
          .split(/[,;|]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const classArr = (row.class || row.Class || "")
          .split(/[,;|]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const topics = (row.topics || row.Topics || "")
          .split(/[,;|]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const options = {
          A: row.A || "",
          B: row.B || "",
          C: row.C || "",
          D: row.D || "",
        };
        let correctOptionsRaw =
          row.correctOptions ||
          row.CorrectOptions ||
          row.correct ||
          row.Correct ||
          "";
        // try parse JSON array/number or comma separated
        let correctOptions = correctOptionsRaw;
        try {
          if (correctOptionsRaw) {
            const trimmed = correctOptionsRaw.trim();
            if (
              (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
              (trimmed.startsWith("{") && trimmed.endsWith("}"))
            ) {
              correctOptions = JSON.parse(trimmed);
            } else if (trimmed.includes(",")) {
              correctOptions = trimmed
                .split(/[,;|]+/)
                .map((s) => s.trim())
                .filter(Boolean);
            } else if (/^-?\d+$/.test(trimmed)) {
              correctOptions = parseInt(trimmed, 10);
            } else {
              correctOptions = trimmed;
            }
          }
        } catch (e) {
          // leave as raw string
        }

        const difficulty = row.difficulty || row.Difficulty || "Medium";
        const marksPositive =
          parseFloat(
            row.marksPositive || row.MarksPositive || row.positive || "1"
          ) || 1;
        const marksNegative =
          parseFloat(
            row.marksNegative || row.MarksNegative || row.negative || "0"
          ) || 0;
        const explanation = row.explanation || row.Explanation || "";
        const tags = (row.tags || row.Tags || "")
          .split(/[,;|]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        // Basic validation
        if (!title) throw new Error("title is required");
        if (
          !["single-select", "multi-select", "integer"].includes(questionType)
        )
          throw new Error("invalid questionType");
        if (!educatorId) throw new Error("educatorId is required");
        if (!subject.length) throw new Error("subject is required");

        const questionObj = {
          title,
          questionType,
          educatorId,
          questionImage,
          subject,
          specialization,
          class: classArr,
          topics,
          options,
          correctOptions,
          difficulty,
          marks: { positive: marksPositive, negative: marksNegative },
          explanation,
          tags,
        };

        const createdQuestion = await Question.create(questionObj);

        if (educatorId) {
          await Educator.findByIdAndUpdate(educatorId, {
            $addToSet: { questions: createdQuestion._id },
          });
        }
        created.push({ row: rowNum, id: createdQuestion._id });
      } catch (err) {
        failed.push({ row: rowNum, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: "Bulk upload finished",
      data: {
        total: records.length,
        inserted: created.length,
        failed: failed.length,
        details: { created, failed },
      },
    });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
