import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import questionRoutes from "./routes/questions.route.js";
import webinarRoutes from "./routes/webinar.route.js";
import educatorRoutes from "./routes/educator.route.js";
import testRoutes from "./routes/test.route.js";
import courseRoutes from "./routes/course.route.js";
import testSeriesRoutes from "./routes/testSeries.route.js";
import authRoutes from "./routes/auth.route.js";
import studentRoutes from "./routes/student.route.js";
import postRoutes from "./routes/post.route.js";
import paymentRoutes from "./routes/payment.route.js";
import educatorUpdateRoutes from "./routes/educatorUpdate.route.js";
import liveClassRoutes from "./routes/liveClass.route.js";
import studyMaterialRoutes from "./routes/studyMaterial.route.js";
import uploadRoutes from "./routes/upload.route.js";
import videoRoutes from "./routes/video.route.js";
import notificationRoutes from "./routes/notification.route.js";
import adminRoutes from "./routes/admin.route.js";
import educatorMessageRoutes from "./routes/educatorMessage.route.js";
import chatRoutes from "./routes/chat.route.js";
import queryRoutes from "./routes/query.route.js";
import connectDB from "./util/DBConnect.js";
import initializeNotificationSocket from "./sockets/notification.socket.js";
import { initializeChatNamespace } from "./sockets/chat.socket.js";
import { initializeStudentEducatorQueryNamespace } from "./sockets/studentEducator.socket.js";
dotenv.config();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const APP = express();
const server = createServer(APP);

// Initialize Socket.io with CORS configuration
const allowedOrigins = [
  process.env.NEXT_PUBLIC_EDUCATOR_DASHBOARD_URL,
  process.env.NEXT_PUBLIC_WEB_URL,
  process.env.NEXT_PUBLIC_SUPER_DASHBOARD_URL,
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Initialize notification socket handlers
initializeNotificationSocket(io);

// Initialize chat socket namespace
initializeChatNamespace(io);

// Initialize student-educator query namespace
initializeStudentEducatorQueryNamespace(io);

// Middleware
APP.use(
  cors({
    // Allow defined origins; in dev default to common localhost ports
    origin: allowedOrigins,
    credentials: true,
  })
);
APP.use(
  express.json({
    verify: (req, _res, buf) => {
      if (req.originalUrl.startsWith("/api/payments/webhook")) {
        req.rawBody = buf.toString();
      }
    },
  })
);
APP.use(express.urlencoded({ extended: true }));

// Use routes
APP.use("/api/auth", authRoutes);
APP.use("/api/admin", adminRoutes);
APP.use("/api/chat", chatRoutes);
APP.use("/api/queries", queryRoutes);
APP.use("/api/questions", questionRoutes);
APP.use("/api/webinars", webinarRoutes);
APP.use("/api/educators", educatorRoutes);
APP.use("/api/educators", educatorMessageRoutes);
APP.use("/api/tests", testRoutes);
APP.use("/api/courses", courseRoutes);
APP.use("/api/test-series", testSeriesRoutes);
APP.use("/api/students", studentRoutes);
APP.use("/api/live-classes", liveClassRoutes);
APP.use("/api/study-materials", studyMaterialRoutes);
APP.use("/api/videos", videoRoutes);
APP.use("/api/posts", postRoutes);
APP.use("/api/payments", paymentRoutes);
APP.use("/api/educator-update", educatorUpdateRoutes);
APP.use("/api/upload", uploadRoutes);
APP.use("/api/notifications", notificationRoutes);

const PORT = process.env.PORT || 5000;

APP.get("/", (req, res) => {
  res.send("Hello World!");
});

// Debug route to check Test model
APP.get("/debug/test-count", async (req, res) => {
  try {
    const { default: Test } = await import("./models/test.js");
    const count = await Test.countDocuments();
    res.json({
      success: true,
      testCount: count,
      message: "Test model is working",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Test model error",
    });
  }
});

// Server starting
server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
  console.log(`WebSocket server ready at ws://localhost:${PORT}`);
  connectDB();
});
