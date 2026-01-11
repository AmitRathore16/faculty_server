import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

// npm run seed:admin to create super admin
const adminSchema = new mongoose.Schema(
  {
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
      select: false,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [3, "Full name must be at least 3 characters"],
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },
    role: {
      type: String,
      default: "admin",
      immutable: true,
      enum: ["admin"],
    },
    isSuperAdmin: {
      type: Boolean,
      default: true,
      required: true,
    },
    permissions: {
      type: [String],
      default: [
        "manage_educators",
        "manage_students",
        "manage_courses",
        "manage_webinars",
        "manage_tests",
        "view_analytics",
        "manage_payments",
      ],
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
    lastLogin: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries (email and username already indexed via unique: true)
adminSchema.index({ status: 1 });

// Pre-save middleware to hash password
adminSchema.pre("save", async function (next) {
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

// Method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Method to hash refresh token
adminSchema.methods.hashRefreshToken = function (token) {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// Method to add refresh token
adminSchema.methods.addRefreshToken = async function (token, expiresAt) {
  const hashedToken = this.hashRefreshToken(token);

  this.refreshTokens.push({
    token: hashedToken,
    expiresAt,
    createdAt: new Date(),
  });

  // Keep only the last 5 tokens
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }

  await this.save();
};

// Method to remove refresh token
adminSchema.methods.removeRefreshToken = async function (token) {
  const hashedToken = this.hashRefreshToken(token);

  this.refreshTokens = this.refreshTokens.filter(
    (rt) => rt.token !== hashedToken
  );

  await this.save();
};

// Method to validate refresh token
adminSchema.methods.validateRefreshToken = function (token) {
  const hashedToken = this.hashRefreshToken(token);

  return this.refreshTokens.some(
    (rt) => rt.token === hashedToken && rt.expiresAt > new Date()
  );
};

// Method to clean expired tokens
adminSchema.methods.cleanExpiredTokens = async function () {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter((rt) => rt.expiresAt > now);

  if (this.isModified("refreshTokens")) {
    await this.save();
  }
};

// Static method to find active admins
adminSchema.statics.findActiveAdmins = function () {
  return this.find({ status: "active" });
};

// Static method to find super admin
adminSchema.statics.findSuperAdmin = function () {
  return this.findOne({ isSuperAdmin: true, status: "active" });
};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
