import mongoose from "mongoose";
import { STUDY_MATERIAL_FILE_TYPES } from "../util/constants.js";

const { Schema } = mongoose;

const documentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    fileType: {
      type: String,
      enum: STUDY_MATERIAL_FILE_TYPES,
      required: true,
    },
    sizeInBytes: {
      type: Number,
      min: 0,
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    resourceType: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "raw",
    },
  },
  { _id: true }
);

const studyMaterialSchema = new Schema(
  {
    educatorID: {
      type: Schema.Types.ObjectId,
      ref: "Educator",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    docs: {
      type: [documentSchema],
      validate: {
        validator: (documents) => Array.isArray(documents) && documents.length > 0,
        message: "At least one document entry is required",
      },
      required: true,
    },
    isCourseSpecific: {
      type: Boolean,
      default: false,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required() {
        return this.isCourseSpecific;
      },
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 50,
      },
    ],
  },
  {
    timestamps: true,
  }
);

studyMaterialSchema.index({ courseId: 1 });
studyMaterialSchema.index({ title: "text", description: "text" });

export default mongoose.model("StudyMaterial", studyMaterialSchema);
