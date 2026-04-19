const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: String,
      enum: ["user", "admin" ,"shelter"], // Added "shelter" as a new sender type`
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    // Optional: Add an image field if you plan to support image messages later
    image: {
      type: String,
      default: "",
    },
  },
  { timestamps: true } // This automatically adds createdAt and updatedAt
);
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 });

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;