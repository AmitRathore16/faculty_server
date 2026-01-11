import { body, param, query } from "express-validator";
import { STUDY_MATERIAL_FILE_TYPES } from "./constants.js";
import { isVimeoEmbedUrl } from "./vimeo.js";
import {
  MAX_STUDY_MATERIAL_FILE_SIZE,
  determineStudyMaterialFileType,
  normalizeSingleValue,
  sanitizeArrayPayload,
} from "./studyMaterial.js";

// ==================== Common Validators ====================

// MongoDB ObjectId validator
export const validateObjectId = (field = "id") => [
  param(field).isMongoId().withMessage(`Invalid ${field} format`),
];

// Slug validator
export const validateSlug = [
  param("slug")
    .notEmpty()
    .withMessage("Slug is required")
    .matches(/^[a-z0-9-]+$/)
    .withMessage("Invalid slug format"),
];

// Username validator
export const validateUsername = [
  param("username")
    .notEmpty()
    .withMessage("Username is required")
    .matches(/^[a-z0-9_]+$/)
    .withMessage("Invalid username format"),
];

// ID validator (shorthand for ObjectId)
export const validateId = [
  param("id").isMongoId().withMessage("Invalid ID format"),
];

// ==================== Enums ====================

export const VALID_SPECIALIZATIONS = ["IIT-JEE", "NEET", "CBSE"];
export const VALID_SUBJECTS = [
  "biology",
  "physics",
  "mathematics",
  "chemistry",
  "english",
  "hindi",
];
export const VALID_CLASSES = [
  "class-6th",
  "class-7th",
  "class-8th",
  "class-9th",
  "class-10th",
  "class-11th",
  "class-12th",
  "dropper",
];
export const VALID_WEBINAR_TYPES = ["one-to-one", "one-to-all"];
export const VALID_STATUS = ["active", "inactive"];
export const VALID_QUESTION_TYPES = [
  "single-select",
  "multi-select",
  "integer",
];
export const VALID_DIFFICULTY_LEVELS = ["Easy", "Medium", "Hard"];
export const VALID_OPTIONS = ["A", "B", "C", "D"];
export const VALID_PAYMENT_PRODUCTS = [
  "course",
  "testSeries",
  "webinar",
  "liveClass",
];

// ==================== Custom Validators ====================

// Validate specialization array
export const validateSpecialization = (isOptional = false) => {
  const validator = body("specialization");

  if (isOptional) {
    return validator
      .optional()
      .isArray({ min: 1 })
      .withMessage("At least one specialization must be selected")
      .custom((specializations) => {
        if (specializations && specializations.length > 0) {
          const invalidSpecializations = specializations.filter(
            (spec) => !VALID_SPECIALIZATIONS.includes(spec)
          );
          if (invalidSpecializations.length > 0) {
            throw new Error(
              `Invalid specializations: ${invalidSpecializations.join(", ")}`
            );
          }
        }
        return true;
      });
  }

  return validator
    .isArray({ min: 1 })
    .withMessage("At least one specialization must be selected")
    .custom((specializations) => {
      const invalidSpecializations = specializations.filter(
        (spec) => !VALID_SPECIALIZATIONS.includes(spec)
      );
      if (invalidSpecializations.length > 0) {
        throw new Error(
          `Invalid specializations: ${invalidSpecializations.join(", ")}`
        );
      }
      return true;
    });
};

// Validate subject array
export const validateSubject = (isOptional = false) => {
  const validator = body("subject");

  if (isOptional) {
    return validator
      .optional()
      .isArray({ min: 1 })
      .withMessage("At least one subject must be selected")
      .custom((subjects) => {
        if (subjects && subjects.length > 0) {
          const invalidSubjects = subjects.filter((sub) => {
            if (!sub) return true;
            return !VALID_SUBJECTS.includes(sub.toLowerCase());
          });
          if (invalidSubjects.length > 0) {
            throw new Error(`Invalid subjects: ${invalidSubjects.join(", ")}`);
          }
        }
        return true;
      });
  }

  return validator
    .isArray({ min: 1 })
    .withMessage("At least one subject must be selected")
    .custom((subjects) => {
      const invalidSubjects = subjects.filter((sub) => {
        if (!sub) return true;
        return !VALID_SUBJECTS.includes(sub.toLowerCase());
      });
      if (invalidSubjects.length > 0) {
        throw new Error(`Invalid subjects: ${invalidSubjects.join(", ")}`);
      }
      return true;
    });
};

// Validate class array
export const validateClass = (isOptional = false) => {
  const validator = body("class");

  if (isOptional) {
    return validator
      .optional()
      .isArray({ min: 1 })
      .withMessage("At least one class must be selected")
      .custom((classes) => {
        if (classes && classes.length > 0) {
          const invalidClasses = classes.filter(
            (cls) => !VALID_CLASSES.includes(cls)
          );
          if (invalidClasses.length > 0) {
            throw new Error(`Invalid classes: ${invalidClasses.join(", ")}`);
          }
        }
        return true;
      });
  }

  return validator
    .isArray({ min: 1 })
    .withMessage("At least one class must be selected")
    .custom((classes) => {
      const invalidClasses = classes.filter(
        (cls) => !VALID_CLASSES.includes(cls)
      );
      if (invalidClasses.length > 0) {
        throw new Error(`Invalid classes: ${invalidClasses.join(", ")}`);
      }
      return true;
    });
};

// Validate mobile number
export const validateMobileNumber = (isOptional = false) => {
  const validator = body("mobileNumber")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please provide a valid 10-digit Indian mobile number");

  if (isOptional) {
    return validator.optional();
  }

  return validator
    .notEmpty()
    .withMessage("Mobile number is required")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please provide a valid 10-digit Indian mobile number");
};

// Validate email
export const validateEmail = (isOptional = false) => {
  const validator = body("email")
    .isEmail()
    .withMessage("Please provide a valid email address");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Email is required");
};

// Validate password with strong requirements
export const validatePassword = (isOptional = false) => {
  const validator = body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    );

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Password is required");
};

// Validate URL
export const validateURL = (field, isOptional = true) => {
  const validator = body(field)
    .isURL()
    .withMessage(`${field} must be a valid URL`);

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage(`${field} is required`);
};

export const validateVimeoEmbed = (field = "introVideo", isOptional = true) => {
  const validator = body(field).custom((value) => {
    if (!isVimeoEmbedUrl(value)) {
      throw new Error(
        `${field} must be a Vimeo embed URL (https://player.vimeo.com/video/{id})`
      );
    }
    return true;
  });

  if (isOptional) {
    return [validator.optional({ checkFalsy: true })];
  }

  return [validator.notEmpty().withMessage(`${field} is required`)];
};

// Validate username field
export const validateUsernameField = (isOptional = false) => {
  const validator = body("username")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-z0-9_]+$/)
    .withMessage(
      "Username can only contain lowercase letters, numbers, and underscores"
    );

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Username is required");
};

// Validate full name
export const validateFullName = (isOptional = false) => {
  const validator = body("fullName")
    .isLength({ min: 3, max: 100 })
    .withMessage("Full name must be between 3 and 100 characters");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Full name is required");
};

