const mongoose = require("mongoose");

const errorLogSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ["server", "admin", "mobile"], default: "server", index: true },
    message: { type: String, required: true },
    stack: { type: String, default: null },
    route: { type: String, default: null },
    method: { type: String, default: null },
    statusCode: { type: Number, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    severity: { type: String, enum: ["info", "warning", "error", "fatal"], default: "error" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

errorLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ErrorLog", errorLogSchema);
