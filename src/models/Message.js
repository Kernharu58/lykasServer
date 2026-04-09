const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  
  {
    // 👉 NEW: We must track which user this chat belongs to
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true 
    },
    text: { type: String, required: true },
    // Sender can now be 'user' or 'shelter'
    sender: { type: String, enum: ['user', 'shelter'], required: true }, 
    time: { type: String, required: true },
    
  },
  { timestamps: true }
);

messageSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);