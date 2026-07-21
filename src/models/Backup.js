const mongoose = require("mongoose");

const backupSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["manual", "automatic"], default: "manual" },
    status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
    filePath: { type: String, default: null }, // local path under /backups
    fileName: { type: String, default: null },
    sizeBytes: { type: Number, default: 0 },
    collections: { type: [String], default: [] },
    documentCount: { type: Number, default: 0 },
    error: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    restoredAt: { type: Date, default: null },
    restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Backup", backupSchema);
