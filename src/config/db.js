const mongoose = require("mongoose");

/**
 * Connect to MongoDB using the MONGO_URI environment variable.
 * Called from server.js on startup.
 */
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
  return conn;
};

module.exports = connectDB;
