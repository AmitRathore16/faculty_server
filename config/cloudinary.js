import "dotenv/config";
import path from "path";
import multer from "multer";
import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import {
  MAX_STUDY_MATERIAL_FILE_COUNT,
  MAX_STUDY_MATERIAL_FILE_SIZE,
} from "../util/studyMaterial.js";

const { CLOUD_NAME, CLOUD_API_KEY, CLOUD_API_SECRET } = process.env;

if (!CLOUD_NAME || !CLOUD_API_KEY || !CLOUD_API_SECRET) {
  throw new Error(
    "Cloudinary environment variables are missing. Please set CLOUD_NAME, CLOUD_API_KEY, and CLOUD_API_SECRET."
  );
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: CLOUD_API_KEY,
  api_secret: CLOUD_API_SECRET,
  secure: true,
});

const educatorImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "facultypedia/educators",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

const courseImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "facultypedia/courses",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1280, height: 720, crop: "limit" }],
  },
});

export const uploadEducatorImage = multer({
  storage: educatorImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

export const uploadCourseImage = multer({
  storage: courseImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

const dynamicStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const type = req.query.type || "misc";
    let folder = "facultypedia/misc";
    let transformation = [{ width: 1280, height: 720, crop: "limit" }];

    switch (type) {
      case "educator":
        folder = "facultypedia/educators";
        transformation = [{ width: 800, height: 800, crop: "limit" }];
        break;
      case "course":
        folder = "facultypedia/courses";
        break;
      case "test":
        folder = "facultypedia/tests";
        break;
    }

    return {
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
      transformation,
    };
  },
});

export const uploadGenericImage = multer({
  storage: dynamicStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 5 MB
  },
});

const STUDY_MATERIAL_FOLDER = "facultypedia/study-materials";
const PDF_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "applications/vnd.pdf",
]);

const buildStudyMaterialPublicId = (originalName = "") => {
  const baseName = path.parse(originalName).name || "study-material";
  const normalized = baseName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "study-material";
  return `${normalized}-${Date.now()}`;
};

const getStudyMaterialUploadOptions = (file) => ({
  folder: STUDY_MATERIAL_FOLDER,
  resource_type: "raw",
  type: "upload",
  overwrite: false,
  use_filename: false,
  unique_filename: false,
  public_id: `${buildStudyMaterialPublicId(file?.originalname)}`,
  format: "pdf",
});

const bufferToStream = (buffer) => {
  const readable = new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    },
  });
  return readable;
};

export const uploadStudyMaterialPdfBuffer = (file) =>
  new Promise((resolve, reject) => {
    if (!file?.buffer) {
      reject(new Error("Invalid PDF buffer provided for upload"));
      return;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      getStudyMaterialUploadOptions(file),
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );

    bufferToStream(file.buffer).pipe(uploadStream);
  });

export const uploadStudyMaterialDoc = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_STUDY_MATERIAL_FILE_SIZE,
    files: MAX_STUDY_MATERIAL_FILE_COUNT,
  },
  fileFilter: (_req, file, cb) => {
    const mimeType = (file?.mimetype || "").toLowerCase();
    if (!PDF_MIME_TYPES.has(mimeType)) {
      cb(new Error("Only PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const deleteCloudinaryAsset = async (
  publicId,
  { resourceType = "image" } = {}
) => {
  if (!publicId) {
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    console.error("Failed to delete Cloudinary asset", error);
  }
};

export default cloudinary;
