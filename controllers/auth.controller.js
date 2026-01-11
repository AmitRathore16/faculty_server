import { validationResult } from "express-validator";
import bcrypt from "bcrypt";
import Educator from "../models/educator.js";
import Student from "../models/student.js";
import Admin from "../models/admin.js";
import PasswordResetToken from "../models/passwordResetToken.js";
import {
  decodeToken,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} from "../util/token.js";
import { sendPasswordResetEmail } from "../util/email.js";
import {
  VALID_CLASSES,
  VALID_SPECIALIZATIONS,
  VALID_SUBJECTS,
} from "../util/validation.js";

const MAX_REFRESH_TOKENS = 5;
const OTP_EXPIRY_MINUTES = 5;
const OTP_THROTTLE_MS = 60 * 1000;

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000)
    .toString()
    .padStart(6, "0");

const sanitizeEducator = (educator) => {
  const data =
    typeof educator.toObject === "function"
      ? educator.toObject()
      : { ...educator };
  delete data.password;
  delete data.refreshTokens;
  if (typeof data.introVideo !== "undefined") {
    data.introVideoLink = data.introVideo;
  }
  return data;
};

const sanitizeStudent = (student) => {
  const data =
    typeof student.toObject === "function"
      ? student.toObject()
      : { ...student };
  delete data.password;
  return data;
};

const STUDENT_CLASS_SLUG_MAP = {
  "class-6th": "Class 6th",
  "class-7th": "Class 7th",
  "class-8th": "Class 8th",
  "class-9th": "Class 9th",
  "class-10th": "Class 10th",
  "class-11th": "Class 11th",
  "class-12th": "Class 12th",
  dropper: "Dropper",
};

const normalizeStudentClass = (value) => {
  if (!value || typeof value !== "string") return value;
  const normalizedKey = value.toLowerCase().replace(/\s+/g, "-");
  return STUDENT_CLASS_SLUG_MAP[normalizedKey] || value;
};

const SOCIAL_LINK_FIELDS = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin",
  "youtube",
  "website",
];

const DEFAULT_CLASS_OPTIONS = ["class-11th", "class-12th", "dropper"];

const normalizeString = (value = "") =>
  typeof value === "string" ? value.trim() : "";

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return value
      .split(/[,|\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeSpecializations = (value) => {
  const values = toArray(value).map((item) => item.toUpperCase());
  const invalid = values.filter(
    (item) => item && !VALID_SPECIALIZATIONS.includes(item)
  );
  return { values, invalid };
};

const normalizeSubjects = (value) => {
  const values = toArray(value).map((item) => item.toLowerCase());
  const invalid = values.filter(
    (item) => item && !VALID_SUBJECTS.includes(item)
  );
  return { values, invalid };
};

const normalizeClasses = (value) => {
  const values = toArray(value).map((item) => item.toLowerCase());
  const normalized = values.filter((item) => VALID_CLASSES.includes(item));
  const invalid = values.filter(
    (item) => item && !VALID_CLASSES.includes(item)
  );
  return { values: normalized, invalid };
};

const normalizeUsernameInput = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/(^_|_$)/g, "");

const generateUniqueUsername = async ({
  preferred,
  firstName,
  lastName,
  email,
}) => {
  const preferredNormalized = normalizeUsernameInput(preferred || "");
  if (preferredNormalized.length >= 3 && preferredNormalized.length <= 30) {
    const exists = await Educator.exists({ username: preferredNormalized });
    if (!exists) {
      return preferredNormalized;
    }
  }

  const baseCandidates = [
    `${firstName || ""}_${lastName || ""}`,
    email?.split("@")[0],
    "educator",
  ].map((candidate) => normalizeUsernameInput(candidate || ""));

  let base =
    baseCandidates.find((candidate) => candidate.length >= 3) ||
    `mentor_${Date.now()}`;
  base = base.slice(0, 20);

  let attempt = base;
  let counter = 0;
  while (await Educator.exists({ username: attempt })) {
    counter += 1;
    const suffix = counter.toString();
    const trimmedBase = base.slice(0, Math.max(1, 30 - suffix.length));
    attempt = `${trimmedBase}${suffix}`;
  }

  return attempt;
};

const parseDateValue = (value) => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const sanitizeExperienceArray = (entries = []) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry = {}) => ({
      title: normalizeString(entry.title),
      company: normalizeString(entry.company),
      startDate: parseDateValue(entry.startDate),
      endDate: parseDateValue(entry.endDate),
      description: normalizeString(entry.description),
    }))
    .filter(
      (entry) =>
        entry.title ||
        entry.company ||
        entry.description ||
        entry.startDate ||
        entry.endDate
    );
};

