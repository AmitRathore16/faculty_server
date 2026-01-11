import express from "express";
import {
  uploadGenericImage,
  uploadStudyMaterialDoc,
  uploadStudyMaterialPdfBuffer,
} from "../config/cloudinary.js";

const router = express.Router();

router.post("/image", uploadGenericImage.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No image file provided" });
    }

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      imageUrl: req.file.path,
      publicId: req.file.filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Image upload failed",
        error: error.message,
      });
  }
});

router.post(
  "/pdf",
  uploadStudyMaterialDoc.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No PDF file provided" });
      }

      const result = await uploadStudyMaterialPdfBuffer(req.file);

      return res.status(200).json({
        success: true,
        message: "PDF uploaded successfully",
        fileUrl: result?.secure_url || result?.url,
        publicId: result?.public_id,
        originalName: req.file?.originalname,
      });
    } catch (error) {
      console.error("PDF upload error:", error);
      return res.status(500).json({
        success: false,
        message: "PDF upload failed",
        error: error.message,
      });
    }
  }
);

export default router;
