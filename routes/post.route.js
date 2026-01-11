 import express from "express";
import {
  createPost,
  deletePost,
  getAllPosts,
  getPostById,
  getPostsByEducator,
  getPostsBySpecialization,
  getPostsBySubject,
  searchPosts,
  updatePost,
} from "../controllers/post.controller.js";
import {
  createPostValidation,
  getPostsBySpecializationValidation,
  getPostsBySubjectValidation,
  searchPostsValidation,
  updatePostValidation,
  validateEducatorIdParam,
  validateObjectId,
} from "../util/validation.js";

const router = express.Router();

router.post("/", createPostValidation, createPost);
router.get("/", getAllPosts);
router.get(
  "/educator/:educatorId",
  validateEducatorIdParam,
  getPostsByEducator
);
router.get("/:id", validateObjectId(), getPostById);
router.put(
  "/:id",
  [...validateObjectId(), ...updatePostValidation],
  updatePost
);
router.delete("/:id", validateObjectId(), deletePost);

router.get("/subject/:subject", getPostsBySubjectValidation, getPostsBySubject);
router.get(
  "/specialization/:specialization",
  getPostsBySpecializationValidation,
  getPostsBySpecialization
);
router.get("/search", searchPostsValidation, searchPosts);

export default router;