const sanitizeQualificationArray = (entries = []) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry = {}) => ({
      title: normalizeString(entry.title),
      institute: normalizeString(entry.institute),
      startDate: parseDateValue(entry.startDate),
      endDate: parseDateValue(entry.endDate),
      description: normalizeString(entry.description),
    }))
    .filter(
      (entry) =>
        entry.title || entry.institute || entry.description || entry.startDate
    );
};

const sanitizeSocialLinks = (socials = {}) => {
  if (typeof socials !== "object" || socials === null) {
    return {};
  }

  return SOCIAL_LINK_FIELDS.reduce((acc, key) => {
    const value = normalizeString(socials[key]);
    if (value) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

const calculateYOE = (experiences = []) => {
  const ranges = experiences
    .map((exp) => {
      if (!exp.startDate) {
        return null;
      }
      const start = exp.startDate instanceof Date ? exp.startDate : null;
      if (!start) {
        return null;
      }
      const end = exp.endDate instanceof Date ? exp.endDate : new Date();
      return { start, end };
    })
    .filter(Boolean);

  if (!ranges.length) {
    return 0;
  }

  const totalMonths = ranges.reduce((sum, range) => {
    const diff = range.end.getTime() - range.start.getTime();
    if (diff <= 0) {
      return sum;
    }
    return sum + diff / (1000 * 60 * 60 * 24 * 30.44);
  }, 0);

  return Math.min(50, Math.max(0, Math.round(totalMonths / 12)));
};

const buildFullName = (firstName, lastName) =>
  [firstName, lastName].filter(Boolean).join(" ").trim();

const respondWithValidationError = (res, message, errors = []) =>
  res.status(400).json({
    success: false,
    message,
    errors,
  });

const purgeExpiredTokens = async (educatorId) => {
  await Educator.findByIdAndUpdate(educatorId, {
    $pull: { refreshTokens: { expiresAt: { $lte: new Date() } } },
  });
};

const storeRefreshToken = async (educatorId, refreshToken) => {
  const decoded = decodeToken(refreshToken);
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tokenHash = hashToken(refreshToken);

  await Educator.findByIdAndUpdate(educatorId, {
    $pull: { refreshTokens: { token: tokenHash } },
  });

  await Educator.findByIdAndUpdate(educatorId, {
    $push: {
      refreshTokens: {
        $each: [
          {
            token: tokenHash,
            expiresAt,
          },
        ],
        $slice: -MAX_REFRESH_TOKENS,
      },
    },
  });
};

const issueTokens = async (educatorId) => {
  await purgeExpiredTokens(educatorId);

  const accessToken = generateAccessToken({
    sub: educatorId.toString(),
    role: "educator",
  });
  const refreshToken = generateRefreshToken({
    sub: educatorId.toString(),
    role: "educator",
  });

  await storeRefreshToken(educatorId, refreshToken);

  return { accessToken, refreshToken };
};

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array(),
    });
    return true;
  }
  return false;
};

