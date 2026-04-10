const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true 
    },
    text: { type: String, required: true },
    sender: { type: String, enum: ['user', 'shelter'], required: true }, 
    time: { type: String, required: true },
  },
  { timestamps: true } // This automatically creates the `createdAt` timestamp
);

// 👉 ADD THIS LINE: 
// Creates a TTL (Time-To-Live) index on the `createdAt` field.
// 1296000 seconds = exactly 15 days (15 * 24 * 60 * 60)
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 });

module.exports = mongoose.model("Message", messageSchema);