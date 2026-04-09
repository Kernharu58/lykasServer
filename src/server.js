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
// 👉 FIX 1: Add the messages route HERE, before the database connects!
app.get("/api/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: 1 }); 
    res.status(200).json(messages);
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

// 👉 4. Handle Real-Time Connections
io.on("connection", (socket) => {
  console.log("🟢 A user connected to the chat:", socket.id);

  // When the server hears a "sendMessage" event from the frontend...
  socket.on("sendMessage", async (data) => {
    try {
      // Save the message to MongoDB instantly
      const savedMessage = await Message.create(data);
      // Broadcast that exact message to everyone connected!
      io.emit("receiveMessage", savedMessage);
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
// --- Additional Routes ---
app.get("/api/messages", async (req, res) => {
  try {
    // Fetches all messages and sorts them from oldest to newest
    const messages = await Message.find().sort({ createdAt: 1 }); 
    // Sends the messages back to the frontend
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 👉 GET: Fetch chat history for a SPECIFIC user (Used by Mobile App)
app.get("/api/messages/:userId", async (req, res) => {
  try {
    const messages = await Message.find({ userId: req.params.userId }).sort({ createdAt: 1 }); 
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 👉 GET: Fetch ALL unique chat sessions (Used by Admin Dashboard Sidebar)
app.get("/api/chat-sessions", async (req, res) => {
  try {
    // This finds all distinct users who have sent a message
    const activeUsers = await Message.distinct('userId');
    // You might want to populate this with User details (name, email) later!
    res.status(200).json(activeUsers); 
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  // 👉 NEW: Users "join" a private room based on their User ID
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    console.log(`User joined room: ${userId}`);
  });

  // Handle incoming messages
  socket.on("sendMessage", async (data) => {
    try {
      // data must now include: { userId, text, sender, time }
      const savedMessage = await Message.create(data);
      
      // 👉 NEW: Only emit the message to the specific user's room!
      io.to(data.userId).emit("receiveMessage", savedMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected");
  });
});