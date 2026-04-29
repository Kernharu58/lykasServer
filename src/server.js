const express = require("express");
const mongoose = require("mongoose");
const dns = require("dns");
const cors = require("cors");
const dotenv = require("dotenv");

// Use reliable public DNS servers for MongoDB SRV record resolution
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const http = require("http");
const { Server } = require("socket.io");
const Message = require("./models/Message");
// Security Middleware
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const User = require("./models/User");

// Load environment variables from the .env file
dotenv.config();

// Initialize the Express application
const app = express();

app.set('trust proxy', 1);

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Adds secure HTTP headers to prevent XSS and clickjacking
app.use(helmet());

// 2. Prevents spam/DDoS attacks (Max 100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many requests from this IP, please try again later."
});
app.use("/api/", limiter);

// --- Routes ---
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// Pet Routes
const petRoutes = require("./routes/petRoutes");
app.use("/api/pets", petRoutes);

// Volunteer Routes
const appointmentRoutes = require("./routes/appointmentRoutes");
app.use("/api/appointments", appointmentRoutes);

// ✅ FIX 1: Moved settingsRoutes up here with the other routes (was incorrectly placed AFTER server.listen)
const settingsRoutes = require("./routes/settingsRoutes");
app.use("/api/settings", settingsRoutes);

// --- Message Routes ---
// Fetch chat history for a SPECIFIC user
app.get("/api/messages/:userId", async (req, res) => {
  try {
    const messages = await Message.find({ userId: req.params.userId }).sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch ALL unique chat sessions (Used by Admin Dashboard Sidebar)
app.get("/api/chat-sessions", async (req, res) => {
  try {
    // 1. Fetch ALL users in the database (excluding passwords)
    const allUsers = await User.find({}).select('-password');

    // 2. Find the most recent message for each user to see who is active
    const latestMessages = await Message.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$userId",
          latestMessageAt: { $first: "$createdAt" }
        }
      },
      { $sort: { latestMessageAt: -1 } }
    ]);

    const activeUserIds = latestMessages.map(msg => msg._id.toString());

    // 3. Sort users: Active users on top, inactive users at the bottom
    const activeUsers = activeUserIds.map(id =>
      allUsers.find(user => user._id.toString() === id)
    ).filter(Boolean);

    const inactiveUsers = allUsers.filter(user => !activeUserIds.includes(user._id.toString()));

    // 4. Send the combined list back to the admin dashboard
    res.status(200).json([...activeUsers, ...inactiveUsers]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- Database Connection ---
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// --- Basic Route Testing ---
app.get("/", (req, res) => {
  res.send("CarePaws API is running...");
});

// --- Server Initialization ---
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Handle Real-Time Connections
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // Mobile App Users join their own private room
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    console.log(`👤 User joined private room: ${userId}`);
  });

  // Admin Dashboard joins a master listening room
  socket.on("joinAdmin", () => {
    socket.join("admin_room");
    console.log("🛡️ Admin joined the master admin_room");
  });

  // Handle incoming messages from ANYONE
  socket.on("sendMessage", async (data) => {
    try {
      const savedMessage = await Message.create(data);
      io.to(data.userId).to("admin_room").emit("receiveMessage", savedMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Add this near the top with your other requires
require("./cronJob");  // ← add this line
// Add this health route before your other routes
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

