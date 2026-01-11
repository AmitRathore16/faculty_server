import { validationResult } from "express-validator";
import StudyMaterial from "../models/studyMaterial.js";
import Course from "../models/course.js";
import { determineStudyMaterialFileType } from "../util/studyMaterial.js";
import {
  deleteCloudinaryAsset,
  uploadStudyMaterialPdfBuffer,
} from "../config/cloudinary.js";

const normalizeBoolean = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

const handleValidation = (req, res) => {
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

const deriveDisplayName = (filename = "") => {
  if (!filename) {
    return "study-material";
  }
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
};

const buildDocsFromFiles = (files = []) =>
  files.map((file) => ({
    name: deriveDisplayName(file.originalname || file.filename),
    originalName: file.originalname || file.filename,
    mimeType: file.mimetype || "application/octet-stream",
    fileType: determineStudyMaterialFileType(
      file.originalname || file.filename,
      file.mimetype
    ),
    sizeInBytes:
      typeof file.size === "number"
        ? file.size
        : typeof file.bytes === "number"
        ? file.bytes
        : file.buffer?.length || 0,
    url: file.path || file.secure_url,
    publicId: file.filename || file.public_id,
    resourceType: file.resource_type || "raw",
  }));

const cleanupUploadedDocs = async (docs = []) => {
  if (!Array.isArray(docs) || docs.length === 0) {
    return;
  }

  await Promise.all(
    docs.map((doc) =>
      deleteCloudinaryAsset(doc.publicId || doc.public_id || doc.filename, {
        resourceType: doc.resourceType || doc.resource_type || "raw",
      })
    )
  );
};

const uploadFilesToCloudinary = async (files = []) => {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const uploads = [];

  try {
    for (const file of files) {
      if (!file) {
        continue;
      }

      if (file.path || file.secure_url) {
        uploads.push(file);
        continue;
      }

      if (!file.buffer) {
        continue;
      }

      const result = await uploadStudyMaterialPdfBuffer(file);

      uploads.push({
        originalname: file.originalname,
        mimetype: file.mimetype || "application/pdf",
        size:
          typeof file.size === "number"
            ? file.size
            : typeof result?.bytes === "number"
            ? result.bytes
            : undefined,
        bytes: result?.bytes,
        filename: result?.public_id,
        public_id: result?.public_id,
        resource_type: result?.resource_type || "raw",
        secure_url: result?.secure_url || result?.url,
        path: result?.secure_url || result?.url,
      });
    }

    return uploads;
  } catch (error) {
    const uploadedDocs = buildDocsFromFiles(uploads);
    await cleanupUploadedDocs(uploadedDocs);
    throw error;
  }
};

const sanitizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags)]
    .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
    .filter((tag) => tag.length > 0)
    .slice(0, 25);
};

const ensureCourseExists = async (courseId) => {
  if (!courseId) {
    return true;
  }

  const course = await Course.exists({ _id: courseId });
  return Boolean(course);
};

const listStudyMaterials = async (query, baseFilter = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    educatorID,
    courseId,
    isCourseSpecific,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  const parsedPage = Math.max(1, parseInt(page, 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (parsedPage - 1) * parsedLimit;

  const filter = { ...baseFilter };
  if (educatorID) {
    filter.educatorID = educatorID;
  }
  if (courseId) {
    filter.courseId = courseId;
  }
  if (typeof isCourseSpecific !== "undefined") {
    filter.isCourseSpecific = normalizeBoolean(isCourseSpecific);
  }
  if (search) {
    filter.title = { $regex: search, $options: "i" };
  }

  const allowedSortFields = ["createdAt", "updatedAt", "title"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const sortDirection = sortOrder === "asc" ? 1 : -1;

  const [items, total] = await Promise.all([
    StudyMaterial.find(filter)
      .populate("educatorID", "fullName username email")
      .populate("courseId", "title slug")
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(parsedLimit)
      .exec(),
    StudyMaterial.countDocuments(filter),
  ]);

  return {
    studyMaterials: items,
    pagination: {
      currentPage: parsedPage,
      totalPages: Math.ceil(total / parsedLimit) || 1,
      totalItems: total,
      pageSize: parsedLimit,
    },
  };
};

export const createStudyMaterial = async (req, res) => {
  let uploadedDocs = [];

  try {
    if (handleValidation(req, res)) {
      return;
    }

    const {
      educatorID,
      title,
      description,
      isCourseSpecific,
      courseId,
      tags,
    } = req.body;

    const courseSpecificFlag = normalizeBoolean(isCourseSpecific);

    if (courseSpecificFlag && !(await ensureCourseExists(courseId))) {
      return res.status(404).json({
        success: false,
        message: "Course not found for the provided courseId",
      });
    }

    const cloudinaryFiles = await uploadFilesToCloudinary(req.files);
    uploadedDocs = buildDocsFromFiles(cloudinaryFiles);

    if (uploadedDocs.length === 0) {
      await cleanupUploadedDocs(uploadedDocs);
      return res.status(400).json({
        success: false,
        message: "At least one study material file must be uploaded",
      });
    }

    const studyMaterial = await StudyMaterial.create({
      educatorID,
      title: title.trim(),
      description: description?.trim(),
      docs: uploadedDocs,
      isCourseSpecific: courseSpecificFlag,
      courseId: courseSpecificFlag ? courseId : undefined,
      tags: sanitizeTags(tags),
    });

    return res.status(201).json({
      success: true,
      message: "Study material created successfully",
      data: studyMaterial,
    });
  } catch (error) {
    console.error("Error creating study material:", error);
    await cleanupUploadedDocs(uploadedDocs);
    return res.status(500).json({
      success: false,
      message: "Error creating study material",
      error: error.message,
    });
  }
};

export const getAllStudyMaterials = async (req, res) => {
  try {
    const result = await listStudyMaterials(req.query);
    return res.status(200).json({
      success: true,
      message: "Study materials retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching study materials:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching study materials",
      error: error.message,
    });
  }
};

export const getStudyMaterialsByEducator = async (req, res) => {
  try {
    const result = await listStudyMaterials(req.query, {
      educatorID: req.params.educatorId,
    });
    return res.status(200).json({
      success: true,
      message: "Educator study materials retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching educator study materials:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching educator study materials",
      error: error.message,
    });
  }
};

export const getStudyMaterialByCourse = async (req, res) => {
  try {
    const result = await listStudyMaterials(req.query, {
      courseId: req.params.courseId,
    });
    return res.status(200).json({
      success: true,
      message: "Course study materials retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching course study materials:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching course study materials",
      error: error.message,
    });
  }
};

export const getStudyMaterialById = async (req, res) => {
  try {
    const material = await StudyMaterial.findById(req.params.id)
      .populate("educatorID", "fullName username email")
      .populate("courseId", "title slug");

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Study material not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Study material retrieved successfully",
      data: material,
    });
  } catch (error) {
    console.error("Error fetching study material:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching study material",
      error: error.message,
    });
  }
};

