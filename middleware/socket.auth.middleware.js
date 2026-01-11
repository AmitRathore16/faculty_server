import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../util/token.js";

/**
 * Socket authentication middleware
 * Verifies JWT token from socket handshake and attaches user data to socket
 */
export const authenticateSocket = async (socket, next) => {
  try {
    // Extract token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Authentication error: Token not provided"));
    }

    // Verify token
    try {
      const decoded = verifyAccessToken(token);

      if (!decoded || !decoded.sub || !decoded.role) {
        return next(new Error("Authentication error: Invalid token payload"));
      }

      // Attach user data to socket
      socket.userId = decoded.sub;
      socket.userRole = decoded.role;

      console.log(
        `Socket authenticated: User ${socket.userId} (${socket.userRole})`
      );

      next();
    } catch (tokenError) {
      if (tokenError.name === "TokenExpiredError") {
        return next(new Error("Authentication error: Token expired"));
      } else if (tokenError.name === "JsonWebTokenError") {
        return next(new Error("Authentication error: Invalid token"));
      } else {
        return next(
          new Error("Authentication error: Token verification failed")
        );
      }
    }
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication error: Internal server error"));
  }
};

/**
 * Middleware to restrict socket connection to students only
 */
export const studentOnly = (socket, next) => {
  if (socket.userRole !== "student") {
    return next(
      new Error(
        "Authorization error: Only students can connect to notification socket"
      )
    );
  }
  next();
};

/**
 * Middleware to restrict socket connection to educators only
 */
export const educatorOnly = (socket, next) => {
  if (socket.userRole !== "educator") {
    return next(
      new Error(
        "Authorization error: Only educators can connect to this socket"
      )
    );
  }
  next();
};

/**
 * Middleware to restrict socket connection to admins only
 */
export const adminOnly = (socket, next) => {
  if (socket.userRole !== "admin") {
    return next(
      new Error("Authorization error: Only admins can connect to this socket")
    );
  }
  next();
};

/**
 * Middleware to restrict socket connection to admins or educators
 */
export const adminOrEducatorOnly = (socket, next) => {
  if (socket.userRole !== "admin" && socket.userRole !== "educator") {
    return next(
      new Error(
        "Authorization error: Only admins and educators can connect to this socket"
      )
    );
  }
  next();
};

/**
 * Middleware to restrict socket connection to students or educators
 */
export const studentOrEducatorOnly = (socket, next) => {
  if (socket.userRole !== "student" && socket.userRole !== "educator") {
    return next(
      new Error(
        "Authorization error: Only students and educators can connect to this socket"
      )
    );
  }
  next();
};

export default {
  authenticateSocket,
  studentOnly,
  educatorOnly,
  adminOnly,
  adminOrEducatorOnly,
  studentOrEducatorOnly,
};
