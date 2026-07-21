const mongoose = require("mongoose");

const apiLogSchema = new mongoose.Schema(
  {
    method: { type: String, required: true },
    path: { type: String, required: true, index: true },
    statusCode: { type: Number, required: true, index: true },
    durationMs: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ipAddress: { type: String, default: null },
    // Auto-expire raw request logs after 14 days so this collection doesn't
    // grow unbounded — aggregated stats should be read before they roll off.
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 14 },
  },
  { timestamps: false },
);

apiLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ApiLog", apiLogSchema);