// Validate description
export const validateDescription = [
  body("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
];

// Validate rating
export const validateRating = [
  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isFloat({ min: 0, max: 5 })
    .withMessage("Rating must be between 0 and 5"),
];

// Validate status
export const validateStatus = [
  body("status")
    .optional()
    .isIn(VALID_STATUS)
    .withMessage("Status must be either active or inactive"),
];

// Validate years of experience
export const validateYOE = (isOptional = false) => {
  const validator = body("yoe")
    .isInt({ min: 0, max: 50 })
    .withMessage("Years of experience must be between 0 and 50");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Years of experience is required");
};

// Validate pay per hour fee
export const validatePayPerHourFee = (isOptional = false) => {
  const validator = body("payPerHourFee")
    .isNumeric()
    .withMessage("Fee must be a number")
    .isFloat({ min: 0 })
    .withMessage("Fee must be greater than or equal to 0");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Pay per hour fee is required");
};

// Validate bank details
export const validateBankDetails = [
  body("bankDetails.accountHolderName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Account holder name cannot exceed 100 characters"),

  body("bankDetails.accountNumber")
    .optional()
    .trim()
    .matches(/^\d{9,18}$/)
    .withMessage("Account number must be between 9 and 18 digits"),

  body("bankDetails.ifscCode")
    .optional()
    .trim()
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage("Please provide a valid IFSC code"),

  body("bankDetails.bankName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Bank name cannot exceed 100 characters"),
];

// Validate student ID in body
export const validateStudentId = [
  body("studentId")
    .notEmpty()
    .withMessage("Student ID is required")
    .isMongoId()
    .withMessage("Invalid student ID format"),
];

// ==================== Auth Validators ====================

const parseValues = (value) => {
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

export const educatorSignupValidation = [
  body("firstName")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  body("lastName")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Last name must be between 1 and 50 characters"),
  validateEmail(),
  validatePassword(),
  validateMobileNumber(),
  body("bio")
    .trim()
    .notEmpty()
    .withMessage("Bio is required")
    .isLength({ min: 20, max: 1000 })
    .withMessage("Bio must be between 20 and 1000 characters"),
  body("specialization")
    .notEmpty()
    .withMessage("Specialization is required")
    .custom((value) => {
      const values = parseValues(value).map((item) => item.toUpperCase());
      if (!values.length) {
        throw new Error("Specialization is required");
      }
      const invalidValues = values.filter(
        (item) => item && !VALID_SPECIALIZATIONS.includes(item)
      );
      if (invalidValues.length) {
        throw new Error(`Invalid specialization: ${invalidValues.join(", ")}`);
      }
      return true;
    }),
  body("subject")
    .notEmpty()
    .withMessage("Subject is required")
    .custom((value) => {
      const values = parseValues(value).map((item) => item.toLowerCase());
      if (!values.length) {
        throw new Error("Subject is required");
      }
      const invalidValues = values.filter(
        (item) => item && !VALID_SUBJECTS.includes(item)
      );
      if (invalidValues.length) {
        throw new Error(`Invalid subject: ${invalidValues.join(", ")}`);
      }
      return true;
    }),
  body("class")
    .optional()
    .custom((value) => {
      const values = parseValues(value).map((item) => item.toLowerCase());
      const invalidValues = values.filter(
        (item) => item && !VALID_CLASSES.includes(item)
      );
      if (invalidValues.length) {
        throw new Error(`Invalid class: ${invalidValues.join(", ")}`);
      }
      return true;
    }),
  body("workExperience")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Work experience must be an array"),
  body("qualification")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Qualification must be an array"),
  body("socials")
    .optional()
    .isObject()
    .withMessage("Social links must be an object"),
  validateURL("introVideoLink"),
];

export const educatorLoginValidation = [
  validateEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export const studentLoginValidation = [
  validateEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

export const validateRefreshTokenBody = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

export const passwordResetRequestValidation = [
  validateEmail(),
  body("userType")
    .isIn(["student", "educator"])
    .withMessage("userType must be student or educator")
    .customSanitizer((value) =>
      typeof value === "string" ? value.toLowerCase() : value
    ),
];

export const passwordResetConfirmValidation = [
  validateEmail(),
  body("userType")
    .isIn(["student", "educator"])
    .withMessage("userType must be student or educator")
    .customSanitizer((value) =>
      typeof value === "string" ? value.toLowerCase() : value
    ),
  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must be numeric"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
];

// ==================== Webinar Validators ====================

// Validate webinar title
export const validateWebinarTitle = (isOptional = false) => {
  const validator = body("title")
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Title is required");
};

// Validate webinar description
export const validateWebinarDescription = (isOptional = false) => {
  const validator = body("description")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10 and 1000 characters");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Description is required");
};

// Validate webinar type
export const validateWebinarType = (isOptional = false) => {
  const validator = body("webinarType")
    .customSanitizer((value) => {
      if (typeof value === "string") {
        if (value === "OTO") return "one-to-one";
        if (value === "OTA") return "one-to-all";
      }
      return value;
    })
    .isIn(VALID_WEBINAR_TYPES)
    .withMessage('Webinar type must be either "one-to-one" or "one-to-all"');

  if (isOptional) {
    return validator.optional();
  }

  return validator;
};

// Validate webinar timing
export const validateWebinarTiming = (isOptional = false) => {
  const validator = body("timing")
    .isISO8601()
    .withMessage("Invalid date format for timing")
    .custom((value) => {
      if (value && new Date(value) <= new Date()) {
        throw new Error("Webinar timing must be in the future");
      }
      return true;
    });

  if (isOptional) {
    return validator.optional();
  }

  return validator;
};

// Validate webinar fees
export const validateWebinarFees = (isOptional = false) => {
  const validator = body("fees")
    .isNumeric()
    .withMessage("Fees must be a number")
    .isFloat({ min: 0 })
    .withMessage("Fees must be greater than or equal to 0");

  if (isOptional) {
    return validator.optional();
  }

  return validator;
};

// Validate webinar duration
export const validateWebinarDuration = [
  body("duration")
    .notEmpty()
    .withMessage("Duration is required")
    .isLength({ min: 1, max: 50 })
    .withMessage("Duration must be between 1 and 50 characters"),
];

// Validate seat limit
export const validateSeatLimit = (isOptional = false) => {
  const validator = body("seatLimit")
    .isInt({ min: 1, max: 1000 })
    .withMessage("Seat limit must be between 1 and 1000");

  if (isOptional) {
    return validator.optional();
  }

  return validator;
};

// Validate educator ID
export const validateEducatorId = [
  body("educatorID")
    .notEmpty()
    .withMessage("Educator ID is required")
    .isMongoId()
    .withMessage("Invalid educator ID format"),
];

// Validate webinar image
export const validateWebinarImage = [
  body("image").optional().isURL().withMessage("Image must be a valid URL"),
];

// Validate webinar link
export const validateWebinarLink = [
  body("webinarLink")
    .optional()
    .isURL()
    .withMessage("Webinar link must be a valid URL"),
];

// Validate assets link
export const validateAssetsLink = [
  body("assetsLink")
    .optional()
    .isArray()
    .withMessage("Assets link must be an array")
    .custom((links) => {
      if (links && links.length > 0) {
        const invalidLinks = links.filter(
          (link) => !/^https?:\/\/.+/.test(link)
        );
        if (invalidLinks.length > 0) {
          throw new Error("All asset links must be valid URLs");
        }
      }
      return true;
    }),
];

// ==================== Param Validators ====================

// Validate specialization param
export const validateSpecializationParam = [
  param("specialization")
    .isIn(VALID_SPECIALIZATIONS)
    .withMessage("Invalid specialization"),
];

// Validate subject param
export const validateSubjectParam = [
  param("subject").isIn(VALID_SUBJECTS).withMessage("Invalid subject"),
];

// Validate class param
export const validateClassParam = [
  param("className").isIn(VALID_CLASSES).withMessage("Invalid class"),
];

// Validate rating param
export const validateRatingParam = [
  param("minRating")
    .isFloat({ min: 0, max: 5 })
    .withMessage("Rating must be between 0 and 5"),
];

// Validate educator ID param
export const validateEducatorIdParam = [
  param("educatorId").isMongoId().withMessage("Invalid educator ID format"),
];

// ==================== Revenue Validator ====================

export const validateRevenue = [
  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 0 })
    .withMessage("Amount must be greater than 0"),
  body("courseId")
    .optional()
    .isMongoId()
    .withMessage("Invalid course ID format"),
];

// ==================== Question Validators ====================

// Validate question title
export const validateQuestionTitle = (isOptional = false) => {
  const validator = body("title")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Question title must be between 10 and 2000 characters");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Question title is required");
};

// Validate question type
export const validateQuestionType = (isOptional = false) => {
  const validator = body("questionType")
    .isIn(VALID_QUESTION_TYPES)
    .withMessage(
      "Question type must be one of: single-select, multi-select, integer"
    );

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Question type is required");
};

// Validate question image
export const validateQuestionImage = [
  body("questionImage")
    .optional()
    .isURL()
    .withMessage("Question image must be a valid URL"),
];

// Validate topics array
export const validateTopics = (isOptional = false) => {
  const validator = body("topics")
    .isArray({ min: 1 })
    .withMessage("At least one topic is required")
    .custom((topics) => {
      if (topics && topics.length > 0) {
        const invalidTopics = topics.filter(
          (topic) => typeof topic !== "string" || topic.trim().length === 0
        );
        if (invalidTopics.length > 0) {
          throw new Error("All topics must be non-empty strings");
        }
      }
      return true;
    });

  if (isOptional) {
    return validator.optional();
  }

  return validator;
};

// Validate options object
export const validateOptions = [
  body("options")
    .optional()
    .custom((options, { req }) => {
      if (req.body.questionType === "integer") {
        return true; // Options not required for integer type
      }

      if (!options || typeof options !== "object") {
        throw new Error("Options must be an object");
      }

      const requiredOptions = ["A", "B", "C", "D"];
      const missingOptions = requiredOptions.filter((opt) => !options[opt]);

      if (missingOptions.length > 0) {
        throw new Error(
          `Missing required options: ${missingOptions.join(", ")}`
        );
      }

      return true;
    }),
];

// Validate correct options
export const validateCorrectOptions = [
  body("correctOptions")
    .notEmpty()
    .withMessage("Correct answer is required")
    .custom((value, { req }) => {
      const questionType = req.body.questionType;

      if (questionType === "single-select") {
        if (typeof value !== "string" || !VALID_OPTIONS.includes(value)) {
          throw new Error(
            "For single-select, correctOptions must be one of A, B, C, or D"
          );
        }
      } else if (questionType === "multi-select") {
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          !value.every((opt) => VALID_OPTIONS.includes(opt))
        ) {
          throw new Error(
            "For multi-select, correctOptions must be an array of valid options (A, B, C, D)"
          );
        }
      } else if (questionType === "integer") {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          throw new Error(
            "For integer type, correctOptions must be an integer number"
          );
        }
      }

      return true;
    }),
];

// Validate difficulty level
export const validateDifficulty = (isOptional = false) => {
  const validator = body("difficulty")
    .isIn(VALID_DIFFICULTY_LEVELS)
    .withMessage("Difficulty must be one of: Easy, Medium, Hard");

  if (isOptional) {
    return validator.optional();
  }

  return validator;
};

// Validate marks object
export const validateMarks = [
  body("marks.positive")
    .notEmpty()
    .withMessage("Positive marks are required")
    .isFloat({ min: 0 })
    .withMessage("Positive marks must be a non-negative number"),

  body("marks.negative")
    .notEmpty()
    .withMessage("Negative marks are required")
    .isFloat({ min: 0 })
    .withMessage("Negative marks must be a non-negative number"),
];

// Validate marks (optional for update)
export const validateMarksOptional = [
  body("marks.positive")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Positive marks must be a non-negative number"),

  body("marks.negative")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Negative marks must be a non-negative number"),
];

// Validate explanation
export const validateExplanation = [
  body("explanation")
    .optional()
    .isLength({ max: 5000 })
    .withMessage("Explanation cannot exceed 5000 characters"),
];

// Validate tags array
export const validateTags = [
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags && tags.length > 0) {
        const invalidTags = tags.filter(
          (tag) => typeof tag !== "string" || tag.trim().length === 0
        );
        if (invalidTags.length > 0) {
          throw new Error("All tags must be non-empty strings");
        }
      }
      return true;
    }),
];

// Validate test ID in body
export const validateTestId = [
  body("testId")
    .notEmpty()
    .withMessage("Test ID is required")
    .isMongoId()
    .withMessage("Invalid test ID format"),
];

// Validate educator ID in body (for questions)
export const validateEducatorIdBody = [
  body("educatorId")
    .notEmpty()
    .withMessage("Educator ID is required")
    .isMongoId()
    .withMessage("Invalid educator ID format"),
];

// Validate educator ID in body (optional)
export const validateEducatorIdBodyOptional = [
  body("educatorId")
    .optional()
    .isMongoId()
    .withMessage("Invalid educator ID format"),
];

export const validatePostTitle = (isOptional = false) => {
  const validator = body("title")
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters");
  return isOptional ? validator.optional() : validator.notEmpty();
};

export const validatePostDescription = (isOptional = false) => {
  const validator = body("description")
    .isLength({ min: 10, max: 4000 })
    .withMessage("Description must be between 10 and 4000 characters");
  return isOptional ? validator.optional() : validator.notEmpty();
};

export const validatePostSubjects = (isOptional = false) => {
  const validator = body("subjects")
    .isArray({ min: 1 })
    .withMessage("At least one subject must be selected")
    .custom((subjects) => {
      const invalidSubjects = subjects.filter(
        (subject) => !VALID_SUBJECTS.includes(subject)
      );
      if (invalidSubjects.length > 0) {
        throw new Error(`Invalid subjects: ${invalidSubjects.join(", ")}`);
      }
      return true;
    });
  return isOptional ? validator.optional() : validator;
};

