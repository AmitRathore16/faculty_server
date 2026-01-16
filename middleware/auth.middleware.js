import Educator from "../models/educator.js";
import Admin from "../models/admin.js";
import Student from "../models/student.js";
import { verifyAccessToken } from "../util/token.js";

const buildErrorResponse = (res, status, message) =>
  res.status(status).json({ success: false, message });

export const authenticateEducator = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return buildErrorResponse(res, 401, "Authorization header missing");
    }

    const token = authHeader.split(" ")[1];
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      return buildErrorResponse(res, 401, "Invalid or expired token");
    }

    if (payload.role !== "educator") {
      return buildErrorResponse(res, 403, "Educator access required");
    }

    const educator = await Educator.findById(payload.sub);
    if (!educator) {
      return buildErrorResponse(res, 404, "Educator not found");
    }

    req.educator = educator;
    req.auth = {
      educatorId: educator._id,
      tokenPayload: payload,
    };

    next();
  } catch (error) {
    console.error("Educator auth middleware error:", error);
    buildErrorResponse(res, 500, "Authentication failed");
  }
};

export const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return buildErrorResponse(res, 401, "Authorization header missing");
    }

    const token = authHeader.split(" ")[1];
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      return buildErrorResponse(res, 401, "Invalid or expired token");
    }

    if (payload.role !== "admin") {
      return buildErrorResponse(res, 403, "Admin access required");
    }

    const admin = await Admin.findById(payload.sub);
    if (!admin) {
      return buildErrorResponse(res, 404, "Admin not found");
    }

    if (admin.status !== "active") {
      return buildErrorResponse(res, 403, "Admin account is inactive");
    }

    req.admin = admin;
    req.auth = {
      adminId: admin._id,
      tokenPayload: payload,
    };

    next();
  } catch (error) {
    console.error("Admin auth middleware error:", error);
    buildErrorResponse(res, 500, "Authentication failed");
  }
};
export const authenticateAnyUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return buildErrorResponse(res, 401, "Authorization header missing");
    }

    const token = authHeader.split(" ")[1];
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      return buildErrorResponse(res, 401, "Invalid or expired token");
    }

    if (payload.role === "admin") {
      const admin = await Admin.findById(payload.sub);
      if (!admin || admin.status !== "active") {
        return buildErrorResponse(res, 404, "Admin not found or inactive");
      }
      req.admin = admin;
      req.auth = {
        userId: admin._id,
        userType: "admin",
        tokenPayload: payload,
      };
    } else if (payload.role === "educator") {
      const educator = await Educator.findById(payload.sub);
      if (!educator) {
        return buildErrorResponse(res, 404, "Educator not found");
      }
      req.educator = educator;
      req.auth = {
        userId: educator._id,
        userType: "educator",
        tokenPayload: payload,
      };
    } else if (payload.role === "student") {
      const student = await Student.findById(payload.sub);
      if (!student) {
        return buildErrorResponse(res, 404, "Student not found");
      }
      if (!student.isActive) {
        return buildErrorResponse(res, 403, "Student account is inactive");
      }
      req.student = student;
      req.auth = {
        userId: student._id,
        userType: "student",
        tokenPayload: payload,
      };
    } else {
      return buildErrorResponse(res, 403, "Unauthorized role");
    }

    next();
  } catch (error) {
    console.error("AnyUser auth middleware error:", error);
    buildErrorResponse(res, 500, "Authentication failed");
  }
};

export const authenticateStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return buildErrorResponse(res, 401, "Authorization header missing");
    }

    const token = authHeader.split(" ")[1];
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      return buildErrorResponse(res, 401, "Invalid or expired token");
    }

    if (payload.role !== "student") {
      return buildErrorResponse(res, 403, "Student access required");
    }

    const student = await Student.findById(payload.sub);
    if (!student) {
      return buildErrorResponse(res, 404, "Student not found");
    }

    if (!student.isActive) {
      return buildErrorResponse(res, 403, "Student account is inactive");
    }

    req.student = student;
    req.auth = {
      studentId: student._id,
      tokenPayload: payload,
    };

    next();
  } catch (error) {
    console.error("Student auth middleware error:", error);
    buildErrorResponse(res, 500, "Authentication failed");
  }
};

export const authenticateAdminOrEducator = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return buildErrorResponse(res, 401, "Authorization header missing");
    }

    const token = authHeader.split(" ")[1];
    let payload;

    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      return buildErrorResponse(res, 401, "Invalid or expired token");
    }

    if (payload.role === "admin") {
      const admin = await Admin.findById(payload.sub);
      if (!admin || admin.status !== "active") {
        return buildErrorResponse(res, 404, "Admin not found or inactive");
      }
      req.admin = admin;
      req.auth = {
        userId: admin._id,
        userType: "admin",
        tokenPayload: payload,
      };
    } else if (payload.role === "educator") {
      const educator = await Educator.findById(payload.sub);
      if (!educator) {
        return buildErrorResponse(res, 404, "Educator not found");
      }
      req.educator = educator;
      req.auth = {
        userId: educator._id,
        userType: "educator",
        tokenPayload: payload,
      };
    } else {
      return buildErrorResponse(res, 403, "Admin or Educator access required");
    }

    next();
  } catch (error) {
    console.error("Admin/Educator auth middleware error:", error);
    buildErrorResponse(res, 500, "Authentication failed");
  }
};
