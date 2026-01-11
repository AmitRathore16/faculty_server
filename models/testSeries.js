import mongoose from "mongoose";

const testSeriesSchema = new mongoose.Schema({
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
    maxlength: 2000,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  validity: {
    type: Date,
    required: true,
  },
  numberOfTests: {
    type: Number,
    required: true,
    min: 1,
  },
  image: {
    type: String,
    required: false,
    trim: true,
  },
  educatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Educator",
    required: true,
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
  enrolledStudents: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
    default: [],
  },
  tests: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Test",
      },
    ],
    default: [],
  },
  isCourseSpecific: {
    type: Boolean,
    default: false,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: false,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  ratingCount: {
    type: Number,
    default: 0,
  },
  isActive: {
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

// Create indexes for better performance
testSeriesSchema.index({ educatorId: 1 });
testSeriesSchema.index({ specialization: 1 });
testSeriesSchema.index({ subject: 1 });
testSeriesSchema.index({ rating: -1 });
testSeriesSchema.index({ price: 1 });
testSeriesSchema.index({ courseId: 1 });
testSeriesSchema.index({ title: "text" });

// Pre-save middleware to update the updatedAt field
testSeriesSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-save middleware to generate slug if not provided
testSeriesSchema.pre("save", function (next) {
  if (!this.slug || this.isModified("title")) {
    this.slug = this.generateSlug();
  }
  next();
});

// Method to generate slug from title
testSeriesSchema.methods.generateSlug = function () {
  const baseSlug = this.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${baseSlug}-${Date.now()}`;
};

// Static method to find test series by educator
testSeriesSchema.statics.findByEducator = function (educatorId) {
  return this.find({ educatorId: educatorId, isActive: true });
};

// Static method to find test series by specialization
testSeriesSchema.statics.findBySpecialization = function (specialization) {
  return this.find({ specialization: specialization, isActive: true });
};

// Static method to find test series by subject
testSeriesSchema.statics.findBySubject = function (subject) {
  return this.find({ subject: subject, isActive: true });
};

// Static method to find test series by minimum rating
testSeriesSchema.statics.findByMinRating = function (minRating) {
  return this.find({ rating: { $gte: minRating }, isActive: true });
};

// Static method to find course-specific test series
testSeriesSchema.statics.findByCourse = function (courseId) {
  return this.find({
    courseId: courseId,
    isCourseSpecific: true,
    isActive: true,
  });
};

// Virtual to get enrolled student count
testSeriesSchema.virtual("enrolledCount").get(function () {
  const list = this.enrolledStudents || [];
  return Array.isArray(list) ? list.length : 0;
});

// Virtual to get test count
testSeriesSchema.virtual("testCount").get(function () {
  const list = this.tests || [];
  return Array.isArray(list) ? list.length : 0;
});

// Virtual to check if validity is expired
testSeriesSchema.virtual("isExpired").get(function () {
  return this.validity < new Date();
});

// Virtual to check if validity is active
testSeriesSchema.virtual("isValid").get(function () {
  return this.validity >= new Date();
});

// Ensure virtual fields are included in JSON output
testSeriesSchema.set("toJSON", { virtuals: true });
testSeriesSchema.set("toObject", { virtuals: true });

export default mongoose.model("TestSeries", testSeriesSchema);