export const validatePostSpecializations = (isOptional = false) => {
  const validator = body("specializations")
    .isArray({ min: 1 })
    .withMessage("At least one specialization must be selected")
    .custom((specializations) => {
      const invalidSpecializations = specializations.filter(
        (specialization) => !VALID_SPECIALIZATIONS.includes(specialization)
      );
      if (invalidSpecializations.length > 0) {
        throw new Error(
          `Invalid specializations: ${invalidSpecializations.join(", ")}`
        );
      }
      return true;
    });
  return isOptional ? validator.optional() : validator;
};

export const createPostValidation = [
  ...validateEducatorIdBody,
  validatePostSubjects(),
  validatePostSpecializations(),
  validatePostTitle(),
  validatePostDescription(),
];

export const updatePostValidation = [
  validatePostSubjects(true),
  validatePostSpecializations(true),
  validatePostTitle(true),
  validatePostDescription(true),
];

export const validatePaymentProductType = [
  body("productType")
    .notEmpty()
    .withMessage("Product type is required")
    .isIn(VALID_PAYMENT_PRODUCTS)
    .withMessage("Unsupported product type"),
];

export const validateProductIdBody = [
  body("productId")
    .notEmpty()
    .withMessage("Product ID is required")
    .isMongoId()
    .withMessage("Invalid product ID format"),
];

export const createPaymentOrderValidation = [
  ...validateStudentId,
  ...validateProductIdBody,
  ...validatePaymentProductType,
];

export const validatePaymentIntentIdParam = [
  param("id").isMongoId().withMessage("Invalid payment intent ID"),
];

// Complete validation array for creating question
export const createQuestionValidation = [
  body("title")
    .notEmpty()
    .withMessage("Question title is required")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Question title must be between 10 and 2000 characters"),

  body("questionType")
    .notEmpty()
    .withMessage("Question type is required")
    .isIn(VALID_QUESTION_TYPES)
    .withMessage(
      "Question type must be one of: single-select, multi-select, integer"
    ),

  body("educatorId")
    .notEmpty()
    .withMessage("Educator ID is required")
    .isMongoId()
    .withMessage("Invalid educator ID format"),

  body("questionImage")
    .optional()
    .isURL()
    .withMessage("Question image must be a valid URL"),

  body("subject")
    .isArray({ min: 1 })
    .withMessage("At least one subject must be selected")
    .custom((subjects) => {
      const invalidSubjects = subjects.filter(
        (sub) => !VALID_SUBJECTS.includes(sub)
      );
      if (invalidSubjects.length > 0) {
        throw new Error(`Invalid subjects: ${invalidSubjects.join(", ")}`);
      }
      return true;
    }),

  body("specialization")
    .isArray({ min: 1 })
    .withMessage("At least one specialization must be selected")
    .custom((specializations) => {
      const invalidSpecializations = specializations.filter(
        (spec) => !VALID_SPECIALIZATIONS.includes(spec)
      );
      if (invalidSpecializations.length > 0) {
        throw new Error(
          `Invalid specializations: ${invalidSpecializations.join(", ")}`
        );
      }
      return true;
    }),

  body("class")
    .isArray({ min: 1 })
    .withMessage("At least one class must be selected")
    .custom((classes) => {
      const invalidClasses = classes.filter(
        (cls) => !VALID_CLASSES.includes(cls)
      );
      if (invalidClasses.length > 0) {
        throw new Error(`Invalid classes: ${invalidClasses.join(", ")}`);
      }
      return true;
    }),

  body("topics")
    .isArray({ min: 1 })
    .withMessage("At least one topic is required")
    .custom((topics) => {
      if (topics && topics.length > 0) {
        const invalidTopics = topics.filter(
          (topic) => typeof topic !== "string" || topic.trim().length === 0
        );
        if (invalidTopics.length > 0) {
          throw new Error("All topics must be non-empty strings");
        }
      }
      return true;
    }),

  body("options")
    .optional()
    .custom((options, { req }) => {
      if (req.body.questionType === "integer") {
        return true;
      }

      if (!options || typeof options !== "object") {
        throw new Error("Options must be an object");
      }

      const requiredOptions = ["A", "B", "C", "D"];
      const missingOptions = requiredOptions.filter((opt) => !options[opt]);

      if (missingOptions.length > 0) {
        throw new Error(
          `Missing required options: ${missingOptions.join(", ")}`
        );
      }

      return true;
    }),

  body("correctOptions")
    .notEmpty()
    .withMessage("Correct answer is required")
    .custom((value, { req }) => {
      const questionType = req.body.questionType;

      if (questionType === "single-select") {
        if (typeof value !== "string" || !VALID_OPTIONS.includes(value)) {
          throw new Error(
            "For single-select, correctOptions must be one of A, B, C, or D"
          );
        }
      } else if (questionType === "multi-select") {
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          !value.every((opt) => VALID_OPTIONS.includes(opt))
        ) {
          throw new Error(
            "For multi-select, correctOptions must be an array of valid options (A, B, C, D)"
          );
        }
      } else if (questionType === "integer") {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          throw new Error(
            "For integer type, correctOptions must be an integer number"
          );
        }
      }

      return true;
    }),

  body("difficulty")
    .isIn(VALID_DIFFICULTY_LEVELS)
    .withMessage("Difficulty must be one of: Easy, Medium, Hard"),

  body("marks.positive")
    .notEmpty()
    .withMessage("Positive marks are required")
    .isFloat({ min: 0 })
    .withMessage("Positive marks must be a non-negative number"),

  body("marks.negative")
    .notEmpty()
    .withMessage("Negative marks are required")
    .isFloat({ min: 0 })
    .withMessage("Negative marks must be a non-negative number"),

  body("explanation")
    .optional()
    .isLength({ max: 5000 })
    .withMessage("Explanation cannot exceed 5000 characters"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags && tags.length > 0) {
        const invalidTags = tags.filter(
          (tag) => typeof tag !== "string" || tag.trim().length === 0
        );
        if (invalidTags.length > 0) {
          throw new Error("All tags must be non-empty strings");
        }
      }
      return true;
    }),
];

// Complete validation array for updating question
export const updateQuestionValidation = [
  param("id").isMongoId().withMessage("Invalid ID format"),

  body("title")
    .optional()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Question title must be between 10 and 2000 characters"),

  body("questionType")
    .optional()
    .isIn(VALID_QUESTION_TYPES)
    .withMessage(
      "Question type must be one of: single-select, multi-select, integer"
    ),

  body("educatorId")
    .optional()
    .isMongoId()
    .withMessage("Invalid educator ID format"),

  body("questionImage")
    .optional()
    .isURL()
    .withMessage("Question image must be a valid URL"),

  body("subject")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one subject must be selected")
    .custom((subjects) => {
      if (subjects && subjects.length > 0) {
        const invalidSubjects = subjects.filter(
          (sub) => !VALID_SUBJECTS.includes(sub)
        );
        if (invalidSubjects.length > 0) {
          throw new Error(`Invalid subjects: ${invalidSubjects.join(", ")}`);
        }
      }
      return true;
    }),

  body("specialization")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one specialization must be selected")
    .custom((specializations) => {
      if (specializations && specializations.length > 0) {
        const invalidSpecializations = specializations.filter(
          (spec) => !VALID_SPECIALIZATIONS.includes(spec)
        );
        if (invalidSpecializations.length > 0) {
          throw new Error(
            `Invalid specializations: ${invalidSpecializations.join(", ")}`
          );
        }
      }
      return true;
    }),

  body("class")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one class must be selected")
    .custom((classes) => {
      if (classes && classes.length > 0) {
        const invalidClasses = classes.filter(
          (cls) => !VALID_CLASSES.includes(cls)
        );
        if (invalidClasses.length > 0) {
          throw new Error(`Invalid classes: ${invalidClasses.join(", ")}`);
        }
      }
      return true;
    }),

  body("topics")
    .optional()
    .isArray({ min: 1 })
    .withMessage("At least one topic is required")
    .custom((topics) => {
      if (topics && topics.length > 0) {
        const invalidTopics = topics.filter(
          (topic) => typeof topic !== "string" || topic.trim().length === 0
        );
        if (invalidTopics.length > 0) {
          throw new Error("All topics must be non-empty strings");
        }
      }
      return true;
    }),

  body("options")
    .optional()
    .custom((options, { req }) => {
      if (req.body.questionType === "integer") {
        return true;
      }

      if (!options || typeof options !== "object") {
        throw new Error("Options must be an object");
      }

      const requiredOptions = ["A", "B", "C", "D"];
      const missingOptions = requiredOptions.filter((opt) => !options[opt]);

      if (missingOptions.length > 0) {
        throw new Error(
          `Missing required options: ${missingOptions.join(", ")}`
        );
      }

      return true;
    }),

  body("correctOptions")
    .optional()
    .custom((value, { req }) => {
      if (!value) return true; // Skip if not provided

      const questionType = req.body.questionType;

      if (questionType === "single-select") {
        if (typeof value !== "string" || !VALID_OPTIONS.includes(value)) {
          throw new Error(
            "For single-select, correctOptions must be one of A, B, C, or D"
          );
        }
      } else if (questionType === "multi-select") {
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          !value.every((opt) => VALID_OPTIONS.includes(opt))
        ) {
          throw new Error(
            "For multi-select, correctOptions must be an array of valid options (A, B, C, D)"
          );
        }
      } else if (questionType === "integer") {
        if (typeof value !== "number" || !Number.isInteger(value)) {
          throw new Error(
            "For integer type, correctOptions must be an integer number"
          );
        }
      }

      return true;
    }),

  body("difficulty")
    .optional()
    .isIn(VALID_DIFFICULTY_LEVELS)
    .withMessage("Difficulty must be one of: Easy, Medium, Hard"),

  body("marks.positive")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Positive marks must be a non-negative number"),

  body("marks.negative")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Negative marks must be a non-negative number"),

  body("explanation")
    .optional()
    .isLength({ max: 5000 })
    .withMessage("Explanation cannot exceed 5000 characters"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags && tags.length > 0) {
        const invalidTags = tags.filter(
          (tag) => typeof tag !== "string" || tag.trim().length === 0
        );
        if (invalidTags.length > 0) {
          throw new Error("All tags must be non-empty strings");
        }
      }
      return true;
    }),
];

// Validation for test operations
export const testOperationValidation = [
  param("id").isMongoId().withMessage("Invalid ID format"),
  body("testId")
    .notEmpty()
    .withMessage("Test ID is required")
    .isMongoId()
    .withMessage("Invalid test ID format"),
];

