import express from "express";
import multer from "multer";
import {
  createVideo,
  deleteVideo,
  getVideoById,
  getVideos,
  updateVideo,
  uploadVideoToVimeoController,
} from "../controllers/video.controller.js";
import {
  createVideoValidation,
  updateVideoValidation,
  validateObjectId,
} from "../util/validation.js";

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

router.post("/", createVideoValidation, createVideo);
router.post(
  "/upload-to-vimeo",
  upload.single("video"),
  uploadVideoToVimeoController
);
router.get("/", getVideos);
router.get("/:id", validateObjectId(), getVideoById);
router.put(
  "/:id",
  [...validateObjectId(), ...updateVideoValidation],
  updateVideo
);
router.delete("/:id", validateObjectId(), deleteVideo);

export default router;
