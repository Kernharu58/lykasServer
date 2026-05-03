const mongoose = require("mongoose");

const tokenBlacklistSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatically delete expired documents
    },
    reason: {
      type: String,
      enum: ["logout", "account_suspended", "account_locked", "password_changed"],
      default: "logout",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TokenBlacklist", tokenBlacklistSchema);