// ==================== Individual Test Validations ====================

// Test subject validation (specific to individual Test schema)
export const VALID_TEST_SUBJECTS = [
  "biology",
  "physics",
  "mathematics",
  "chemistry",
  "english",
  "hindi",
];

// Test marking type validation
export const VALID_MARKING_TYPES = ["overall", "per_question"];

// Validate Test title
export const validateTestTitle = (isOptional = false) => {
  const validator = body("title")
    .isLength({ min: 3, max: 200 })
    .withMessage("Test title must be between 3 and 200 characters")
    .trim();

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Test title is required");
};

// Validate Test description
export const validateTestDescription = (isOptional = false) => {
  const validator = body("description")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Test description must be between 10 and 1000 characters")
    .trim();

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Test description is required");
};

// Validate Test subjects
export const validateTestSubjects = (isOptional = false) => {
  const validator = body("subjects");

  if (isOptional) {
    return validator
      .optional()
      .isArray({ min: 1 })
      .withMessage("At least one subject must be selected")
      .custom((subjects) => {
        if (subjects && subjects.length > 0) {
          const invalidSubjects = subjects.filter(
            (subject) => !VALID_TEST_SUBJECTS.includes(subject)
          );
          if (invalidSubjects.length > 0) {
            throw new Error(
              `Invalid subjects: ${invalidSubjects.join(
                ", "
              )}. Valid subjects are: ${VALID_TEST_SUBJECTS.join(", ")}`
            );
          }
        }
        return true;
      });
  }

  return validator
    .isArray({ min: 1 })
    .withMessage("At least one subject must be selected")
    .custom((subjects) => {
      const invalidSubjects = subjects.filter(
        (subject) => !VALID_TEST_SUBJECTS.includes(subject)
      );
      if (invalidSubjects.length > 0) {
        throw new Error(
          `Invalid subjects: ${invalidSubjects.join(
            ", "
          )}. Valid subjects are: ${VALID_TEST_SUBJECTS.join(", ")}`
        );
      }
      return true;
    });
};

// Validate Test classes
export const validateTestClasses = (isOptional = false) => {
  const validator = body("class");

  if (isOptional) {
    return validator
      .optional()
      .isArray({ min: 1 })
      .withMessage("At least one class must be selected")
      .custom((classes) => {
        if (classes && classes.length > 0) {
          const invalidClasses = classes.filter(
            (cls) => !VALID_CLASSES.includes(cls)
          );
          if (invalidClasses.length > 0) {
            throw new Error(
              `Invalid classes: ${invalidClasses.join(
                ", "
              )}. Valid classes are: ${VALID_CLASSES.join(", ")}`
            );
          }
        }
        return true;
      });
  }

  return validator
    .isArray({ min: 1 })
    .withMessage("At least one class must be selected")
    .custom((classes) => {
      const invalidClasses = classes.filter(
        (cls) => !VALID_CLASSES.includes(cls)
      );
      if (invalidClasses.length > 0) {
        throw new Error(
          `Invalid classes: ${invalidClasses.join(
            ", "
          )}. Valid classes are: ${VALID_CLASSES.join(", ")}`
        );
      }
      return true;
    });
};

// Validate Test specializations
export const validateTestSpecializations = (isOptional = false) => {
  const validator = body("specialization");

  if (isOptional) {
    return validator
      .optional()
      .isArray({ min: 1 })
      .withMessage("At least one specialization must be selected")
      .custom((specializations) => {
        if (specializations && specializations.length > 0) {
          const invalidSpecializations = specializations.filter(
            (spec) => !VALID_SPECIALIZATIONS.includes(spec)
          );
          if (invalidSpecializations.length > 0) {
            throw new Error(
              `Invalid specializations: ${invalidSpecializations.join(
                ", "
              )}. Valid specializations are: ${VALID_SPECIALIZATIONS.join(
                ", "
              )}`
            );
          }
        }
        return true;
      });
  }

  return validator
    .isArray({ min: 1 })
    .withMessage("At least one specialization must be selected")
    .custom((specializations) => {
      const invalidSpecializations = specializations.filter(
        (spec) => !VALID_SPECIALIZATIONS.includes(spec)
      );
      if (invalidSpecializations.length > 0) {
        throw new Error(
          `Invalid specializations: ${invalidSpecializations.join(
            ", "
          )}. Valid specializations are: ${VALID_SPECIALIZATIONS.join(", ")}`
        );
      }
      return true;
    });
};

// Validate Test duration
export const validateTestDuration = (isOptional = false) => {
  const validator = body("duration")
    .isInt({ min: 1 })
    .withMessage("Duration must be at least 1 minute");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Duration is required");
};

// Validate Test overall marks
export const validateTestOverallMarks = (isOptional = false) => {
  const validator = body("overallMarks")
    .isNumeric()
    .withMessage("Overall marks must be a number")
    .isFloat({ min: 0 })
    .withMessage("Overall marks must be greater than or equal to 0");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Overall marks is required");
};

// Validate Test marking type
export const validateTestMarkingType = (isOptional = false) => {
  const validator = body("markingType")
    .isIn(VALID_MARKING_TYPES)
    .withMessage("Marking type must be either 'overall' or 'per_question'");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Marking type is required");
};

// Validate Test educator ID
export const validateTestEducatorId = (isOptional = false) => {
  const validator = body("educatorID")
    .isMongoId()
    .withMessage("Invalid educator ID format");

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Educator ID is required");
};

// Validate Test Series specific logic for Test
export const validateTestSeriesSpecific = [
  body("isTestSeriesSpecific")
    .optional()
    .isBoolean()
    .withMessage("isTestSeriesSpecific must be a boolean"),

  body("testSeriesID")
    .optional()
    .isMongoId()
    .withMessage("Invalid test series ID format")
    .custom((testSeriesID, { req }) => {
      if (req.body.isTestSeriesSpecific && !testSeriesID) {
        throw new Error(
          "Test Series ID is required when test is test series specific"
        );
      }
      return true;
    }),
];

// Validate Test image URL
export const validateTestImage = [
  body("image")
    .optional()
    .isURL()
    .withMessage("Test image must be a valid URL"),
];

// Validate Test instructions
export const validateTestInstructions = [
  body("instructions")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Instructions cannot exceed 2000 characters"),
];

// Validate passing marks
export const validatePassingMarks = [
  body("passingMarks")
    .optional()
    .isNumeric()
    .withMessage("Passing marks must be a number")
    .isFloat({ min: 0 })
    .withMessage("Passing marks must be greater than or equal to 0")
    .custom((passingMarks, { req }) => {
      if (
        passingMarks &&
        req.body.overallMarks &&
        passingMarks > req.body.overallMarks
      ) {
        throw new Error("Passing marks cannot be greater than overall marks");
      }
      return true;
    }),
];

// Validate negative marking settings
export const validateNegativeMarkingSettings = [
  body("negativeMarking")
    .optional()
    .isBoolean()
    .withMessage("Negative marking must be a boolean"),

  body("negativeMarkingRatio")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Negative marking ratio must be between 0 and 1"),
];

// Validate Test settings
export const validateTestSettings = [
  body("shuffleQuestions")
    .optional()
    .isBoolean()
    .withMessage("Shuffle questions must be a boolean"),

  body("showResult")
    .optional()
    .isBoolean()
    .withMessage("Show result must be a boolean"),

  body("allowReview")
    .optional()
    .isBoolean()
    .withMessage("Allow review must be a boolean"),
];

// Complete validation for creating Test
export const createTestValidation = [
  validateTestTitle(),
  validateTestDescription(),
  validateTestSubjects(),
  validateTestClasses(),
  validateTestSpecializations(),
  validateTestDuration(),
  validateTestOverallMarks(),
  validateTestMarkingType(),
  validateTestEducatorId(),
  ...validateTestSeriesSpecific,
  ...validateTestImage,
  ...validateTestInstructions,
  ...validatePassingMarks,
  ...validateNegativeMarkingSettings,
  ...validateTestSettings,
];

// Complete validation for updating Test
export const updateTestValidation = [
  param("id").isMongoId().withMessage("Invalid test ID format"),

  validateTestTitle(true),
  validateTestDescription(true),
  validateTestSubjects(true),
  validateTestClasses(true),
  validateTestSpecializations(true),
  validateTestDuration(true),
  validateTestOverallMarks(true),
  validateTestMarkingType(true),
  ...validateTestSeriesSpecific,
  ...validateTestImage,
  ...validateTestInstructions,
  ...validatePassingMarks,
  ...validateNegativeMarkingSettings,
  ...validateTestSettings,
];

// Validation for Test question management operations
export const testQuestionManagementValidation = [
  param("id").isMongoId().withMessage("Invalid test ID format"),
  body("questionId")
    .notEmpty()
    .withMessage("Question ID is required")
    .isMongoId()
    .withMessage("Invalid question ID format"),
];

// Validation for Test query parameters
export const testQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("minDuration")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minimum duration must be at least 1 minute"),

  query("maxDuration")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Maximum duration must be at least 1 minute")
    .custom((maxDuration, { req }) => {
      const minDuration = req.query.minDuration;
      if (
        minDuration &&
        maxDuration &&
        parseInt(maxDuration) < parseInt(minDuration)
      ) {
        throw new Error(
          "Maximum duration must be greater than minimum duration"
        );
      }
      return true;
    }),

  query("minMarks")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum marks must be greater than or equal to 0"),

  query("maxMarks")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum marks must be greater than or equal to 0")
    .custom((maxMarks, { req }) => {
      const minMarks = req.query.minMarks;
      if (minMarks && maxMarks && parseFloat(maxMarks) < parseFloat(minMarks)) {
        throw new Error("Maximum marks must be greater than minimum marks");
      }
      return true;
    }),

  query("subjects")
    .optional()
    .custom((value) => {
      const subjects = Array.isArray(value) ? value : [value];
      const invalidSubjects = subjects.filter(
        (subject) => !VALID_TEST_SUBJECTS.includes(subject)
      );
      if (invalidSubjects.length > 0) {
        throw new Error(
          `Invalid subjects in query: ${invalidSubjects.join(
            ", "
          )}. Valid subjects are: ${VALID_TEST_SUBJECTS.join(", ")}`
        );
      }
      return true;
    }),

  query("class")
    .optional()
    .custom((value) => {
      const classes = Array.isArray(value) ? value : [value];
      const invalidClasses = classes.filter(
        (cls) => !VALID_CLASSES.includes(cls)
      );
      if (invalidClasses.length > 0) {
        throw new Error(
          `Invalid classes in query: ${invalidClasses.join(
            ", "
          )}. Valid classes are: ${VALID_CLASSES.join(", ")}`
        );
      }
      return true;
    }),

  query("specialization")
    .optional()
    .custom((value) => {
      const specializations = Array.isArray(value) ? value : [value];
      const invalidSpecializations = specializations.filter(
        (spec) => !VALID_SPECIALIZATIONS.includes(spec)
      );
      if (invalidSpecializations.length > 0) {
        throw new Error(
          `Invalid specializations in query: ${invalidSpecializations.join(
            ", "
          )}. Valid specializations are: ${VALID_SPECIALIZATIONS.join(", ")}`
        );
      }
      return true;
    }),

  query("markingType")
    .optional()
    .isIn(VALID_MARKING_TYPES)
    .withMessage("Invalid marking type. Must be 'overall' or 'per_question'"),

  query("educatorID")
    .optional()
    .isMongoId()
    .withMessage("Invalid educator ID format in query"),

  query("testSeriesID")
    .optional()
    .isMongoId()
    .withMessage("Invalid test series ID format in query"),

  query("isTestSeriesSpecific")
    .optional()
    .isIn(["true", "false"])
    .withMessage('isTestSeriesSpecific must be "true" or "false"'),

  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),
];

