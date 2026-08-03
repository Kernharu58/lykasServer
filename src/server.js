const express = require("express");
const mongoose = require("mongoose");
const dns = require("dns");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");

const Message = require("./models/Message");
const User = require("./models/User");
const Session = require("./models/Session");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");

dotenv.config();

// Use reliable public DNS servers for MongoDB SRV record resolution.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);

const apiMonitor = require("./middleware/apiMonitorMiddleware");
const maintenanceMode = require("./middleware/maintenanceMode");
const { logServerError } = require("./controllers/errorLogController");

const isDev = process.env.NODE_ENV !== "production";
const devOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (!isDev && allowedOrigins.length > 0) {
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      }

      if (isDev || allowedOrigins.length === 0) {
        if ([...allowedOrigins, ...devOrigins].includes(origin))
          return callback(null, true);
        if (isDev) return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/", (_req, res) => {
  res.send("CarePaws API is running...");
});

// ─── HTTP + Socket.IO server ──────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin:
      allowedOrigins.length > 0 && process.env.NODE_ENV === "production"
        ? allowedOrigins
        : "*",
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.use(async (socket, next) => {
  try {
    const authHeader = socket.handshake.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
    const token = socket.handshake.auth?.token || bearerToken;
    if (!token) return next(new Error("Authentication required"));

    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Mirrors authMiddleware.js's protect(): a token whose session has been
    // revoked (logged out elsewhere, "revoke this device", etc.) shouldn't
    // be able to open a socket connection either, not just be blocked from
    // REST calls.
    if (decoded.sessionId) {
      const session = await Session.findById(decoded.sessionId).select("revoked");
      if (!session || session.revoked) return next(new Error("Session revoked"));
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) return next(new Error("User not found"));

    socket.user = user;
    return next();
  } catch (error) {
    return next(new Error("Invalid socket token"));
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const isAdminUser = () =>
    ["admin", "staff", "super_admin"].includes(socket.user.role);

  if (!isAdminUser()) {
    const ownRoom = socket.user._id.toString();
    socket.join(ownRoom);
    console.log(`User auto-joined their room: ${ownRoom}`);
  }

  socket.on("joinRoom", (userId) => {
    const isOwnRoom = socket.user._id.toString() === userId;
    if (!isAdminUser() && !isOwnRoom) return;
    socket.join(userId);
    console.log(`User joined private room: ${userId}`);
  });

  socket.on("joinAdmin", () => {
    if (!isAdminUser()) return;
    socket.join("admin_room");
    console.log("Admin joined the master admin_room");
  });

  socket.on("sendMessage", async (data) => {
    try {
      const isAdmin = isAdminUser();
      const isOwnConversation = socket.user._id.toString() === data.userId;
      if (!isAdmin && !isOwnConversation) return;

      const sender = isOwnConversation ? "user" : "shelter";
      const savedMessage = await Message.create({
        userId: data.userId,
        text: data.text,
        sender,
        image: data.image || "",
      });

      io.to(data.userId).to("admin_room").emit("receiveMessage", savedMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ─── Bootstrap ─────────────────────────────────────────────────────────────
// Mongo and Redis both connect *before* the resource routers are required.
// This matters specifically for Redis: rateLimitMiddleware.js decides, at
// require-time, whether each limiter is backed by a RedisStore or falls
// back to the in-memory default — so those route modules (which pull in
// rateLimitMiddleware indirectly via authRoutes.js) must not be required
// until connectRedis() has already resolved, or every limiter would decide
// "no Redis" permanently regardless of whether the connection succeeds a
// moment later.
const bootstrap = async () => {
  await connectDB();
  await connectRedis(); // safe no-op if REDIS_URL isn't set — see config/redis.js

  const { globalLimiter } = require("./middleware/rateLimitMiddleware");
  app.use("/api/", globalLimiter);
  app.use("/api/", apiMonitor);
  app.use(maintenanceMode);

  // ─── Routes ─────────────────────────────────────────────────────────────
  const authRoutes = require("./routes/authRoutes");
  const petRoutes = require("./routes/petRoutes");
  const appointmentRoutes = require("./routes/appointmentRoutes");
  const settingsRoutes = require("./routes/settingsRoutes");
  const applicationRoutes = require("./routes/applicationRoutes");
  const auditLogRoutes = require("./routes/auditLogRoutes");
  const volunteerRoutes = require("./routes/volunteerRoutes");
  const shelterCareRoutes = require("./routes/shelterCareRoutes");
  const medicalRoutes = require("./routes/medicalRecordRoutes");
  const interviewRoutes = require("./routes/interviewRoutes");
  const homeVisitRoutes = require("./routes/homeVisitRoutes");
  const riskAssessmentRoutes = require("./routes/riskAssessmentRoutes");
  const fosterRoutes = require("./routes/fosterRoutes");
  const monitoringReportRoutes = require("./routes/monitoringReportRoutes");
  const babyBookRoutes = require("./routes/babyBookRoutes");
  const eventRoutes = require("./routes/eventRoutes");
  const notificationRoutes = require("./routes/notificationRoutes");
  const paymentRoutes = require("./routes/paymentRoutes");
  const eventAssignmentRoutes = require("./routes/eventAssignmentRoutes");
  const dashboardRoutes = require("./routes/dashboardRoutes");
  const userDocumentRoutes = require("./routes/userDocumentRoutes");
  const adopterProfileRoutes = require("./routes/adopterProfileRoutes");
  const emergencyReportRoutes = require("./routes/emergencyReportRoutes");
  const reportsRoutes = require("./routes/reportsRoutes");
  const inKindDonationRoutes = require("./routes/inKindDonationRoutes");
  const analyticsRoutes = require("./routes/analyticsRoutes");
  const contentRoutes = require("./routes/contentRoutes");
  const shelterRoutes = require("./routes/shelterRoutes");
  const inventoryRoutes = require("./routes/inventoryRoutes");
  const feedbackRoutes = require("./routes/feedbackRoutes");
  const noteRoutes = require("./routes/noteRoutes");
  const systemRoutes = require("./routes/systemRoutes");
  const roleRoutes = require("./routes/roleRoutes");
  const backupRoutes = require("./routes/backupRoutes");
  const scheduledJobRoutes = require("./routes/scheduledJobRoutes");
  const emailTemplateRoutes = require("./routes/emailTemplateRoutes");
  const fileAssetRoutes = require("./routes/fileAssetRoutes");
  const apiMonitoringRoutes = require("./routes/apiMonitoringRoutes");
  const archiveRoutes = require("./routes/archiveRoutes");
  const duplicateRoutes = require("./routes/duplicateRoutes");
  const featureFlagRoutes = require("./routes/featureFlagRoutes");
  const announcementRoutes = require("./routes/announcementRoutes");
  const migrationRoutes = require("./routes/migrationRoutes");
  const apiKeyRoutes = require("./routes/apiKeyRoutes");
  const errorLogRoutes = require("./routes/errorLogRoutes");
  const messageRoutes = require("./routes/messageRoutes");

  app.use("/api/auth", authRoutes);
  app.use("/api/pets", petRoutes);
  app.use("/api/appointments", appointmentRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/applications", applicationRoutes);
  app.use("/api/audit-logs", auditLogRoutes);
  app.use("/api/volunteers", volunteerRoutes);
  app.use("/api/shelter-care", shelterCareRoutes);
  app.use("/api/medical", medicalRoutes);
  app.use("/api/interviews", interviewRoutes);
  app.use("/api/home-visits", homeVisitRoutes);
  app.use("/api/risk-assessments", riskAssessmentRoutes);
  app.use("/api/foster", fosterRoutes);
  app.use("/api/monitoring-reports", monitoringReportRoutes);
  app.use("/api/baby-book", babyBookRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/event-assignments", eventAssignmentRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/documents", userDocumentRoutes);
  app.use("/api/adopter-profile", adopterProfileRoutes);
  app.use("/api/emergency-reports", emergencyReportRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/donations/goods", inKindDonationRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/content", contentRoutes);
  app.use("/api/shelters", shelterRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/feedback", feedbackRoutes);
  app.use("/api/notes", noteRoutes);
  app.use("/api/system", systemRoutes);
  app.use("/api/roles", roleRoutes);
  app.use("/api/backups", backupRoutes);
  app.use("/api/scheduled-jobs", scheduledJobRoutes);
  app.use("/api/email-templates", emailTemplateRoutes);
  app.use("/api/files", fileAssetRoutes);
  app.use("/api/monitoring/api", apiMonitoringRoutes);
  app.use("/api/archive", archiveRoutes);
  app.use("/api/duplicates", duplicateRoutes);
  app.use("/api/feature-flags", featureFlagRoutes);
  app.use("/api/announcements", announcementRoutes);
  app.use("/api/migrations", migrationRoutes);
  app.use("/api/api-keys", apiKeyRoutes);
  app.use("/api/errors", errorLogRoutes);

  // Chat REST fallback (§4/§5.3) — extracted out of server.js into a real
  // route + controller module. GET /api/chat-sessions is mounted as its own
  // top-level path (not nested under /api/messages) to match the real,
  // already-shipped API surface exactly.
  app.use("/api/messages", messageRoutes);
  app.use("/api/chat-sessions", messageRoutes.chatSessionsRouter);

  // ─── Error handlers (must come after all routes) ───────────────────────
  app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  app.use((err, req, res, _next) => {
    console.error(err.stack);
    logServerError({
      message: err.message,
      stack: err.stack,
      route: req.originalUrl,
      method: req.method,
      statusCode: err.status || 500,
      userId: req.user?._id || null,
    });

    // Multer reports its own errors (file too large, wrong field name, etc.)
    // as a MulterError; our upload middleware's fileFilter attaches
    // `err.status`/`err.code` for unsupported file types (see
    // middleware/uploadMiddleware.js). Both deserve a 400, not a generic 500.
    if (err.name === "MulterError") {
      return res.status(400).json({ message: err.message, code: err.code });
    }
    if (err.status && err.status < 500) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }

    res.status(500).json({ message: "Something went wrong!" });
  });

  require("./cronJob");

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

bootstrap().catch((error) => {
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});
