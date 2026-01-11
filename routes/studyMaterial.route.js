import express from "express";
import {
  createStudyMaterial,
  deleteStudyMaterial,
  getAllStudyMaterials,
  getStudyMaterialByCourse,
  getStudyMaterialById,
  getStudyMaterialsByEducator,
  updateStudyMaterial,
} from "../controllers/studyMaterial.controller.js";
import {
  createStudyMaterialValidation,
  updateStudyMaterialValidation,
  validateCourseIdParam,
  validateEducatorIdParam,
  validateObjectId,
} from "../util/validation.js";
import { MAX_STUDY_MATERIAL_FILE_COUNT } from "../util/studyMaterial.js";
import { uploadStudyMaterialDoc } from "../config/cloudinary.js";

const router = express.Router();

const registerUploadedDocsCount = (req, _res, next) => {
  req.body.uploadedDocs = req.files?.length || 0;
  next();
};

router.post(
  "/",
  uploadStudyMaterialDoc.array("docs", MAX_STUDY_MATERIAL_FILE_COUNT),
  registerUploadedDocsCount,
  createStudyMaterialValidation,
  createStudyMaterial
);
router.get("/", getAllStudyMaterials);
router.get(
  "/educator/:educatorId",
  validateEducatorIdParam,
  getStudyMaterialsByEducator
);
router.get(
  "/course/:courseId",
  validateCourseIdParam,
  getStudyMaterialByCourse
);
router.get("/:id", validateObjectId(), getStudyMaterialById);
router.put(
  "/:id",
  uploadStudyMaterialDoc.array("docs", MAX_STUDY_MATERIAL_FILE_COUNT),
  registerUploadedDocsCount,
  [...validateObjectId(), ...updateStudyMaterialValidation],
  updateStudyMaterial
);
router.delete("/:id", validateObjectId(), deleteStudyMaterial);

export default router;
