import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    questionType: {
      type: String,
      enum: ["single-select", "multi-select", "integer"],
      required: true,
    },
    educatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Educator",
      required: true,
    },
    questionImage: {
      type: String,
      trim: true,
    },
    subject: [
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
    specialization: [
      {
        type: String,
        enum: ["IIT-JEE", "NEET", "CBSE"],
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
    tests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Test",
      },
    ],
    topics: [
      {
        type: String,
        trim: true,
      },
    ],
    options: {
      A: { type: String, trim: true },
      B: { type: String, trim: true },
      C: { type: String, trim: true },
      D: { type: String, trim: true },
    },
    // correctOptions will be either String (for single), [String] for multi, or Number for integer
    correctOptions: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    marks: {
      positive: { type: Number, default: 1, min: 0 },
      negative: { type: Number, default: 0, min: 0 },
    },
    explanation: {
      type: String,
      trim: true,
      default: "",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
questionSchema.index({ subject: 1 });
questionSchema.index({ specialization: 1 });
questionSchema.index({ class: 1 });
questionSchema.index({ difficulty: 1 });
questionSchema.index({ questionType: 1 });
questionSchema.index({ tags: 1 });

// Pre-save: generate slug if not provided
questionSchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .substring(0, 120);
  }
  next();
});

// Static finders used by controllers
questionSchema.statics.findByEducator = function (educatorId) {
  return this.find({ educatorId, isActive: true });
};

questionSchema.statics.findBySubject = function (subject) {
  return this.find({
    subject: { $in: Array.isArray(subject) ? subject : [subject] },
    isActive: true,
  });
};

questionSchema.statics.findBySpecialization = function (specialization) {
  return this.find({
    specialization: {
      $in: Array.isArray(specialization) ? specialization : [specialization],
    },
    isActive: true,
  });
};

questionSchema.statics.findByDifficulty = function (difficulty) {
  return this.find({ difficulty, isActive: true });
};

questionSchema.statics.findByClass = function (className) {
  return this.find({
    class: { $in: Array.isArray(className) ? className : [className] },
    isActive: true,
  });
};

questionSchema.statics.findByTopics = function (topicsArray) {
  return this.find({ topics: { $in: topicsArray }, isActive: true });
};

questionSchema.statics.findByTags = function (tagsArray) {
  return this.find({ tags: { $in: tagsArray }, isActive: true });
};

// Virtuals
questionSchema.virtual("testCount").get(function () {
  return this.tests?.length || 0;
});

export default mongoose.model("Question", questionSchema);