// Validation for Test educator parameter
export const testEducatorValidation = [
  param("educatorId").isMongoId().withMessage("Invalid educator ID format"),
];

// Validation for Test series parameter
export const testSeriesValidation = [
  param("testSeriesId")
    .isMongoId()
    .withMessage("Invalid test series ID format"),
];

// Validation for Test slug parameter
export const testSlugValidation = [
  param("slug")
    .notEmpty()
    .withMessage("Slug is required")
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Invalid slug format. Slug must contain only lowercase letters, numbers, and hyphens"
    ),
];

// ==================== Student Validations ====================

// Validate Student name
export const validateStudentName = (isOptional = false) => {
  const validator = body("name")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name must contain only letters and spaces")
    .trim();

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Name is required");
};

// Validate Student username
export const validateStudentUsername = (isOptional = false) => {
  const validator = body("username")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-z0-9_]+$/)
    .withMessage(
      "Username must contain only lowercase letters, numbers, and underscores"
    )
    .trim()
    .toLowerCase();

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Username is required");
};

// Validate Student password
export const validateStudentPassword = (isOptional = false) => {
  const validator = body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    );

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Password is required");
};

// Validate Student mobile number
export const validateStudentMobileNumber = (isOptional = false) => {
  const validator = body("mobileNumber")
    .matches(/^[6-9]\d{9}$/)
    .withMessage(
      "Mobile number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9"
    );

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Mobile number is required");
};

// Validate Student email
export const validateStudentEmail = (isOptional = false) => {
  const validator = body("email")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .trim()
    .toLowerCase();

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Email is required");
};

// Validate Student specialization
export const validateStudentSpecialization = (isOptional = false) => {
  const validator = body("specialization")
    .isIn(VALID_SPECIALIZATIONS)
    .withMessage(
      `Specialization must be one of: ${VALID_SPECIALIZATIONS.join(", ")}`
    );

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Specialization is required");
};

// Validate Student class
export const validateStudentClass = (isOptional = false) => {
  const validator = body("class")
    .isIn(VALID_CLASSES)
    .withMessage(`Class must be one of: ${VALID_CLASSES.join(", ")}`);

  if (isOptional) {
    return validator.optional();
  }

  return validator.notEmpty().withMessage("Class is required");
};

// Validate Student address
export const validateStudentAddress = [
  body("address.street")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Street address cannot exceed 200 characters")
    .trim(),

  body("address.city")
    .optional()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters")
    .trim(),

  body("address.state")
    .optional()
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters")
    .trim(),

  body("address.country")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters")
    .trim(),

  body("address.pincode")
    .optional()
    .matches(/^\d{6}$/)
    .withMessage("Pincode must be a valid 6-digit number"),
];

// Validate Student image
export const validateStudentImage = [
  body("image").optional().isURL().withMessage("Image must be a valid URL"),
];

// Validate Student device token
export const validateStudentDeviceToken = [
  body("deviceToken")
    .optional()
    .isString()
    .withMessage("Device token must be a string")
    .trim(),
];

// Validate Student preferences
export const validateStudentPreferences = [
  body("preferences.notifications.email")
    .optional()
    .isBoolean()
    .withMessage("Email notification preference must be a boolean"),

  body("preferences.notifications.push")
    .optional()
    .isBoolean()
    .withMessage("Push notification preference must be a boolean"),

  body("preferences.notifications.sms")
    .optional()
    .isBoolean()
    .withMessage("SMS notification preference must be a boolean"),

  body("preferences.language")
    .optional()
    .isIn(["english", "hindi"])
    .withMessage("Language must be either 'english' or 'hindi'"),

  body("preferences.theme")
    .optional()
    .isIn(["light", "dark"])
    .withMessage("Theme must be either 'light' or 'dark'"),
];

// Complete validation for creating Student
export const createStudentValidation = [
  validateStudentName(),
  validateStudentUsername(),
  validateStudentPassword(),
  validateStudentMobileNumber(),
  validateStudentEmail(),
  validateStudentSpecialization(),
  validateStudentClass(),
  ...validateStudentAddress,
  ...validateStudentImage,
  ...validateStudentDeviceToken,
  ...validateStudentPreferences,
];

// Auth-facing student signup validation (alias for clarity)
export const studentSignupValidation = createStudentValidation;

// Complete validation for updating Student
export const updateStudentValidation = [
  param("id").isMongoId().withMessage("Invalid student ID format"),

  validateStudentName(true),
  validateStudentUsername(true),
  validateStudentMobileNumber(true),
  validateStudentEmail(true),
  validateStudentSpecialization(true),
  validateStudentClass(true),
  ...validateStudentAddress,
  ...validateStudentImage,
  ...validateStudentDeviceToken,
  ...validateStudentPreferences,
];

// Validation for Student query parameters
export const studentQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("specialization")
    .optional()
    .isIn(VALID_SPECIALIZATIONS)
    .withMessage(
      `Specialization must be one of: ${VALID_SPECIALIZATIONS.join(", ")}`
    ),

  query("class")
    .optional()
    .isIn(VALID_CLASSES)
    .withMessage(`Class must be one of: ${VALID_CLASSES.join(", ")}`),

  query("isActive")
    .optional()
    .isIn(["true", "false"])
    .withMessage('isActive must be "true" or "false"'),

  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),

  query("sortBy")
    .optional()
    .isIn([
      "name",
      "username",
      "email",
      "joinedAt",
      "updatedAt",
      "specialization",
      "class",
    ])
    .withMessage(
      "sortBy must be one of: name, username, email, joinedAt, updatedAt, specialization, class"
    ),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage('sortOrder must be either "asc" or "desc"'),
];

// Validation for Student username parameter
export const studentUsernameValidation = [
  param("username")
    .notEmpty()
    .withMessage("Username is required")
    .matches(/^[a-z0-9_]+$/)
    .withMessage("Invalid username format"),
];

// Validation for Student specialization parameter
export const studentSpecializationValidation = [
  param("specialization")
    .isIn(VALID_SPECIALIZATIONS)
    .withMessage(
      `Invalid specialization. Must be one of: ${VALID_SPECIALIZATIONS.join(
        ", "
      )}`
    ),
];

// Validation for Student class parameter
export const studentClassValidation = [
  param("className")
    .isIn(VALID_CLASSES)
    .withMessage(`Invalid class. Must be one of: ${VALID_CLASSES.join(", ")}`),
];

// Validation for Student password update
export const studentPasswordValidation = [
  param("id").isMongoId().withMessage("Invalid student ID format"),

  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "New password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),
];

// Validation for Student course enrollment
export const studentEnrollmentValidation = [
  param("id").isMongoId().withMessage("Invalid student ID format"),

  body("courseId")
    .notEmpty()
    .withMessage("Course ID is required")
    .isMongoId()
    .withMessage("Invalid course ID format"),
];

// Validation for Student educator follow/unfollow
export const studentFollowValidation = [
  param("id").isMongoId().withMessage("Invalid student ID format"),

  body("educatorId")
    .notEmpty()
    .withMessage("Educator ID is required")
    .isMongoId()
    .withMessage("Invalid educator ID format"),
];

// Validation for Student webinar registration
export const studentWebinarValidation = [
  param("id").isMongoId().withMessage("Invalid student ID format"),

  body("webinarId")
    .notEmpty()
    .withMessage("Webinar ID is required")
    .isMongoId()
    .withMessage("Invalid webinar ID format"),
];

// ==================== Course Validators ====================

// Validate course title
export const validateCourseTitle = (isOptional = false) => {
  const validator = body("title")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Course title must be between 5 and 200 characters");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Course title is required");
};

// Validate course description
export const validateCourseDescription = (isOptional = false) => {
  const validator = body("description")
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Course description cannot exceed 2000 characters");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Course description is required");
};

// Validate course type
export const VALID_COURSE_TYPES = ["one-to-one", "one-to-all"];

export const validateCourseType = (isOptional = false) => {
  const validator = body("courseType")
    .customSanitizer((value) => {
      if (typeof value === "string") {
        if (value === "OTO") return "one-to-one";
        if (value === "OTA") return "one-to-all";
      }
      return value;
    })
    .isIn(VALID_COURSE_TYPES)
    .withMessage("Course type must be either one-to-one or one-to-all");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Course type is required");
};

// Validate course fees
export const validateCourseFees = (isOptional = false) => {
  const validator = body("fees")
    .isFloat({ min: 0 })
    .withMessage("Fees must be a non-negative number");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Fees are required");
};

// Validate course discount
export const validateCourseDiscount = [
  body("discount")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Discount must be between 0 and 100"),
];

// Validate course duration
export const validateCourseDuration = (isOptional = false) => {
  const validator = body("courseDuration")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Course duration must be between 1 and 100 characters");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Course duration is required");
};

// Validate course dates
export const validateCourseStartDate = (isOptional = false) => {
  const validator = body("startDate")
    .isISO8601()
    .withMessage("Start date must be a valid date")
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid start date");
      }
      return true;
    });

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Start date is required");
};

export const validateCourseEndDate = (isOptional = false) => {
  const validator = body("endDate")
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid end date");
      }
      return true;
    });

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("End date is required");
};