export const updateStudyMaterial = async (req, res) => {
  let newlyUploadedDocs = [];

  try {
    if (handleValidation(req, res)) {
      return;
    }

    const {
      title,
      description,
      isCourseSpecific,
      courseId,
      tags,
      removeDocIds = [],
    } = req.body;

    let docsToDeleteFromCloud = [];

    const material = await StudyMaterial.findById(req.params.id)
      .populate("educatorID", "fullName username email")
      .populate("courseId", "title slug");

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Study material not found",
      });
    }

    if (req.body.educatorID) {
      material.educatorID = req.body.educatorID;
    }

    if (typeof title === "string") {
      material.title = title.trim();
    }

    if (typeof description === "string") {
      material.description = description.trim();
    }

    if (typeof isCourseSpecific !== "undefined") {
      const courseSpecificFlag = normalizeBoolean(isCourseSpecific);
      material.isCourseSpecific = courseSpecificFlag;

      if (courseSpecificFlag) {
        if (!(await ensureCourseExists(courseId))) {
          return res.status(404).json({
            success: false,
            message: "Course not found for the provided courseId",
          });
        }
        material.courseId = courseId;
      } else {
        material.courseId = undefined;
      }
    } else if (courseId) {
      if (!(await ensureCourseExists(courseId))) {
        return res.status(404).json({
          success: false,
          message: "Course not found for the provided courseId",
        });
      }
      material.courseId = courseId;
    }

    if (tags) {
      material.tags = sanitizeTags(tags);
    }

    if (Array.isArray(removeDocIds) && removeDocIds.length > 0) {
      const idsToRemove = removeDocIds.map((id) => id.toString());
      docsToDeleteFromCloud = material.docs.filter((doc) =>
        idsToRemove.includes(doc._id.toString())
      );
      material.docs = material.docs.filter(
        (doc) => !idsToRemove.includes(doc._id.toString())
      );
    }

    if (req.files && req.files.length > 0) {
      const cloudinaryFiles = await uploadFilesToCloudinary(req.files);
      newlyUploadedDocs = buildDocsFromFiles(cloudinaryFiles);
      if (newlyUploadedDocs.length > 0) {
        material.docs.push(...newlyUploadedDocs);
      }
    }

    if (!material.docs || material.docs.length === 0) {
      await cleanupUploadedDocs(newlyUploadedDocs);
      return res.status(400).json({
        success: false,
        message: "At least one document must be associated with the study material",
      });
    }

    await material.save();

    if (docsToDeleteFromCloud.length > 0) {
      await Promise.all(
        docsToDeleteFromCloud.map((doc) =>
          deleteCloudinaryAsset(doc.publicId, {
            resourceType: doc.resourceType || "raw",
          })
        )
      );
    }

    return res.status(200).json({
      success: true,
      message: "Study material updated successfully",
      data: material,
    });
  } catch (error) {
    console.error("Error updating study material:", error);
    await cleanupUploadedDocs(newlyUploadedDocs);
    return res.status(500).json({
      success: false,
      message: "Error updating study material",
      error: error.message,
    });
  }
};

export const deleteStudyMaterial = async (req, res) => {
  try {
    const material = await StudyMaterial.findByIdAndDelete(req.params.id);

    if (!material) {
      return res.status(404).json({
        success: false,
        message: "Study material not found",
      });
    }

    if (material.docs?.length) {
      await Promise.all(
        material.docs.map((doc) =>
          deleteCloudinaryAsset(doc.publicId, {
            resourceType: doc.resourceType || "raw",
          })
        )
      );
    }

    return res.status(200).json({
      success: true,
      message: "Study material deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting study material:", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting study material",
      error: error.message,
    });
  }
};
