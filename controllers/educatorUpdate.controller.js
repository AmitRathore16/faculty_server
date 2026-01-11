import { validationResult } from "express-validator";
import Educator from "../models/educator.js";
import { deleteCloudinaryAsset } from "../config/cloudinary.js";

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

const sanitizeEducator = (educator) => {
  if (!educator) return null;
  const data =
    typeof educator.toObject === "function"
      ? educator.toObject()
      : { ...educator };
  delete data.password;
  delete data.refreshTokens;
  return data;
};

const mergeName = (firstName = "", lastName = "") => {
  const parts = [firstName, lastName].filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(" ").trim();
};

export const updateEducatorBasicInfo = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { educatorId } = req.params;
    const {
      firstName,
      lastName,
      email,
      mobileNumber,
      bio,
      description,
      introVideoLink,
    } = req.body;

    const updates = {};
    const fullName = mergeName(firstName, lastName);
    if (fullName) {
      updates.fullName = fullName;
    }
    if (email) updates.email = email;
    if (mobileNumber) updates.mobileNumber = mobileNumber;
    if (typeof bio !== "undefined") updates.bio = bio;
    if (typeof description !== "undefined") updates.description = description;
    if (typeof introVideoLink !== "undefined") {
      updates.introVideo = introVideoLink;
    }

    const educator = await Educator.findByIdAndUpdate(educatorId, updates, {
      new: true,
      runValidators: true,
    });

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const sanitized = sanitizeEducator(educator);
    res.status(200).json({
      success: true,
      message: "Educator details updated",
      data: { educator: sanitized },
      educator: sanitized,
    });
  } catch (error) {
    console.error("Error updating educator basic info:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update educator",
      error: error.message,
    });
  }
};

export const updateEducatorImageController = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    const { educatorId } = req.params;
    const educator = await Educator.findById(educatorId).select(
      "image profilePicture"
    );

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const previousPublicId = educator.image?.publicId;

    educator.profilePicture = req.file.path;
    educator.image = {
      publicId: req.file.filename,
      url: req.file.path,
    };

    await educator.save();

    if (previousPublicId && previousPublicId !== req.file.filename) {
      await deleteCloudinaryAsset(previousPublicId);
    }

    const sanitized = sanitizeEducator(educator);
    res.status(200).json({
      success: true,
      message: "Profile image updated",
      data: { educator: sanitized },
      educator: sanitized,
    });
  } catch (error) {
    console.error("Error updating educator image:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update profile image",
      error: error.message,
    });
  }
};

const sanitizeWorkExperienceEntries = (items = []) =>
  items.filter(Boolean).map((item) => ({
    title: item.title || "",
    company: item.company || "",
    startDate: item.startDate ? new Date(item.startDate) : null,
    endDate: item.endDate ? new Date(item.endDate) : null,
    description: item.description || "",
  }));

const sanitizeQualificationEntries = (items = []) =>
  items.filter(Boolean).map((item) => ({
    title: item.title || "",
    institute: item.institute || "",
    startDate: item.startDate ? new Date(item.startDate) : null,
    endDate: item.endDate ? new Date(item.endDate) : null,
    description: item.description || "",
  }));

export const updateEducatorWorkExperience = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { educatorId } = req.params;
    const { workExperience } = req.body;

    if (workExperience && !Array.isArray(workExperience)) {
      return res.status(400).json({
        success: false,
        message: "workExperience must be an array",
      });
    }

    const educator = await Educator.findByIdAndUpdate(
      educatorId,
      {
        workExperience: sanitizeWorkExperienceEntries(workExperience),
      },
      { new: true, runValidators: true }
    );

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const sanitized = sanitizeEducator(educator);
    res.status(200).json({
      success: true,
      message: "Work experience updated",
      data: { educator: sanitized },
      educator: sanitized,
    });
  } catch (error) {
    console.error("Error updating work experience:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update work experience",
      error: error.message,
    });
  }
};

export const updateEducatorQualifications = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { educatorId } = req.params;
    const { qualification } = req.body;

    if (qualification && !Array.isArray(qualification)) {
      return res.status(400).json({
        success: false,
        message: "qualification must be an array",
      });
    }

    const educator = await Educator.findByIdAndUpdate(
      educatorId,
      {
        qualification: sanitizeQualificationEntries(qualification),
      },
      { new: true, runValidators: true }
    );

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const sanitized = sanitizeEducator(educator);
    res.status(200).json({
      success: true,
      message: "Qualifications updated",
      data: { educator: sanitized },
      educator: sanitized,
    });
  } catch (error) {
    console.error("Error updating qualifications:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update qualifications",
      error: error.message,
    });
  }
};

export const updateEducatorSocialLinks = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { educatorId } = req.params;
    const socials = req.body.socials || {};

    const educator = await Educator.findByIdAndUpdate(
      educatorId,
      {
        socials: {
          linkedin: socials.linkedin || "",
          twitter: socials.twitter || "",
          facebook: socials.facebook || "",
          instagram: socials.instagram || "",
          youtube: socials.youtube || "",
          website: socials.website || "",
        },
      },
      { new: true, runValidators: true }
    );

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const sanitized = sanitizeEducator(educator);
    res.status(200).json({
      success: true,
      message: "Social links updated",
      data: { educator: sanitized },
      educator: sanitized,
    });
  } catch (error) {
    console.error("Error updating social links:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update social links",
      error: error.message,
    });
  }
};

const normalizeSubjects = (subjects = []) =>
  subjects.filter(Boolean).map((subject) => subject.toLowerCase());

const normalizeClasses = (classes = []) =>
  classes.filter(Boolean).map((cls) => cls.toLowerCase());

export const updateEducatorSpecializationAndExperience = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) {
      return;
    }

    const { educatorId } = req.params;
    const {
      specialization = [],
      subject = [],
      class: classes = [],
      yearsExperience,
      payPerHourFee,
    } = req.body;

    if (specialization && !Array.isArray(specialization)) {
      return res.status(400).json({
        success: false,
        message: "specialization must be an array",
      });
    }

    if (subject && !Array.isArray(subject)) {
      return res.status(400).json({
        success: false,
        message: "subject must be an array",
      });
    }

    const updatePayload = {
      specialization,
      subject: normalizeSubjects(subject),
      class: normalizeClasses(classes),
    };

    if (typeof yearsExperience !== "undefined") {
      updatePayload.yoe = Number(yearsExperience) || 0;
    }

    if (typeof payPerHourFee !== "undefined") {
      const feeValue = Number(payPerHourFee);
      updatePayload.payPerHourFee = Number.isFinite(feeValue)
        ? Math.max(0, feeValue)
        : 0;
    }

    const educator = await Educator.findByIdAndUpdate(
      educatorId,
      updatePayload,
      { new: true, runValidators: true }
    );

    if (!educator) {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const sanitized = sanitizeEducator(educator);
    res.status(200).json({
      success: true,
      message: "Specialization updated",
      data: { educator: sanitized },
      educator: sanitized,
    });
  } catch (error) {
    console.error("Error updating specialization:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update specialization",
      error: error.message,
    });
  }
};