export const validateCourseValidDate = (isOptional = false) => {
  const validator = body("validDate")
    .isISO8601()
    .withMessage("Valid date must be a valid date")
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid valid date");
      }
      return true;
    });

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Valid date is required");
};

// Validate course image
export const validateCourseImage = [
  body("image")
    .optional()
    .isURL()
    .withMessage("Course image must be a valid URL"),
];

// Validate course thumbnail
export const validateCourseThumbnail = [
  body("courseThumbnail")
    .optional()
    .isURL()
    .withMessage("Course thumbnail must be a valid URL"),
];

// Validate intro video (allow any valid URL, optional)
export const validateIntroVideo = [
  body("introVideo")
    // Allow empty string/undefined; when provided it must be a URL
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("Intro video must be a valid URL"),
];

// Validate videos array
export const validateVideos = [
  body("videos")
    .optional()
    .isArray()
    .withMessage("Videos must be an array")
    .custom((videos) => {
      if (!Array.isArray(videos)) return true;

      for (const video of videos) {
        if (!video.title || typeof video.title !== "string") {
          throw new Error("Each video must have a title");
        }
        if (video.title.length > 200) {
          throw new Error("Video title cannot exceed 200 characters");
        }
        if (!video.link || typeof video.link !== "string") {
          throw new Error("Each video must have a link");
        }
        if (!video.sequenceNumber || typeof video.sequenceNumber !== "number") {
          throw new Error("Each video must have a sequence number");
        }
      }

      // Check for duplicate sequence numbers
      const sequenceNumbers = videos.map((v) => v.sequenceNumber);
      const uniqueSequences = new Set(sequenceNumbers);
      if (sequenceNumbers.length !== uniqueSequences.size) {
        throw new Error("Video sequence numbers must be unique");
      }

      return true;
    }),
];

// Validate study materials array
export const validateStudyMaterials = [
  body("studyMaterials")
    .optional()
    .isArray()
    .withMessage("Study materials must be an array")
    .custom((materials) => {
      if (!Array.isArray(materials)) return true;

      const validFileTypes = ["PDF", "DOC", "PPT", "EXCEL", "OTHER"];

      for (const material of materials) {
        if (!material.title || typeof material.title !== "string") {
          throw new Error("Each study material must have a title");
        }
        if (material.title.length > 200) {
          throw new Error("Study material title cannot exceed 200 characters");
        }
        if (!material.link || typeof material.link !== "string") {
          throw new Error("Each study material must have a link");
        }
        if (material.fileType && !validFileTypes.includes(material.fileType)) {
          throw new Error(
            `File type must be one of: ${validFileTypes.join(", ")}`
          );
        }
      }

      return true;
    }),
];

// Validate course objectives array
export const validateCourseObjectives = [
  body("courseObjectives")
    .optional()
    .isArray()
    .withMessage("Course objectives must be an array")
    .custom((objectives) => {
      if (!Array.isArray(objectives)) return true;

      for (const objective of objectives) {
        if (typeof objective !== "string") {
          throw new Error("Each course objective must be a string");
        }
        if (objective.length > 500) {
          throw new Error("Course objective cannot exceed 500 characters");
        }
      }

      return true;
    }),
];

// Validate prerequisites array
export const validatePrerequisites = [
  body("prerequisites")
    .optional()
    .isArray()
    .withMessage("Prerequisites must be an array")
    .custom((prerequisites) => {
      if (!Array.isArray(prerequisites)) return true;

      for (const prerequisite of prerequisites) {
        if (typeof prerequisite !== "string") {
          throw new Error("Each prerequisite must be a string");
        }
        if (prerequisite.length > 500) {
          throw new Error("Prerequisite cannot exceed 500 characters");
        }
      }

      return true;
    }),
];

// Validate course language
export const validateCourseLanguage = [
  body("language")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Language must be between 2 and 50 characters"),
];

// Validate certificate availability
export const validateCertificateAvailable = [
  body("certificateAvailable")
    .optional()
    .isBoolean()
    .withMessage("Certificate available must be a boolean"),
];

// Validate max students
export const validateMaxStudents = [
  body("maxStudents")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max students must be at least 1"),
];

// Validate schedule fields
export const validateCourseClassesPerWeek = [
  body("classesPerWeek")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Classes per week must be 0 or greater"),
];

export const validateCourseTestFrequency = [
  body("testFrequency")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Tests per week must be 0 or greater"),
];

export const validateCourseClassDuration = [
  body("classDuration")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Class duration must be 0 or greater"),
];

export const validateCourseClassTiming = [
  body("classTiming")
    .optional()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage("Class timing must be in HH:MM format"),
];

export const validateTopLevelVideoTitle = [
  body("videoTitle")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Video title cannot exceed 200 characters"),
];

// Validate live class ID
export const validateLiveClassId = [
  body("liveClassId")
    .notEmpty()
    .withMessage("Live class ID is required")
    .isMongoId()
    .withMessage("Invalid live class ID format"),
];

// Validate test series ID
export const validateTestSeriesId = [
  body("testSeriesId")
    .notEmpty()
    .withMessage("Test series ID is required")
    .isMongoId()
    .withMessage("Invalid test series ID format"),
];

// Validate video details
export const validateVideoDetails = [
  body("title")
    .notEmpty()
    .withMessage("Video title is required")
    .isLength({ max: 200 })
    .withMessage("Video title cannot exceed 200 characters"),

  body("link")
    .notEmpty()
    .withMessage("Video link is required")
    .isURL()
    .withMessage("Video link must be a valid URL"),

  body("duration")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Video duration cannot exceed 50 characters"),

  body("sequenceNumber")
    .notEmpty()
    .withMessage("Sequence number is required")
    .isInt({ min: 1 })
    .withMessage("Sequence number must be at least 1"),
];

// ==================== Video Validators ====================

export const validateVideoTitle = (isOptional = false) => {
  const validator = body("title")
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Video title must be between 3 and 200 characters");

  return isOptional ? validator.optional() : validator.notEmpty();
};

const normalizeVideoLinksInput = (value) => {
  if (typeof value === "undefined") {
    return value;
  }

  const sanitized = sanitizeArrayPayload(value).map((entry) =>
    typeof entry === "string" ? entry.trim() : ""
  );

  return sanitized.filter((entry) => entry.length > 0);
};

const validateVideoLinksArray = (links, { optional }) => {
  if (typeof links === "undefined") {
    if (optional) {
      return true;
    }
    throw new Error("Links are required");
  }

  if (!Array.isArray(links) || links.length === 0) {
    throw new Error("At least one link is required");
  }

  if (links.length > 20) {
    throw new Error("Links cannot contain more than 20 entries");
  }

  const hasInvalidLink = links.some((link) => {
    if (typeof link !== "string" || link.length === 0 || link.length > 500) {
      return true;
    }

    try {
      const parsed = new URL(link);
      return !(parsed.protocol === "http:" || parsed.protocol === "https:");
    } catch (_error) {
      return true;
    }
  });

  if (hasInvalidLink) {
    throw new Error("Each link must be a valid URL up to 500 characters");
  }

  return true;
};

export const validateVideoLinks = (isOptional = false) => [
  body("links")
    .customSanitizer((value, { req }) => {
      const normalized = normalizeVideoLinksInput(value);
      if (typeof normalized !== "undefined") {
        req.body.links = normalized;
      }
      return normalized;
    })
    .custom((links) =>
      validateVideoLinksArray(links, { optional: isOptional })
    ),
];

const parseVideoCourseSpecificFlag = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

export const validateVideoIsCourseSpecific = [
  body("isCourseSpecific")
    .optional()
    .isBoolean()
    .withMessage("isCourseSpecific must be a boolean")
    .toBoolean(),
];

export const validateVideoCourseId = [
  body("courseId")
    .optional({ nullable: true })
    .custom((value, { req }) => {
      const requiresCourse = parseVideoCourseSpecificFlag(
        req.body?.isCourseSpecific
      );

      if (requiresCourse && !value) {
        throw new Error("courseId is required when isCourseSpecific is true");
      }

      if (!value) {
        return true;
      }

      if (!/^[a-f\d]{24}$/i.test(value)) {
        throw new Error("Invalid course ID format");
      }

      return true;
    })
    .customSanitizer((value, { req }) => {
      const requiresCourse = parseVideoCourseSpecificFlag(
        req.body?.isCourseSpecific
      );
      return requiresCourse ? value : undefined;
    }),
];

export const createVideoValidation = [
  validateVideoTitle(false),
  ...validateVideoLinks(false),
  ...validateVideoIsCourseSpecific,
  ...validateVideoCourseId,
];

export const updateVideoValidation = [
  validateVideoTitle(true),
  ...validateVideoLinks(true),
  ...validateVideoIsCourseSpecific,
  ...validateVideoCourseId,
];

// Validate study material details
export const validateStudyMaterialDetails = [
  body("title")
    .notEmpty()
    .withMessage("Study material title is required")
    .isLength({ max: 200 })
    .withMessage("Study material title cannot exceed 200 characters"),

  body("link")
    .notEmpty()
    .withMessage("Study material link is required")
    .isURL()
    .withMessage("Study material link must be a valid URL"),

  body("fileType")
    .optional()
    .isIn(["PDF", "DOC", "PPT", "EXCEL", "OTHER"])
    .withMessage("File type must be one of: PDF, DOC, PPT, EXCEL, OTHER"),
];

// Validate video ID param
export const validateVideoIdParam = [
  param("videoId")
    .notEmpty()
    .withMessage("Video ID is required")
    .isMongoId()
    .withMessage("Invalid video ID format"),
];

// Validate material ID param
export const validateMaterialIdParam = [
  param("materialId")
    .notEmpty()
    .withMessage("Material ID is required")
    .isMongoId()
    .withMessage("Invalid material ID format"),
];

// ==================== Course Validation Arrays ====================

// Complete validation array for creating course
export const createCourseValidation = [
  validateCourseTitle(false),
  validateCourseDescription(false),
  validateCourseType(false),
  body("educatorID")
    .notEmpty()
    .withMessage("Educator ID is required")
    .isMongoId()
    .withMessage("Invalid educator ID format"),
  validateSpecialization(false),
  validateSubject(false),
  validateClass(false),
  validateCourseFees(false),
  ...validateCourseDiscount,
  ...validateCourseImage,
  ...validateCourseThumbnail,
  validateCourseStartDate(false),
  validateCourseEndDate(false),
  validateCourseDuration(false),
  validateCourseValidDate(false),
  ...validateVideos,
  ...validateIntroVideo,
  ...validateStudyMaterials,
  ...validateCourseObjectives,
  ...validatePrerequisites,
  ...validateCourseLanguage,
  ...validateCertificateAvailable,
  ...validateTopLevelVideoTitle,
  ...validateCourseClassesPerWeek,
  ...validateCourseTestFrequency,
  ...validateCourseClassDuration,
  ...validateCourseClassTiming,
  ...validateMaxStudents,
];

