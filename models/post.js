import mongoose from "mongoose";

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    educatorId: {
      type: Schema.Types.ObjectId,
      ref: "Educator",
      required: true,
      index: true,
    },
    subjects: {
      type: [
        {
          type: String,
          enum: [
            "biology",
            "physics",
            "mathematics",
            "chemistry",
            "english",
            "hindi",
          ],
          lowercase: true,
          trim: true,
        },
      ],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one subject is required",
      },
      required: true,
    },
    specializations: {
      type: [
        {
          type: String,
          enum: ["IIT-JEE", "NEET", "CBSE"],
          trim: true,
        },
      ],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one specialization is required",
      },
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

postSchema.index({ specializations: 1 });
postSchema.index({ subjects: 1 });
postSchema.index({ title: "text", description: "text" });

export default mongoose.model("Post", postSchema);
