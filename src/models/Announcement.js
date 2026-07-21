const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    level: { type: String, enum: ["info", "warning", "critical"], default: "info" },
    audience: { type: String, enum: ["all", "admin", "user"], default: "all" },
    startAt: { type: Date, default: Date.now },
    endAt: { type: Date, default: null }, // null = no expiry
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Announcement", announcementSchema);