export const signupEducator = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const {
      firstName,
      lastName,
      email,
      password,
      bio,
      specialization,
      class: classesInput,
      mobileNumber,
      introVideoLink,
      subject,
      workExperience,
      qualification,
      socials,
      username: preferredUsername,
    } = req.body;

    const normalizedFirstName = normalizeString(firstName);
    const normalizedLastName = normalizeString(lastName);
    const normalizedEmail = normalizeString(email).toLowerCase();
    const normalizedMobile = normalizeString(mobileNumber);
    const normalizedPreferredUsername = normalizeUsernameInput(
      preferredUsername || ""
    );

    const duplicateQuery = [
      { email: normalizedEmail },
      { mobileNumber: normalizedMobile },
    ];

    if (normalizedPreferredUsername) {
      duplicateQuery.push({ username: normalizedPreferredUsername });
    }

    const existingEducator = await Educator.findOne({
      $or: duplicateQuery,
    });

    if (existingEducator) {
      let field = "educator";
      if (existingEducator.email === normalizedEmail) field = "email";
      else if (
        normalizedPreferredUsername &&
        existingEducator.username === normalizedPreferredUsername
      )
        field = "username";
      else if (existingEducator.mobileNumber === normalizedMobile)
        field = "mobile number";

      return respondWithValidationError(
        res,
        `An educator with this ${field} already exists`
      );
    }

    const { values: specializationValues, invalid: invalidSpecializations } =
      normalizeSpecializations(specialization);

    if (invalidSpecializations.length) {
      return respondWithValidationError(
        res,
        "Invalid specialization provided",
        invalidSpecializations
      );
    }

    if (!specializationValues.length) {
      return respondWithValidationError(
        res,
        "At least one specialization is required"
      );
    }

    const { values: subjectValues, invalid: invalidSubjects } =
      normalizeSubjects(subject);

    if (invalidSubjects.length) {
      return respondWithValidationError(
        res,
        "Invalid subjects provided",
        invalidSubjects
      );
    }

    if (!subjectValues.length) {
      return respondWithValidationError(
        res,
        "At least one subject is required"
      );
    }

    const { values: classValues, invalid: invalidClasses } =
      normalizeClasses(classesInput);

    if (invalidClasses.length) {
      return respondWithValidationError(
        res,
        "Invalid classes provided",
        invalidClasses
      );
    }

    const sanitizedWorkExperience = sanitizeExperienceArray(workExperience);
    const sanitizedQualification = sanitizeQualificationArray(qualification);
    const sanitizedSocials = sanitizeSocialLinks(socials);

    const username = await generateUniqueUsername({
      preferred: normalizedPreferredUsername,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
    });

    const fullName =
      buildFullName(normalizedFirstName, normalizedLastName) || username;

    const normalizedBio = normalizeString(bio);

    const educatorData = {
      firstName: normalizedFirstName || undefined,
      lastName: normalizedLastName || undefined,
      fullName,
      username,
      email: normalizedEmail,
      password,
      specialization: specializationValues,
      class: classValues.length ? classValues : DEFAULT_CLASS_OPTIONS,
      mobileNumber: normalizedMobile,
      bio: normalizedBio,
      description: normalizedBio,
      subject: subjectValues,
      workExperience: sanitizedWorkExperience,
      qualification: sanitizedQualification,
    };

    if (Object.keys(sanitizedSocials).length) {
      educatorData.socials = sanitizedSocials;
    }

    const calculatedYOE = calculateYOE(sanitizedWorkExperience);
    if (calculatedYOE > 0) {
      educatorData.yoe = calculatedYOE;
    }

    if (introVideoLink) {
      educatorData.introVideo = normalizeString(introVideoLink);
    }

    const educator = new Educator(educatorData);

    await educator.save();

    const tokens = await issueTokens(educator._id);
    const educatorDataResponse = sanitizeEducator(educator);

    res.status(201).json({
      success: true,
      message: "Signup successful",
      data: {
        educator: educatorDataResponse,
        tokens,
      },
    });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const loginEducator = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { email, password } = req.body;

    const educator = await Educator.findOne({ email }).select("+password");

    if (!educator) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await educator.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const tokens = await issueTokens(educator._id);
    const educatorData = sanitizeEducator(educator);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        educator: educatorData,
        tokens,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const signupStudent = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const {
      name,
      username,
      password,
      mobileNumber,
      email,
      address,
      image,
      specialization,
      class: classInput,
      deviceToken,
      preferences,
    } = req.body;

    const normalizedName = normalizeString(name);
    const normalizedUsername = normalizeUsernameInput(username);
    const normalizedEmail = normalizeString(email).toLowerCase();
    const normalizedMobile = normalizeString(mobileNumber);
    const normalizedClass = normalizeStudentClass(classInput);

    const existingStudent = await Student.findOne({
      $or: [
        { email: normalizedEmail },
        { username: normalizedUsername },
        { mobileNumber: normalizedMobile },
      ],
    });

    if (existingStudent) {
      return respondWithValidationError(
        res,
        "Student with this email, username, or mobile number already exists"
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = new Student({
      name: normalizedName,
      username: normalizedUsername,
      password: hashedPassword,
      mobileNumber: normalizedMobile,
      email: normalizedEmail,
      address,
      image,
      specialization,
      class: normalizedClass,
      deviceToken,
      preferences,
    });

    await student.save();

    const token = generateAccessToken({
      sub: student._id.toString(),
      role: "student",
    });

    res.status(201).json({
      success: true,
      message: "Signup successful",
      student: sanitizeStudent(student),
      TOKEN: token,
      userType: "student",
    });
  } catch (error) {
    console.error("Error during student signup:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const loginStudent = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { email, password } = req.body;
    const normalizedEmail = email?.toLowerCase();

    const student = await Student.findOne({ email: normalizedEmail }).select(
      "+password"
    );

    if (!student) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!student.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact support.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, student.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateAccessToken({
      sub: student._id.toString(),
      role: "student",
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: sanitizeStudent(student),
      TOKEN: token,
    });
  } catch (error) {
    console.error("Error during student login:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { email, userType } = req.body;
    const normalizedEmail = email?.toLowerCase?.();
    const role = (userType || "").toLowerCase();
    const isEducator = role === "educator";
    const Model = isEducator ? Educator : Student;
    const userModelName = isEducator ? "Educator" : "Student";

    const user = await Model.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const existingToken = await PasswordResetToken.findOne({
      email: normalizedEmail,
      role,
    });

    const now = Date.now();

    if (existingToken) {
      if (existingToken.expiresAt && existingToken.expiresAt <= new Date(now)) {
        await PasswordResetToken.deleteOne({ _id: existingToken._id });
      } else if (
        existingToken.updatedAt &&
        now - existingToken.updatedAt.getTime() < OTP_THROTTLE_MS
      ) {
        return res.status(429).json({
          success: false,
          message:
            "OTP already sent. Please wait a minute before requesting again.",
        });
      }
    }

    const otp = generateOtp();
    const otpHash = hashToken(otp);
    const expiresAt = new Date(now + OTP_EXPIRY_MINUTES * 60 * 1000);

    await PasswordResetToken.findOneAndUpdate(
      { email: normalizedEmail, role },
      {
        email: normalizedEmail,
        role,
        user: user._id,
        userModel: userModelName,
        otpHash,
        expiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendPasswordResetEmail({ to: normalizedEmail, otp, userType: role });

    res.status(200).json({
      success: true,
      message: "OTP sent to registered email",
    });
  } catch (error) {
    console.error("Error during password reset request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { email, userType, otp, newPassword } = req.body;
    const normalizedEmail = email?.toLowerCase?.();
    const role = (userType || "").toLowerCase();

    const tokenDoc = await PasswordResetToken.findOne({
      email: normalizedEmail,
      role,
    });

    if (!tokenDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    const now = new Date();
    if (tokenDoc.expiresAt <= now) {
      await PasswordResetToken.deleteOne({ _id: tokenDoc._id });
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one.",
      });
    }

    const hashedOtp = hashToken(otp);
    if (hashedOtp !== tokenDoc.otpHash) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const isEducator = role === "educator";
    const Model = isEducator ? Educator : Student;
    const userQuery = Model.findOne({ email: normalizedEmail });
    if (isEducator) {
      userQuery.select("+password");
    }

    const user = await userQuery;

    if (!user) {
      await PasswordResetToken.deleteOne({ _id: tokenDoc._id });
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    if (isEducator) {
      user.password = newPassword;
      await user.save();
    } else {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();
    }

    await PasswordResetToken.deleteOne({ _id: tokenDoc._id });

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Error during password reset:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const refreshEducatorToken = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { refreshToken } = req.body;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const hashedToken = hashToken(refreshToken);
    const educator = await Educator.findById(payload.sub).select(
      "+refreshTokens"
    );

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const storedToken = (educator.refreshTokens || []).find(
      (item) => item.token === hashedToken
    );

    if (!storedToken || storedToken.expiresAt <= new Date()) {
      await purgeExpiredTokens(educator._id);
      return res.status(401).json({
        success: false,
        message: "Refresh token expired or invalid",
      });
    }

    await Educator.findByIdAndUpdate(educator._id, {
      $pull: { refreshTokens: { token: hashedToken } },
    });

    const tokens = await issueTokens(educator._id);
    const educatorData = sanitizeEducator(educator);

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        educator: educatorData,
        tokens,
      },
    });
  } catch (error) {
    console.error("Error during token refresh:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const logoutEducator = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { refreshToken } = req.body;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(200).json({
        success: true,
        message: "Logged out",
      });
    }

    const hashedToken = hashToken(refreshToken);

    await Educator.findByIdAndUpdate(payload.sub, {
      $pull: { refreshTokens: { token: hashedToken } },
    });

    res.status(200).json({
      success: true,
      message: "Logged out",
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getCurrentEducatorProfile = async (req, res) => {
  try {
    const educator = req.educator;

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Educator profile fetched",
      data: {
        educator: sanitizeEducator(educator),
      },
    });
  } catch (error) {
    console.error("Error fetching educator profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ==================== Admin Authentication ====================

const sanitizeAdmin = (admin) => {
  const data =
    typeof admin.toObject === "function" ? admin.toObject() : { ...admin };
  delete data.password;
  delete data.refreshTokens;
  return data;
};

const storeAdminRefreshToken = async (adminId, refreshToken) => {
  const decoded = decodeToken(refreshToken);
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tokenHash = hashToken(refreshToken);

  await Admin.findByIdAndUpdate(adminId, {
    $pull: { refreshTokens: { token: tokenHash } },
  });

  await Admin.findByIdAndUpdate(adminId, {
    $push: {
      refreshTokens: {
        $each: [
          {
            token: tokenHash,
            expiresAt,
          },
        ],
        $slice: -MAX_REFRESH_TOKENS,
      },
    },
  });
};

const issueAdminTokens = async (adminId) => {
  const accessToken = generateAccessToken({
    sub: adminId.toString(),
    role: "admin",
  });
  const refreshToken = generateRefreshToken({
    sub: adminId.toString(),
    role: "admin",
  });

  await storeAdminRefreshToken(adminId, refreshToken);

  return { accessToken, refreshToken };
};

export const adminLogin = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { email, password } = req.body;

    const admin = await Admin.findOne({ email }).select(
      "+password +refreshTokens"
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (admin.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Admin account is inactive",
      });
    }

    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    const { accessToken, refreshToken } = await issueAdminTokens(admin._id);

    res.status(200).json({
      success: true,
      message: "Admin logged in successfully",
      data: {
        admin: sanitizeAdmin(admin),
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const adminSignup = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    // Check if super admin already exists
    const existingSuperAdmin = await Admin.findOne({ isSuperAdmin: true });
    if (existingSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Super admin already exists. Only one super admin is allowed.",
      });
    }

    const { username, email, password, fullName } = req.body;

    // Check for existing admin with same email or username
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { username }],
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: "Admin with this email or username already exists",
      });
    }

    const admin = new Admin({
      username,
      email,
      password,
      fullName,
      isSuperAdmin: true,
      status: "active",
    });

    await admin.save();

    const { accessToken, refreshToken } = await issueAdminTokens(admin._id);

    res.status(201).json({
      success: true,
      message: "Super admin created successfully",
      data: {
        admin: sanitizeAdmin(admin),
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Error during admin signup:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const logoutAdmin = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { refreshToken } = req.body;

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(200).json({
        success: true,
        message: "Logged out",
      });
    }

    const hashedToken = hashToken(refreshToken);

    await Admin.findByIdAndUpdate(payload.sub, {
      $pull: { refreshTokens: { token: hashedToken } },
    });

    res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    console.error("Error during admin logout:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getCurrentAdminProfile = async (req, res) => {
  try {
    const admin = req.admin;

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin profile fetched",
      data: {
        admin: sanitizeAdmin(admin),
      },
    });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
