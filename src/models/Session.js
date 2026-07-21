const mongoose = require("mongoose");

// One row per issued JWT, so a user (or admin) can see "where am I logged
// in" and revoke a specific device without changing their password.
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

sessionSchema.index({ user: 1, revoked: 1 });

module.exports = mongoose.model("Session", sessionSchema);
