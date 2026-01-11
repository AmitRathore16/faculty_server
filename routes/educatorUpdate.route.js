import express from "express";
import { body } from "express-validator";
import {
  updateEducatorBasicInfo,
  updateEducatorImageController,
  updateEducatorWorkExperience,
  updateEducatorQualifications,
  updateEducatorSocialLinks,
  updateEducatorSpecializationAndExperience,
} from "../controllers/educatorUpdate.controller.js";
import {
  validateObjectId,
  validateEmail,
  validateMobileNumber,
  validateSpecialization,
  validateSubject,
  validateClass,
  validatePayPerHourFee,
  validateVimeoEmbed,
} from "../util/validation.js";
import { uploadEducatorImage } from "../config/cloudinary.js";
import multer from "multer";

const router = express.Router();

const basicInfoValidation = [
  ...validateObjectId("educatorId"),
  body("firstName").optional().isLength({ min: 1, max: 50 }),
  body("lastName").optional().isLength({ min: 1, max: 50 }),
  validateEmail(true),
  validateMobileNumber(true),
  body("bio").optional().isLength({ max: 1000 }),
  body("description").optional().isLength({ max: 1000 }),
  ...validateVimeoEmbed("introVideoLink", true),
];

const workExperienceValidation = [
  ...validateObjectId("educatorId"),
  body("workExperience")
    .optional()
    .isArray()
    .withMessage("workExperience must be an array"),
];

const qualificationValidation = [
  ...validateObjectId("educatorId"),
  body("qualification")
    .optional()
    .isArray()
    .withMessage("qualification must be an array"),
];

const socialLinksValidation = [
  ...validateObjectId("educatorId"),
  body("socials")
    .optional()
    .isObject()
    .withMessage("socials must be an object"),
];

const specializationValidation = [
  ...validateObjectId("educatorId"),
  validateSpecialization(true),
  validateSubject(true),
  validateClass(true),
  validatePayPerHourFee(true),
  body("yearsExperience")
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage("yearsExperience must be between 0 and 50"),
];

router.put(
  "/update-name-email-number-bio-ivlink/:educatorId",
  basicInfoValidation,
  updateEducatorBasicInfo
);

router.put(
  "/update-image/:educatorId",
  ...validateObjectId("educatorId"),
  (req, res, next) => {
    uploadEducatorImage.single("image")(req, res, (error) => {
      if (error) {
        console.error("Educator image upload failed:", error);
        if (error instanceof multer.MulterError) {
          return res.status(400).json({
            success: false,
            message: error.message || "Failed to upload image",
          });
        }

        const cloudinaryMessage =
          error?.message || error?.error?.message || "Unable to upload image";
        return res.status(500).json({
          success: false,
          message: cloudinaryMessage,
        });
      }
      next();
    });
  },
  updateEducatorImageController
);

router.put(
  "/update-work-experience/:educatorId",
  workExperienceValidation,
  updateEducatorWorkExperience
);

router.put(
  "/update-qualifications/:educatorId",
  qualificationValidation,
  updateEducatorQualifications
);

router.put(
  "/update-social-links/:educatorId",
  socialLinksValidation,
  updateEducatorSocialLinks
);

router.put(
  "/update-specialization-experience/:educatorId",
  specializationValidation,
  updateEducatorSpecializationAndExperience
);

export default router;
