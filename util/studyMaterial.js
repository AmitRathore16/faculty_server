import path from "path";
import { STUDY_MATERIAL_FILE_TYPES } from "./constants.js";

export const MAX_STUDY_MATERIAL_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file
export const MAX_STUDY_MATERIAL_FILE_COUNT = 10;

const extensionToTypeMap = new Map([
  [".pdf", "PDF"],
  [".ppt", "PPT"],
  [".pptx", "PPTX"],
  [".doc", "DOC"],
  [".docx", "DOCX"],
  [".xls", "XLS"],
  [".xlsx", "XLSX"],
  [".csv", "CSV"],
  [".zip", "ZIP"],
  [".rar", "ZIP"],
  [".txt", "OTHER"],
  [".mp4", "VIDEO"],
  [".mov", "VIDEO"],
  [".avi", "VIDEO"],
  [".png", "IMAGE"],
  [".jpg", "IMAGE"],
  [".jpeg", "IMAGE"],
  [".webp", "IMAGE"],
]);

const mimeToTypeMap = new Map([
  ["application/pdf", "PDF"],
  ["application/vnd.ms-powerpoint", "PPT"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "PPTX"],
  ["application/msword", "DOC"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX"],
  ["application/vnd.ms-excel", "XLS"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "XLSX"],
  ["text/csv", "CSV"],
  ["application/zip", "ZIP"],
  ["application/x-rar-compressed", "ZIP"],
  ["text/plain", "OTHER"],
  ["video/mp4", "VIDEO"],
  ["video/quicktime", "VIDEO"],
  ["video/x-msvideo", "VIDEO"],
  ["image/png", "IMAGE"],
  ["image/jpeg", "IMAGE"],
  ["image/webp", "IMAGE"],
]);

export const determineStudyMaterialFileType = (originalName = "", mimeType = "") => {
  const normalizedMime = mimeType?.toLowerCase?.() ?? "";
  const mimeMatch = mimeToTypeMap.get(normalizedMime);
  if (mimeMatch && STUDY_MATERIAL_FILE_TYPES.includes(mimeMatch)) {
    return mimeMatch;
  }

  const extension = path.extname(originalName || "").toLowerCase();
  const extMatch = extensionToTypeMap.get(extension);
  if (extMatch && STUDY_MATERIAL_FILE_TYPES.includes(extMatch)) {
    return extMatch;
  }

  return "OTHER";
};

export const sanitizeArrayPayload = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_error) {
      // Fall through to comma split
    }

    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
};

export const normalizeSingleValue = (value) => {
  if (Array.isArray(value)) {
    return normalizeSingleValue(value[0]);
  }

  if (value === null || typeof value === "undefined") {
    return "";
  }

  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "value")) {
      return normalizeSingleValue(value.value);
    }
    return "";
  }

  return String(value);
};
