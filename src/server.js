const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

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

// --- Routes ---
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// Pet Routes
const petRoutes = require("./routes/petRoutes");
app.use("/api/pets", petRoutes);

// Volunteer Routes
const appointmentRoutes = require("./routes/appointmentRoutes");
app.use("/api/appointments", appointmentRoutes);

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

// Connect to the database, THEN start listening for requests
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
