import { validationResult } from "express-validator";
import Post from "../models/post.js";
import Educator from "../models/educator.js";
import notificationService from "../services/notification.service.js";

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

export const createPost = async (req, res) => {
  try {
    if (handleValidation(req, res)) {
      return;
    }

    const {
      educatorId,
      subjects: incomingSubjects,
      subject,
      specializations: incomingSpecializations,
      specialization,
      title,
      description,
    } = req.body;

    const subjects = Array.isArray(incomingSubjects)
      ? incomingSubjects
      : subject
      ? [subject]
      : [];
    const specializations = Array.isArray(incomingSpecializations)
      ? incomingSpecializations
      : specialization
      ? [specialization]
      : [];

    const normalizedSubjects = subjects.map((item) => item?.toLowerCase?.() ?? item);
    const uniqueSubjects = [...new Set(normalizedSubjects)];
    const uniqueSpecializations = [...new Set(specializations)];

    const educator = await Educator.findById(educatorId);

    if (!educator || educator.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Educator not found",
      });
    }

    const post = await Post.create({
      educatorId,
      subjects: uniqueSubjects,
      specializations: uniqueSpecializations,
      title,
      description,
    });

    await Educator.findByIdAndUpdate(educatorId, {
      $addToSet: { posts: post._id },
    });

    // Notify all followers of the educator
    try {
      await notificationService.notifyFollowers(educatorId, "post", {
        _id: post._id,
        title: post.title,
        slug: post._id.toString(), // Posts might not have slugs
        description: post.description,
        subjects: post.subjects,
        specializations: post.specializations,
      });
    } catch (notificationError) {
      console.error("Error sending notifications:", notificationError);
      // Don't fail the post creation if notification fails
    }

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: post,
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getAllPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      subject,
      specialization,
      educatorId,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};
    const andConditions = [];

    if (subject) {
      andConditions.push({
        $or: [{ subjects: subject }, { subject }],
      });
    }

    if (specialization) {
      andConditions.push({
        $or: [{ specializations: specialization }, { specialization }],
      });
    }

    if (educatorId) {
      filter.educatorId = educatorId;
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const posts = await Post.find(filter)
      .populate("educatorId", "fullName username slug profilePicture")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalPosts = await Post.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Posts retrieved successfully",
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPosts / parseInt(limit)),
          totalPosts,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id).populate(
      "educatorId",
      "fullName username slug profilePicture"
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Post retrieved successfully",
      data: post,
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getPostsByEducator = async (req, res) => {
  try {
    const { educatorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find({ educatorId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalPosts = await Post.countDocuments({ educatorId });

    res.status(200).json({
      success: true,
      message: "Posts retrieved successfully",
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPosts / parseInt(limit)),
          totalPosts,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching educator posts:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getPostsBySubject = async (req, res) => {
  try {
    const { subject } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [posts, totalPosts] = await Promise.all([
      Post.find({
        $or: [{ subjects: subject }, { subject }],
      })
        .populate("educatorId", "fullName username slug profilePicture")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Post.countDocuments({
        $or: [{ subjects: subject }, { subject }],
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Posts retrieved successfully",
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalPosts / parseInt(limit, 10)),
          totalPosts,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching posts by subject:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getPostsBySpecialization = async (req, res) => {
  try {
    const { specialization } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [posts, totalPosts] = await Promise.all([
      Post.find({
        $or: [{ specializations: specialization }, { specialization }],
      })
        .populate("educatorId", "fullName username slug profilePicture")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Post.countDocuments({
        $or: [{ specializations: specialization }, { specialization }],
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Posts retrieved successfully",
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalPosts / parseInt(limit, 10)),
          totalPosts,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching posts by specialization:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const searchPosts = async (req, res) => {
  try {
    const { q } = req.query;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const filter = {
      $text: { $search: q },
    };

    const [posts, totalPosts] = await Promise.all([
      Post.find(filter)
        .populate("educatorId", "fullName username slug profilePicture")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Post.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Posts retrieved successfully",
      data: {
        posts,
        pagination: {
          currentPage: parseInt(page, 10),
          totalPages: Math.ceil(totalPosts / parseInt(limit, 10)),
          totalPosts,
        },
      },
    });
  } catch (error) {
    console.error("Error searching posts:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const updatePost = async (req, res) => {
  try {
    if (handleValidation(req, res)) {
      return;
    }

    const { id } = req.params;
    const updateData = { ...req.body };

    if (Array.isArray(updateData.subjects)) {
      updateData.subjects = [
        ...new Set(
          updateData.subjects.map((item) => item?.toLowerCase?.() ?? item)
        ),
      ];
    } else if (updateData.subject) {
      updateData.subjects = [updateData.subject.toLowerCase()];
      delete updateData.subject;
    }

    if (Array.isArray(updateData.specializations)) {
      updateData.specializations = [...new Set(updateData.specializations)];
    } else if (updateData.specialization) {
      updateData.specializations = [updateData.specialization];
      delete updateData.specialization;
    }

    const post = await Post.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Post updated successfully",
      data: post,
    });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByIdAndDelete(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    await Educator.findByIdAndUpdate(post.educatorId, {
      $pull: { posts: post._id },
    });

    try {
      await notificationService.removeNotificationsForResource("post", post._id);
    } catch (cleanupError) {
      console.error(
        "Error removing notifications for deleted post:",
        post._id,
        cleanupError
      );
    }

    res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
