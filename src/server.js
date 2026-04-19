const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

const http = require("http");
const { Server } = require("socket.io");
const Message = require("./models/Message"); // Import the new model
// Security Middleware
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const User = require("./models/User");

// Load environment variables from the .env file
dotenv.config();

// Initialize the Express application
const app = express();

// 👉 ADD THIS LINE TO FIX THE ERROR
app.set('trust proxy', 1);

// --- Middleware ---
// CORS allows requests from your React Native app
app.use(cors());
// Built-in middleware to parse incoming JSON requests
app.use(express.json());
// Built-in middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// 1. Adds secure HTTP headers to prevent XSS and clickjacking
app.use(helmet()); 

// 2. Prevents spam/DDoS attacks (Max 100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
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

// 👉 MESSAGE ROUTES (Consolidated)
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
    // Simply pass the URI, no extra options needed for Mongoose 9+
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Exit process with failure code if the database doesn't connect
    process.exit(1);
  }
};

// --- Basic Route Testing ---
app.get("/", (req, res) => {
  res.send("CarePaws API is running...");
});

// --- Server Initialization ---
const PORT = process.env.PORT || 5000;

// 👉 3. Wrap Express with HTTP and Initialize Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // Allow your Expo app to connect securely
});

// 👉 4. Handle Real-Time Connections (Unified Logic)
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // 1. Mobile App Users join their own private room
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    console.log(`👤 User joined private room: ${userId}`);
  });

  // 2. Admin Dashboard joins a master listening room
  socket.on("joinAdmin", () => {
    socket.join("admin_room");
    console.log("🛡️ Admin joined the master admin_room");
  });

  // 3. Handle incoming messages from ANYONE
  socket.on("sendMessage", async (data) => {
    try {
      // Save to MongoDB
      const savedMessage = await Message.create(data);
      
      // 👉 EMIT TO BOTH: The specific user's room AND the admin room
      io.to(data.userId).to("admin_room").emit("receiveMessage", savedMessage);
      
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// 👉 5. Start the wrapped server (NOTE: using server.listen instead of app.listen!)
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

// Add this right below where you define app.use("/api/auth", authRoutes);
const settingsRoutes = require("./routes/settingsRoutes");
app.use("/api/settings", settingsRoutes);

const message = require("./models/Message"); // Import the new model