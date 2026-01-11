import mongoose from "mongoose";
import bcrypt from "bcrypt";

const educatorSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      trim: true,
      minlength: [1, "Last name must be at least 1 character"],
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [3, "Full name must be at least 3 characters"],
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-z0-9_]+$/,
        "Username can only contain lowercase letters, numbers, and underscores",
      ],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Don't include password in queries by default
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, "Bio cannot exceed 1000 characters"],
    },
    specialization: [
      {
        type: String,
        enum: {
          values: ["IIT-JEE", "NEET", "CBSE"],
          message: "{VALUE} is not a valid specialization",
        },
        required: [true, "At least one specialization is required"],
      },
    ],
    class: [
      {
        type: String,
        enum: {
          values: [
            "class-6th",
            "class-7th",
            "class-8th",
            "class-9th",
            "class-10th",
            "class-11th",
            "class-12th",
            "dropper",
          ],
          message: "{VALUE} is not a valid class",
        },
        required: [true, "At least one class is required"],
      },
    ],
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      match: [
        /^[6-9]\d{9}$/,
        "Please provide a valid 10-digit Indian mobile number",
      ],
    },
    profilePicture: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      default: "educator",
      immutable: true,
    },
    image: {
      publicId: {
        type: String,
        trim: true,
        default: "",
      },
      url: {
        type: String,
        trim: true,
        default: "",
      },
    },
    introVideo: {
      type: String,
      trim: true,
      default: "",
    },
    introVideoVimeoUri: {
      type: String,
      trim: true,
      default: "",
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    payPerHourFee: {
      type: Number,
      min: [0, "Fee cannot be negative"],
      default: 0,
    },
    followers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Student",
        },
      ],
      default: [],
    },
    default: [],
    status: {
      type: String,
      enum: {
        values: ["active", "inactive"],
        message: "{VALUE} is not a valid status",
      },
      default: "active",
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: [0, "Rating cannot be less than 0"],
        max: [5, "Rating cannot be more than 5"],
      },
      count: {
        type: Number,
        default: 0,
        min: [0, "Rating count cannot be negative"],
      },
    },
    studentRatings: {
      type: [
        {
          student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
          },
          value: {
            type: Number,
            required: true,
            min: [0, "Rating cannot be less than 0"],
            max: [5, "Rating cannot be more than 5"],
          },
          ratedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    subject: [
      {
        type: String,
        enum: {
          values: [
            "biology",
            "physics",
            "mathematics",
            "chemistry",
            "english",
            "hindi",
          ],
          message: "{VALUE} is not a valid subject",
        },
        required: [true, "At least one subject is required"],
        lowercase: true,
        trim: true,
      },
    ],
    courses: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Course",
        },
      ],
      default: [],
    },
    webinars: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Webinar",
        },
      ],
      default: [],
    },
    testSeries: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TestSeries",
        },
      ],
      default: [],
    },
    posts: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Post",
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
    questions: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
        },
      ],
      default: [],
    },
    yoe: {
      type: Number,
      min: [0, "Years of experience cannot be negative"],
      max: [50, "Years of experience cannot exceed 50"],
      default: 0,
    },
    workExperience: [
      {
        title: { type: String, trim: true },
        company: { type: String, trim: true },
        startDate: { type: Date },
        endDate: { type: Date },
        description: { type: String, trim: true },
      },
    ],
    qualification: [
      {
        title: { type: String, trim: true },
        institute: { type: String, trim: true },
        startDate: { type: Date },
        endDate: { type: Date },
        description: { type: String, trim: true },
      },
    ],
    socials: {
      linkedin: { type: String, trim: true, default: "" },
      twitter: { type: String, trim: true, default: "" },
      facebook: { type: String, trim: true, default: "" },
      instagram: { type: String, trim: true, default: "" },
      youtube: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
    },
    bankDetails: {
      accountHolderName: {
        type: String,
        trim: true,
        default: "",
      },
      accountNumber: {
        type: String,
        trim: true,
        default: "",
      },
      ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
        match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Please provide a valid IFSC code"],
        default: "",
      },
      bankName: {
        type: String,
        trim: true,
        default: "",
      },
    },
    razorpayContactId: {
      type: String,
      trim: true,
      default: "",
      select: false, // Keep internal
    },
    razorpayFundAccountId: {
      type: String,
      trim: true,
      default: "",
      select: false, // Keep internal
    },
    revenue: {
      totalIncome: {
        type: Number,
        default: 0,
        min: [0, "Total income cannot be negative"],
      },
      incomePerCourse: {
        type: Map,
        of: Number,
        default: {},
      },
    },
    refreshTokens: {
      type: [
        {
          token: {
            type: String,
            required: true,
          },
          expiresAt: {
            type: Date,
            required: true,
          },
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

educatorSchema
  .virtual("introVideoLink")
  .get(function () {
    return this.introVideo;
  })
  .set(function (value) {
    this.introVideo = value;
  });

// Indexes for better query performance
// Note: username, email, and slug indexes are already created by unique: true in schema
educatorSchema.index({ specialization: 1 });
educatorSchema.index({ subject: 1 });
educatorSchema.index({ class: 1 });
educatorSchema.index({ status: 1 });
educatorSchema.index({ "rating.average": -1 });
educatorSchema.index({ fullName: "text", username: "text" });

// Ensure first/last name sync with full name
educatorSchema.pre("validate", function (next) {
  if (!this.fullName) {
    const parts = [this.firstName, this.lastName].filter(Boolean);
    if (parts.length) {
      this.fullName = parts.join(" ").trim();
    }
  }

  if (!this.firstName && this.fullName) {
    const [first = "", ...rest] = this.fullName.trim().split(/\s+/);
    this.firstName = first ? first.trim() : undefined;
    this.lastName = rest.length ? rest.join(" ").trim() : this.lastName;
  }

  next();
});

// Pre-save middleware to hash password
educatorSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified or is new
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to generate slug
educatorSchema.pre("save", function (next) {
  if (!this.slug && this.username) {
    this.slug = this.username
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

// Method to compare password
educatorSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error);
  }
};

// Method to generate slug from username
educatorSchema.methods.generateSlug = function () {
  return this.username
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Static method to find educators by specialization
educatorSchema.statics.findBySpecialization = function (specialization) {
  return this.find({
    specialization: {
      $in: Array.isArray(specialization) ? specialization : [specialization],
    },
    status: "active",
  });
};

// Static method to find educators by subject
educatorSchema.statics.findBySubject = function (subject) {
  return this.find({
    subject: { $in: Array.isArray(subject) ? subject : [subject] },
    status: "active",
  });
};

// Static method to find educators by class
educatorSchema.statics.findByClass = function (className) {
  return this.find({
    class: { $in: Array.isArray(className) ? className : [className] },
    status: "active",
  });
};

// Static method to find educators by minimum rating
educatorSchema.statics.findByMinRating = function (minRating) {
  return this.find({
    "rating.average": { $gte: minRating },
    status: "active",
  }).sort({ "rating.average": -1 });
};

// Static method to search educators by name or username
educatorSchema.statics.searchByName = function (searchTerm) {
  return this.find({
    $text: { $search: searchTerm },
    status: "active",
  }).select("score", { score: { $meta: "textScore" } });
};

// Virtual to get follower count
educatorSchema.virtual("followerCount").get(function () {
  return Array.isArray(this.followers) ? this.followers.length : 0;
});

// Virtual to get total courses count
educatorSchema.virtual("courseCount").get(function () {
  return Array.isArray(this.courses) ? this.courses.length : 0;
});

// Virtual to get total webinars count
educatorSchema.virtual("webinarCount").get(function () {
  return Array.isArray(this.webinars) ? this.webinars.length : 0;
});

// Virtual to get total test series count
educatorSchema.virtual("testSeriesCount").get(function () {
  return Array.isArray(this.testSeries) ? this.testSeries.length : 0;
});

// Virtual to get total tests count
educatorSchema.virtual("testCount").get(function () {
  return Array.isArray(this.tests) ? this.tests.length : 0;
});

// Virtual to get total questions count
educatorSchema.virtual("questionCount").get(function () {
  return Array.isArray(this.questions) ? this.questions.length : 0;
});

export default mongoose.model("Educator", educatorSchema);
