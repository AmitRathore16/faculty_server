import mongoose from "mongoose";

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  subjects: [
    {
      type: String,
      enum: [
        "biology",
        "physics",
        "mathematics",
        "chemistry",
        "english",
        "hindi",
      ],
      required: true,
    },
  ],
  class: [
    {
      type: String,
      enum: [
        "class-6th",
        "class-7th",
        "class-8th",
        "class-9th",
        "class-10th",
        "class-11th",
        "class-12th",
        "dropper",
      ],
      required: true,
    },
  ],
  specialization: [
    {
      type: String,
      enum: ["IIT-JEE", "NEET", "CBSE"],
      required: true,
    },
  ],
  duration: {
    type: Number, // Duration in minutes
    required: true,
    min: 1,
  },
  overallMarks: {
    type: Number,
    required: true,
    min: 0,
  },
  markingType: {
    type: String,
    enum: ["overall", "per_question"],
    required: true,
    default: "per_question",
  },
  questions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
    },
  ],
  isTestSeriesSpecific: {
    type: Boolean,
    default: false,
  },
  testSeriesID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TestSeries",
    required: function () {
      return this.isTestSeriesSpecific;
    },
  },
  educatorID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Educator",
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // Additional fields for test management
  instructions: {
    type: String,
    trim: true,
    maxlength: 2000,
  },
  passingMarks: {
    type: Number,
    min: 0,
  },
  negativeMarking: {
    type: Boolean,
    default: false,
  },
  negativeMarkingRatio: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.25, // 25% negative marking by default
  },
  shuffleQuestions: {
    type: Boolean,
    default: false,
  },
  showResult: {
    type: Boolean,
    default: true,
  },
  allowReview: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for better performance (excluding slug which already has unique: true)
testSchema.index({ educatorID: 1 });
testSchema.index({ subjects: 1 });
testSchema.index({ specialization: 1 });
testSchema.index({ class: 1 });
testSchema.index({ testSeriesID: 1 });
testSchema.index({ isTestSeriesSpecific: 1 });
testSchema.index({ isActive: 1 });

// Pre-save middleware to update the updatedAt field
testSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to generate slug from title
testSchema.methods.generateSlug = function () {
  return this.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Static method to find tests by educator
testSchema.statics.findByEducator = function (educatorId) {
  return this.find({ educatorID: educatorId, isActive: true });
};

// Static method to find tests by subject
testSchema.statics.findBySubject = function (subject) {
  return this.find({
    subjects: { $in: Array.isArray(subject) ? subject : [subject] },
    isActive: true,
  });
};

// Static method to find tests by specialization
testSchema.statics.findBySpecialization = function (specialization) {
  return this.find({
    specialization: {
      $in: Array.isArray(specialization) ? specialization : [specialization],
    },
    isActive: true,
  });
};

// Static method to find tests by class
testSchema.statics.findByClass = function (className) {
  return this.find({
    class: { $in: Array.isArray(className) ? className : [className] },
    isActive: true,
  });
};

// Static method to find test series specific tests
testSchema.statics.findTestSeriesSpecific = function (testSeriesId) {
  const filter = { isTestSeriesSpecific: true, isActive: true };
  if (testSeriesId) {
    filter.testSeriesID = testSeriesId;
  }
  return this.find(filter);
};

// Static method to find standalone tests (not part of any test series)
testSchema.statics.findStandalone = function () {
  return this.find({ isTestSeriesSpecific: false, isActive: true });
};

// Virtual to get question count
testSchema.virtual("questionCount").get(function () {
  return this.questions ? this.questions.length : 0;
});

// Virtual to calculate average marks per question (only if per_question marking)
testSchema.virtual("averageMarksPerQuestion").get(function () {
  const questionCount = this.questions ? this.questions.length : 0;
  if (this.markingType === "per_question" && questionCount > 0) {
    return this.overallMarks / questionCount;
  }
  return this.overallMarks;
});

// Virtual to calculate estimated completion time (including buffer)
testSchema.virtual("estimatedCompletionTime").get(function () {
  // Add 10% buffer time
  return Math.ceil(this.duration * 1.1);
});

// Virtual to check if test has enough questions
testSchema.virtual("hasMinimumQuestions").get(function () {
  const questionCount = this.questions ? this.questions.length : 0;
  return questionCount >= 5; // Minimum 5 questions for a valid test
});

// Virtual to calculate difficulty distribution (would need question data populated)
testSchema.virtual("difficultyStats").get(function () {
  // This would be calculated when questions are populated
  return {
    easy: 0,
    medium: 0,
    hard: 0,
  };
});

// Ensure virtual fields are included in JSON output
testSchema.set("toJSON", { virtuals: true });
testSchema.set("toObject", { virtuals: true });

// Pre-save validation for testSeriesID
testSchema.pre("validate", function (next) {
  if (this.isTestSeriesSpecific && !this.testSeriesID) {
    const error = new Error(
      "Test Series ID is required when test is test series specific"
    );
    return next(error);
  }
  if (!this.isTestSeriesSpecific && this.testSeriesID) {
    // Clear testSeriesID if not test series specific
    this.testSeriesID = undefined;
  }

  // Validate passing marks
  if (this.passingMarks && this.passingMarks > this.overallMarks) {
    const error = new Error(
      "Passing marks cannot be greater than overall marks"
    );
    return next(error);
  }

  next();
});

// Pre-save middleware to auto-generate slug if not provided
testSchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = this.generateSlug();
  }
  next();
});

// Method to add question to test
testSchema.methods.addQuestion = function (questionId) {
  if (!this.questions.includes(questionId)) {
    this.questions.push(questionId);
  }
  return this.save();
};

// Method to remove question from test
testSchema.methods.removeQuestion = function (questionId) {
  const questionIndex = this.questions.indexOf(questionId);
  if (questionIndex > -1) {
    this.questions.splice(questionIndex, 1);
  }
  return this.save();
};

// Method to calculate total marks based on marking type
testSchema.methods.calculateTotalMarks = async function () {
  if (this.markingType === "overall") {
    return this.overallMarks;
  } else {
    // For per_question marking, we'd need to populate questions and sum their marks
    await this.populate("questions", "marks");
    return this.questions.reduce((total, question) => {
      return total + (question.marks?.positive || 0);
    }, 0);
  }
};

// Method to get test statistics
testSchema.methods.getTestStatistics = function () {
  return {
    totalQuestions: this.questions.length,
    duration: this.duration,
    totalMarks: this.overallMarks,
    passingMarks: this.passingMarks || 0,
    averageTimePerQuestion: Math.ceil(this.duration / this.questions.length),
    negativeMarking: this.negativeMarking,
    negativeMarkingRatio: this.negativeMarkingRatio,
  };
};

export default mongoose.model("Test", testSchema);
