import mongoose from "mongoose";

const webinarSchema = new mongoose.Schema({
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
  webinarType: {
    type: String,
    required: true,
    enum: ["one-to-one", "one-to-all"],
    default: "one-to-all",
    set: (value) => {
      if (value === "OTO") return "one-to-one";
      if (value === "OTA") return "one-to-all";
      return value;
    },
  },
  timing: {
    type: Date,
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
  fees: {
    type: Number,
    required: true,
    min: 0,
  },
  duration: {
    type: String,
    required: true,
    trim: true,
  },
  specialization: [
    {
      type: String,
      enum: ["IIT-JEE", "NEET", "CBSE"],
      required: true,
    },
  ],
  seatLimit: {
    type: Number,
    required: true,
    min: 1,
    max: 1000,
  },
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
  image: {
    type: String,
    required: false,
    trim: true,
  },
  educatorID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Educator",
    required: true,
  },
  studentEnrolled: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
    default: [],
  },
  default: [],
  webinarLink: {
    type: String,
    required: false,
    trim: true,
  },
  assetsLink: [
    {
      type: String,
      trim: true,
    },
  ],
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create index for better performance
webinarSchema.index({ timing: 1 });
webinarSchema.index({ educatorID: 1 });
webinarSchema.index({ subject: 1 });
webinarSchema.index({ specialization: 1 });

// Pre-save middleware to update the updatedAt field
webinarSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Method to generate slug from title
webinarSchema.methods.generateSlug = function () {
  return this.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Static method to find webinars by educator
webinarSchema.statics.findByEducator = function (educatorId) {
  return this.find({ educatorID: educatorId, isActive: true });
};

// Static method to find upcoming webinars
webinarSchema.statics.findUpcoming = function () {
  return this.find({
    timing: { $gte: new Date() },
    isActive: true,
  }).sort({ timing: 1 });
};

// Virtual to get enrolled student count
webinarSchema.virtual("enrolledCount").get(function () {
  const list = this.studentEnrolled || [];
  return Array.isArray(list) ? list.length : 0;
});

// Virtual to check if seats are available
webinarSchema.virtual("seatsAvailable").get(function () {
  const list = this.studentEnrolled || [];
  const count = Array.isArray(list) ? list.length : 0;
  return this.seatLimit - count;
});

// Virtual to check if webinar is full
webinarSchema.virtual("isFull").get(function () {
  const list = this.studentEnrolled || [];
  const count = Array.isArray(list) ? list.length : 0;
  return count >= this.seatLimit;
});

// Ensure virtual fields are included in JSON output
webinarSchema.set("toJSON", { virtuals: true });
webinarSchema.set("toObject", { virtuals: true });

export default mongoose.model("Webinar", webinarSchema);
