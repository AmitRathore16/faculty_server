import mongoose from "mongoose";

const SUBJECTS = [
    "biology",
    "physics",
    "mathematics",
    "chemistry",
    "english",
    "hindi"
];

const SPECIALIZATIONS = ["IIT-JEE", "NEET", "CBSE"];

const CLASS_LEVELS = [
    "class-6th",
    "class-7th",
    "class-8th",
    "class-9th",
    "class-10th",
    "class-11th",
    "class-12th",
    "dropper"
];

const liveClassSchema = new mongoose.Schema({
    educatorID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Educator",
      required: true,
      index: true,
    },
    isCourseSpecific: {
      type: Boolean,
      default: false,
    },
    assignInCourse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: function () {
        return this.isCourseSpecific;
      },
    },
    liveClassesFee: {
      type: Number,
      required: true,
      min: 0,
    },
    subject: {
        type: [{
            type: String,
            enum: SUBJECTS
        }],
        required: true,
        validate: {
            validator: (value) => Array.isArray(value) && value.length > 0,
            message: 'At least one subject is required'
        },
        index: true
    },
    liveClassSpecification: {
        type: [{
            type: String,
            enum: SPECIALIZATIONS
        }],
        required: true,
        validate: {
            validator: (value) => Array.isArray(value) && value.length > 0,
            message: 'At least one specialization is required'
        },
        index: true
    },
    introVideo: {
      type: String,
      trim: true,
    },
    classTiming: {
      type: Date,
      required: true,
    },
    classDuration: {
      type: Number, // Duration in minutes
      required: true,
      min: 1,
      max: 480, // Max 8 hours
    },
    liveClassTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    class: {
        type: [String],
                enum: CLASS_LEVELS,
        required: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    maxStudents: {
      type: Number,
      min: 1,
      default: 100,
    },
    enrolledStudents: [
      {
        studentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Student",
        },
        enrolledAt: {
          type: Date,
          default: Date.now,
        },
        attended: {
          type: Boolean,
          default: false,
        },
        attendanceTime: {
          type: Number, // in minutes
          default: 0,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    recordingURL: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to update the updatedAt field and auto-generate liveClassID
liveClassSchema.pre("save", function (next) {
  this.updatedAt = Date.now();

  // Auto-generate liveClassID if not provided
  if (!this.liveClassID) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.liveClassID = `LC-${timestamp}-${random}`;
  }

  next();
});

// Method to generate slug from title
liveClassSchema.methods.generateSlug = function () {
  return this.liveClassTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Static method to find live classes by educator
liveClassSchema.statics.findByEducator = function (educatorId) {
  return this.find({ educatorID: educatorId, isActive: true });
};

// Static method to find live classes by subject
liveClassSchema.statics.findBySubject = function(subject) {
    if (!subject) {
        return this.find({ isActive: true });
    }

    const subjects = Array.isArray(subject) ? subject : [subject];
    return this.find({ subject: { $in: subjects }, isActive: true });
};

// Static method to find live classes by specification
liveClassSchema.statics.findBySpecification = function(specification) {
    if (!specification) {
        return this.find({ isActive: true });
    }

    const specs = Array.isArray(specification) ? specification : [specification];
    return this.find({ liveClassSpecification: { $in: specs }, isActive: true });
};

// Static method to find live classes by class
liveClassSchema.statics.findByClass = function (className) {
  return this.find({
    class: { $in: Array.isArray(className) ? className : [className] },
    isActive: true,
  });
};

// Static method to find upcoming live classes
liveClassSchema.statics.findUpcoming = function () {
  return this.find({
    classTiming: { $gt: new Date() },
    isActive: true,
    isCompleted: false,
  }).sort({ classTiming: 1 });
};

// Static method to find course-specific live classes
liveClassSchema.statics.findCourseSpecific = function (courseId) {
  return this.find({
    isCourseSpecific: true,
    assignInCourse: courseId,
    isActive: true,
  });
};

// Virtual to get available seats
liveClassSchema.virtual("availableSeats").get(function () {
  const enrolledCount = this.enrolledStudents
    ? this.enrolledStudents.length
    : 0;
  return Math.max(0, this.maxStudents - enrolledCount);
});

// Virtual to check if class is full
liveClassSchema.virtual("isFull").get(function () {
  return this.availableSeats === 0;
});

// Virtual to check if class is ongoing
liveClassSchema.virtual("isOngoing").get(function () {
  const now = new Date();
  const classEnd = new Date(
    this.classTiming.getTime() + this.classDuration * 60000
  );
  return this.classTiming <= now && now <= classEnd;
});

// Virtual to check if class has started
liveClassSchema.virtual("hasStarted").get(function () {
  return new Date() >= this.classTiming;
});

// Virtual to get class end time
liveClassSchema.virtual("classEndTime").get(function () {
  return new Date(this.classTiming.getTime() + this.classDuration * 60000);
});

// Virtual to get attendance percentage
liveClassSchema.virtual("attendancePercentage").get(function () {
  if (!this.enrolledStudents || this.enrolledStudents.length === 0) return 0;

  const attendedCount = this.enrolledStudents.filter(
    (student) => student.attended
  ).length;
  return Math.round((attendedCount / this.enrolledStudents.length) * 100);
});

// Ensure virtual fields are included in JSON output
liveClassSchema.set("toJSON", { virtuals: true });
liveClassSchema.set("toObject", { virtuals: true });

// Pre-save validation
liveClassSchema.pre("validate", function (next) {
  // Ensure classTiming is in the future
  if (this.classTiming && this.classTiming <= new Date()) {
    const error = new Error("Class timing must be in the future");
    return next(error);
  }

  next();
});

// Pre-save middleware to auto-generate slug if not provided
liveClassSchema.pre("save", function (next) {
  if (!this.slug) {
    this.slug = this.generateSlug();
  }
  next();
});

// Method to enroll a student
liveClassSchema.methods.enrollStudent = function (studentId) {
  // Check if student is already enrolled
  const alreadyEnrolled = this.enrolledStudents.find(
    (student) => student.studentId.toString() === studentId.toString()
  );

  if (alreadyEnrolled) {
    throw new Error("Student is already enrolled in this live class");
  }

  // Check if class is full
  if (this.isFull) {
    throw new Error("Live class is full, cannot enroll more students");
  }

  this.enrolledStudents.push({ studentId });
  return this.save();
};

// Method to remove student enrollment
liveClassSchema.methods.removeStudent = function (studentId) {
  this.enrolledStudents = this.enrolledStudents.filter(
    (student) => student.studentId.toString() !== studentId.toString()
  );

  return this.save();
};

// Method to mark attendance
liveClassSchema.methods.markAttendance = function (
  studentId,
  attendanceTime = 0
) {
  const student = this.enrolledStudents.find(
    (s) => s.studentId.toString() === studentId.toString()
  );

  if (!student) {
    throw new Error("Student not enrolled in this live class");
  }

  student.attended = true;
  student.attendanceTime = attendanceTime;

  return this.save();
};

// Method to get live class statistics
liveClassSchema.methods.getLiveClassStats = function () {
  return {
    totalEnrolled: this.enrolledStudents.length,
    attendanceCount: this.enrolledStudents.filter((s) => s.attended).length,
    attendancePercentage: this.attendancePercentage,
    availableSeats: this.availableSeats,
    isFull: this.isFull,
    isOngoing: this.isOngoing,
    hasStarted: this.hasStarted,
    classEndTime: this.classEndTime,
  };
};

export default mongoose.model("LiveClass", liveClassSchema);
