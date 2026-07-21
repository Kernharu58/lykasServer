const mongoose = require("mongoose");

const loginHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null when the email didn't match any account
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    success: { type: Boolean, required: true, index: true },
    // e.g. "invalid_credentials", "account_locked", "account_suspended", "ok"
    reason: { type: String, default: "ok" },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);

loginHistorySchema.index({ user: 1, createdAt: -1 });
loginHistorySchema.index({ email: 1, success: 1, createdAt: -1 });

module.exports = mongoose.model("LoginHistory", loginHistorySchema);
