import mongoose from "mongoose";

const { Schema } = mongoose;

const MAX_LINK_LENGTH = 500;

const videoSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    links: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: MAX_LINK_LENGTH,
        },
      ],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one video link is required",
      },
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
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

videoSchema.index({ title: "text" });

export default mongoose.model("Video", videoSchema);