// Complete validation array for updating course
export const updateCourseValidation = [
  validateObjectId("id"),
  validateCourseTitle(true),
  validateCourseDescription(true),
  validateCourseType(true),
  body("educatorID")
    .optional()
    .isMongoId()
    .withMessage("Invalid educator ID format"),
  validateSpecialization(true),
  validateSubject(true),
  validateClass(true),
  validateCourseFees(true),
  ...validateCourseDiscount,
  ...validateCourseImage,
  ...validateCourseThumbnail,
  validateCourseStartDate(true),
  validateCourseEndDate(true),
  validateCourseDuration(true),
  validateCourseValidDate(true),
  ...validateVideos,
  ...validateIntroVideo,
  ...validateStudyMaterials,
  ...validateCourseObjectives,
  ...validatePrerequisites,
  ...validateCourseLanguage,
  ...validateCertificateAvailable,
  ...validateTopLevelVideoTitle,
  ...validateCourseClassesPerWeek,
  ...validateCourseTestFrequency,
  ...validateCourseClassDuration,
  ...validateCourseClassTiming,
  ...validateMaxStudents,
];

// Validation for enrolling student
export const enrollStudentValidation = [
  validateObjectId("id"),
  ...validateStudentId,
];

// Validation for adding purchase
export const addPurchaseValidation = [
  validateObjectId("id"),
  ...validateStudentId,
];

// Validation for live class operations
export const liveClassOperationValidation = [
  validateObjectId("id"),
  ...validateLiveClassId,
];

// Validation for test series operations
export const testSeriesOperationValidation = [
  validateObjectId("id"),
  ...validateTestSeriesId,
];

// Validation for video operations
export const addVideoValidation = [
  validateObjectId("id"),
  ...validateVideoDetails,
];

export const removeVideoValidation = [
  validateObjectId("id"),
  ...validateVideoIdParam,
];

// Validation for study material operations
export const addStudyMaterialValidation = [
  validateObjectId("id"),
  ...validateStudyMaterialDetails,
];

export const removeStudyMaterialValidation = [
  validateObjectId("id"),
  ...validateMaterialIdParam,
];

// Validation for date range query
export const dateRangeValidation = [
  query("startDate")
    .notEmpty()
    .withMessage("Start date is required")
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .notEmpty()
    .withMessage("End date is required")
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((value, { req }) => {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(value);
      if (endDate <= startDate) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
];

// ==================== Test Series Validators ====================

// Validate test series title
export const validateTestSeriesTitle = (isOptional = false) => {
  const validator = body("title")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Test series title must be between 5 and 200 characters");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Test series title is required");
};

// Validate test series description
export const validateTestSeriesDescription = (isOptional = false) => {
  const validator = body("description")
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Test series description cannot exceed 2000 characters");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Test series description is required");
};

// Validate test series price
export const validateTestSeriesPrice = (isOptional = false) => {
  const validator = body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a non-negative number");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Price is required");
};

// Validate test series validity
export const validateTestSeriesValidity = (isOptional = false) => {
  const validator = body("validity")
    .isISO8601()
    .withMessage("Validity must be a valid date")
    .custom((value) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid validity date");
      }
      // Check if validity is in the future
      if (date < new Date()) {
        throw new Error("Validity date must be in the future");
      }
      return true;
    });

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Validity date is required");
};

// Validate number of tests
export const validateNumberOfTests = (isOptional = false) => {
  const validator = body("numberOfTests")
    .isInt({ min: 1 })
    .withMessage("Number of tests must be at least 1");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Number of tests is required");
};

// Validate test series image
export const validateTestSeriesImage = [
  body("image")
    .optional()
    .isURL()
    .withMessage("Test series image must be a valid URL"),
];

// Validate educator ID for test series
export const validateTestSeriesEducatorId = [
  body("educatorId")
    .notEmpty()
    .withMessage("Educator ID is required")
    .isMongoId()
    .withMessage("Invalid educator ID format"),
];

// Validate educator ID for test series (optional)
export const validateTestSeriesEducatorIdOptional = [
  body("educatorId")
    .optional()
    .isMongoId()
    .withMessage("Invalid educator ID format"),
];

// Validate isCourseSpecific
export const validateIsCourseSpecific = [
  body("isCourseSpecific")
    .optional()
    .isBoolean()
    .withMessage("isCourseSpecific must be a boolean"),
];

// Validate course ID for test series
export const validateTestSeriesCourseId = [
  body("courseId")
    .optional()
    .isMongoId()
    .withMessage("Invalid course ID format"),
];

// Validate course ID param
export const validateCourseIdParam = [
  param("courseId").isMongoId().withMessage("Invalid course ID format"),
];

// ==================== Test Series Validation Arrays ====================

// Complete validation array for creating test series
export const createTestSeriesValidation = [
  validateTestSeriesTitle(false),
  validateTestSeriesDescription(false),
  validateTestSeriesPrice(false),
  validateTestSeriesValidity(false),
  validateNumberOfTests(false),
  ...validateTestSeriesImage,
  ...validateTestSeriesEducatorId,
  validateSpecialization(false),
  validateSubject(false),
  ...validateIsCourseSpecific,
  ...validateTestSeriesCourseId,
];

// Complete validation array for updating test series
export const updateTestSeriesValidation = [
  validateObjectId("id"),
  validateTestSeriesTitle(true),
  validateTestSeriesDescription(true),
  validateTestSeriesPrice(true),
  validateTestSeriesValidity(true),
  validateNumberOfTests(true),
  ...validateTestSeriesImage,
  ...validateTestSeriesEducatorIdOptional,
  validateSpecialization(true),
  validateSubject(true),
];

// Validation for enrolling student in test series
export const enrollStudentInTestSeriesValidation = [
  validateObjectId("id"),
  ...validateStudentId,
];

// Validation for test operations in test series
export const testSeriesTestOperationValidation = [
  validateObjectId("id"),
  body("testId")
    .notEmpty()
    .withMessage("Test ID is required")
    .isMongoId()
    .withMessage("Invalid test ID format"),
];

// Validation for bulk test operations in test series
export const bulkTestSeriesTestOperationValidation = [
  validateObjectId("id"),
  body("testIds")
    .notEmpty()
    .withMessage("Test IDs array is required")
    .isArray({ min: 1 })
    .withMessage("Test IDs must be a non-empty array")
    .custom((testIds) => {
      if (!testIds.every((id) => /^[a-f\d]{24}$/i.test(id))) {
        throw new Error("All test IDs must be valid MongoDB ObjectIds");
      }
      return true;
    }),
];

// Validation for rating test series
export const rateTestSeriesValidation = [
  validateObjectId("id"),
  ...validateRating,
];

// ==================== Study Material Validators ====================

export const validateStudyMaterialEducatorId = [
  body("educatorID")
    .notEmpty()
    .withMessage("Educator ID is required")
    .isMongoId()
    .withMessage("Invalid educator ID format"),
];

export const validateStudyMaterialTitle = (isOptional = false) => {
  const validator = body("title")
    .customSanitizer((value, { req }) => {
      if (
        (value === null ||
          typeof value === "undefined" ||
          (Array.isArray(value) && value.length === 0)) &&
        req?.body
      ) {
        const fallbackKey = Object.keys(req.body).find(
          (key) => key !== "title" && key.toLowerCase() === "title"
        );

        if (fallbackKey) {
          value = req.body[fallbackKey];
          req.body.title = value;
          delete req.body[fallbackKey];
        }
      }

      return normalizeSingleValue(value);
    })
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Title must be between 3 and 200 characters");

  return isOptional
    ? validator.optional()
    : validator.notEmpty().withMessage("Title is required");
};

export const validateStudyMaterialDescription = (isOptional = true) => {
  const validator = body("description")
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters");

  return isOptional ? validator.optional() : validator;
};

export const validateStudyMaterialDocs = (isOptional = false) =>
  body("uploadedDocs").custom((_, { req }) => {
    const files = req.files || [];

    if (!files.length) {
      if (isOptional) {
        return true;
      }
      throw new Error("At least one study material file must be uploaded");
    }

    files.forEach((file, index) => {
      if (!file || typeof file !== "object") {
        throw new Error(`File payload missing at index ${index}`);
      }

      const hasBinaryPayload = Boolean(file.buffer?.length);
      const hasUploadedUrl = Boolean(file.path || file.secure_url);
      const hasFileName = Boolean(file.originalname || file.filename);

      if ((!hasBinaryPayload && !hasUploadedUrl) || !hasFileName) {
        throw new Error(`Invalid file payload at index ${index}`);
      }

      const displayName =
        file.originalname || file.filename || `study-material-${index + 1}`;

      const sizeInBytes =
        typeof file.size === "number"
          ? file.size
          : typeof file.bytes === "number"
          ? file.bytes
          : file.buffer?.length || 0;

      if (sizeInBytes > MAX_STUDY_MATERIAL_FILE_SIZE) {
        const sizeInMb =
          Math.round((MAX_STUDY_MATERIAL_FILE_SIZE / (1024 * 1024)) * 10) / 10;
        throw new Error(
          `${displayName} exceeds the allowed ${sizeInMb} MB limit`
        );
      }

      const detectedType = determineStudyMaterialFileType(
        file.originalname || file.filename,
        file.mimetype
      );

      if (!STUDY_MATERIAL_FILE_TYPES.includes(detectedType)) {
        throw new Error(`${displayName} has an unsupported file type`);
      }

      if (detectedType !== "PDF") {
        throw new Error(`${displayName} must be a PDF document`);
      }
    });

    return true;
  });

export const validateStudyMaterialTags = [
  body("tags")
    .optional()
    .customSanitizer(sanitizeArrayPayload)
    .isArray({ max: 25 })
    .withMessage("Tags must be an array with at most 25 items")
    .custom((tags) => {
      tags.forEach((tag, index) => {
        if (typeof tag !== "string" || tag.trim().length === 0) {
          throw new Error(`Tag at index ${index} must be a non-empty string`);
        }
      });
      return true;
    }),
];

export const validateStudyMaterialIsCourseSpecific = [
  body("isCourseSpecific")
    .optional()
    .isBoolean()
    .withMessage("isCourseSpecific must be a boolean")
    .toBoolean(),
];

