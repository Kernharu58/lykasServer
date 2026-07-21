const express = require("express");
const mongoose = require("mongoose");
const dns = require("dns");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const Message = require("./models/Message");
const User = require("./models/User");

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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);
app.use("/api/", apiMonitor);
app.use(maintenanceMode);

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

// ─── Routes ───────────────────────────────────────────────────────────────────
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
const inKindDonationRoutes = require("./routes/inKindDonationRoutes"); // ✅ Bug 1 fix
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
const { logServerError } = require("./controllers/errorLogController");
const { protect, restrictTo } = require("./middleware/authMiddleware");

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
app.use("/api/donations/goods", inKindDonationRoutes); // ✅ Bug 1 fix
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

// ─── Inline chat routes ───────────────────────────────────────────────────────
app.get("/api/messages/:userId", protect, async (req, res) => {
  try {
    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwnConversation = req.user._id.toString() === req.params.userId;
    if (!isAdmin && !isOwnConversation) {
      return res
        .status(403)
        .json({
          message: "You do not have permission to view these messages.",
        });
    }
    const messages = await Message.find({ userId: req.params.userId }).sort({
      createdAt: 1,
    });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get(
  "/api/chat-sessions",
  protect,
  restrictTo("admin", "staff", "super_admin"),
  async (_req, res) => {
    try {
      const allUsers = await User.find({}).select("-password");
      const latestMessages = await Message.aggregate([
        { $sort: { createdAt: -1 } },
        {
          $group: { _id: "$userId", latestMessageAt: { $first: "$createdAt" } },
        },
        { $sort: { latestMessageAt: -1 } },
      ]);

      const activeUserIds = latestMessages.map((msg) => msg._id.toString());
      const activeUsers = activeUserIds
        .map((id) => allUsers.find((user) => user._id.toString() === id))
        .filter(Boolean);
      const inactiveUsers = allUsers.filter(
        (user) => !activeUserIds.includes(user._id.toString()),
      );
      res.status(200).json([...activeUsers, ...inactiveUsers]);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

// ─── Error handlers (must come after all routes) ─────────────────────────────
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
    statusCode: 500,
    userId: req.user?._id || null,
  });
  res.status(500).json({ message: "Something went wrong!" });
});

// ─── HTTP + Socket.IO server ──────────────────────────────────────────────────
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};

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

require("./cronJob");

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  });