const studyMaterialRequiresCourse = (req) => {
  const flag = req.body.isCourseSpecific;
  return flag === true || flag === "true" || flag === 1 || flag === "1";
};

export const validateStudyMaterialCourseId = [
  body("courseId").custom((value, { req }) => {
    if (studyMaterialRequiresCourse(req) && !value) {
      throw new Error(
        "courseId is required when the study material is course-specific"
      );
    }
    return true;
  }),
  body("courseId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("Invalid course ID format"),
];

const objectIdRegex = /^[a-f\d]{24}$/i;

export const validateStudyMaterialRemoveDocIds = [
  body("removeDocIds")
    .optional()
    .customSanitizer(sanitizeArrayPayload)
    .isArray()
    .withMessage("removeDocIds must be an array")
    .custom((ids) => {
      ids.forEach((id, index) => {
        if (!objectIdRegex.test(id)) {
          throw new Error(
            `removeDocIds entry at index ${index} must be a valid document identifier`
          );
        }
      });
      return true;
    }),
];

export const createStudyMaterialValidation = [
  ...validateStudyMaterialEducatorId,
  validateStudyMaterialTitle(false),
  validateStudyMaterialDescription(true),
  validateStudyMaterialDocs(false),
  ...validateStudyMaterialTags,
  ...validateStudyMaterialIsCourseSpecific,
  ...validateStudyMaterialCourseId,
];

export const updateStudyMaterialValidation = [
  validateStudyMaterialTitle(true),
  validateStudyMaterialDescription(true),
  validateStudyMaterialDocs(true),
  ...validateStudyMaterialTags,
  ...validateStudyMaterialIsCourseSpecific,
  ...validateStudyMaterialCourseId,
  ...validateStudyMaterialRemoveDocIds,
  ...validateStudyMaterialEducatorId.map((validator) => validator.optional()),
];

// ==================== Live Class Validations ====================

const shouldRequireCourseId = (_value, { req }) => {
  const flag = req.body.isCourseSpecific;
  return flag === true || flag === "true" || flag === 1 || flag === "1";
};

// Educator ID validation for live class
export const validateLiveClassEducatorId = [
  body("educatorID")
    .notEmpty()
    .withMessage("Educator ID is required")
    .isMongoId()
    .withMessage("Invalid educator ID format"),
];

// Course ID validation for live class (when isCourseSpecific is true)
export const validateLiveClassCourseId = [
  body("assignInCourse")
    .if(shouldRequireCourseId)
    .notEmpty()
    .withMessage("Course ID is required when live class is course-specific")
    .isMongoId()
    .withMessage("Invalid course ID format"),
];

// Live class fee validation
export const validateLiveClassFee = (optional = false) => {
  const validator = body("liveClassesFee")
    .notEmpty()
    .withMessage("Live class fee is required")
    .isNumeric()
    .withMessage("Live class fee must be a number")
    .custom((value) => {
      if (parseFloat(value) < 0) {
        throw new Error("Live class fee cannot be negative");
      }
      return true;
    });

  if (optional) {
    return validator.optional();
  }
  return validator;
};

// Subject validation for live class
export const validateLiveClassSubject = (optional = false) => {
  const validator = body("subject").custom((value, { req }) => {
    const normalized = (
      Array.isArray(value)
        ? value
        : typeof value === "string"
        ? value.split(",")
        : []
    )
      .map((entry) =>
        typeof entry === "string" ? entry.trim().toLowerCase() : ""
      )
      .filter((entry) => Boolean(entry));

    if (!normalized.length) {
      throw new Error("At least one subject is required");
    }

    const invalid = normalized.filter(
      (entry) => !VALID_SUBJECTS.includes(entry)
    );
    if (invalid.length) {
      throw new Error(`Invalid subject(s): ${invalid.join(", ")}`);
    }

    req.body.subject = normalized;
    return true;
  });

  return optional ? validator.optional() : validator;
};

// Live class specification validation
export const validateLiveClassSpecification = (optional = false) => {
  const validator = body("liveClassSpecification").custom((value, { req }) => {
    const normalized = (
      Array.isArray(value)
        ? value
        : typeof value === "string"
        ? value.split(",")
        : []
    )
      .map((entry) =>
        typeof entry === "string" ? entry.trim().toUpperCase() : ""
      )
      .filter((entry) => Boolean(entry));

    if (!normalized.length) {
      throw new Error("At least one specialization is required");
    }

    const invalid = normalized.filter(
      (entry) => !VALID_SPECIALIZATIONS.includes(entry)
    );
    if (invalid.length) {
      throw new Error(`Invalid specialization(s): ${invalid.join(", ")}`);
    }

    req.body.liveClassSpecification = normalized;
    return true;
  });

  return optional ? validator.optional() : validator;
};

// Intro video validation for live class
export const validateLiveClassIntroVideo = (optional = true) => {
  const validator = body("introVideo")
    .if(body("introVideo").notEmpty())
    .isURL()
    .withMessage("Intro video must be a valid URL");

  if (optional) {
    return validator.optional();
  }
  return validator;
};

// Class timing validation
export const validateClassTiming = (optional = false) => {
  const validator = body("classTiming")
    .notEmpty()
    .withMessage("Class timing is required")
    .isISO8601()
    .withMessage("Invalid date format. Please provide ISO8601 format")
    .custom((value) => {
      const classTime = new Date(value);
      if (classTime <= new Date()) {
        throw new Error("Class timing must be in the future");
      }
      return true;
    });

  if (optional) {
    return validator.optional().custom((value) => {
      if (value) {
        const classTime = new Date(value);
        if (classTime <= new Date()) {
          throw new Error("Class timing must be in the future");
        }
      }
      return true;
    });
  }
  return validator;
};

// Class duration validation
export const validateClassDuration = (optional = false) => {
  const validator = body("classDuration")
    .notEmpty()
    .withMessage("Class duration is required")
    .isNumeric()
    .withMessage("Class duration must be a number")
    .custom((value) => {
      const duration = parseInt(value);
      if (duration < 1) {
        throw new Error("Class duration must be at least 1 minute");
      }
      if (duration > 480) {
        throw new Error("Class duration cannot exceed 480 minutes (8 hours)");
      }
      return true;
    });

  if (optional) {
    return validator.optional();
  }
  return validator;
};

// Live class title validation
export const validateLiveClassTitle = (optional = false) => {
  const validator = body("liveClassTitle")
    .notEmpty()
    .withMessage("Live class title is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Live class title must be between 3 and 200 characters");

  if (optional) {
    return validator.optional();
  }
  return validator;
};

// Class array validation
export const validateClassArray = (optional = false) => {
  const validator = body("class")
    .notEmpty()
    .withMessage("Class is required")
    .isArray({ min: 1 })
    .withMessage("Class must be a non-empty array")
    .custom((value, { req }) => {
      const normalized = value.map((entry) =>
        typeof entry === "string" ? entry.trim().toLowerCase() : entry
      );
      if (!normalized.every((c) => VALID_CLASSES.includes(c))) {
        throw new Error(
          `Invalid class. Must be one of: ${VALID_CLASSES.join(", ")}`
        );
      }
      req.body.class = normalized;
      return true;
    });

  if (optional) {
    return validator.optional();
  }
  return validator;
};

// Description validation
export const validateLiveClassDescription = (optional = true) => {
  const validator = body("description")
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters");

  if (optional) {
    return validator.optional();
  }
  return validator;
};

// Max students validation for live class
export const validateLiveClassMaxStudents = (optional = true) => {
  const validator = body("maxStudents")
    .if(body("maxStudents").notEmpty())
    .isNumeric()
    .withMessage("Max students must be a number")
    .custom((value) => {
      if (parseInt(value) < 1) {
        throw new Error("Max students must be at least 1");
      }
      return true;
    });

  if (optional) {
    return validator.optional();
  }
  return validator;
};

// Is course specific validation
export const validateLiveClassIsCourseSpecific = [
  body("isCourseSpecific")
    .optional()
    .toBoolean()
    .isBoolean()
    .withMessage("isCourseSpecific must be a boolean"),
];

// Student ID validation for enrollment
export const validateLiveClassStudentId = [
  body("studentId")
    .notEmpty()
    .withMessage("Student ID is required")
    .isMongoId()
    .withMessage("Invalid student ID format"),
];

// Attendance time validation
export const validateAttendanceTime = [
  body("attendanceTime")
    .optional()
    .isNumeric()
    .withMessage("Attendance time must be a number")
    .custom((value) => {
      if (parseInt(value) < 0) {
        throw new Error("Attendance time cannot be negative");
      }
      return true;
    }),
];

// Recording URL validation
export const validateRecordingURL = [
  body("recordingURL")
    .optional()
    .isURL()
    .withMessage("Recording URL must be a valid URL"),
];

// Complete validation array for creating live class
export const createLiveClassValidation = [
  validateLiveClassEducatorId,
  validateLiveClassCourseId,
  validateLiveClassFee(false),
  validateLiveClassSubject(false),
  validateLiveClassSpecification(false),
  validateLiveClassIntroVideo(true),
  validateClassTiming(false),
  validateClassDuration(false),
  validateLiveClassTitle(false),
  validateClassArray(false),
  validateLiveClassDescription(true),
  validateLiveClassMaxStudents(true),
  validateLiveClassIsCourseSpecific,
].flat();

// Complete validation array for updating live class
export const updateLiveClassValidation = [
  validateObjectId("id"),
  validateLiveClassEducatorId.map((v) => v.optional()),
  validateLiveClassCourseId.map((v) => v.optional()),
  validateLiveClassFee(true),
  validateLiveClassSubject(true),
  validateLiveClassSpecification(true),
  validateLiveClassIntroVideo(true),
  validateClassTiming(true),
  validateClassDuration(true),
  validateLiveClassTitle(true),
  validateClassArray(true),
  validateLiveClassDescription(true),
  validateLiveClassMaxStudents(true),
  validateLiveClassIsCourseSpecific.map((v) => v.optional()),
].flat();

// Validation for enrolling student in live class
export const enrollLiveClassValidation = [
  validateObjectId("liveClassId"),
  validateLiveClassStudentId,
];

// Validation for marking attendance
export const markAttendanceValidation = [
  validateObjectId("liveClassId"),
  validateObjectId("studentId"),
  validateAttendanceTime,
];

export const getPostsBySubjectValidation = [validateSubjectParam];
export const getPostsBySpecializationValidation = [validateSpecializationParam];
export const searchPostsValidation = [
  query("q").trim().notEmpty().withMessage("Search query is required"),
];
