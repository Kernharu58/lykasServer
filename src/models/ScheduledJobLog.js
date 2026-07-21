const mongoose = require("mongoose");

const scheduledJobLogSchema = new mongoose.Schema(
  {
    jobKey: { type: String, required: true, index: true }, // e.g. "adoption_reminders"
    label: { type: String, required: true },
    status: { type: String, enum: ["success", "failed"], default: "success" },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    durationMs: { type: Number, default: 0 },
    itemsProcessed: { type: Number, default: 0 },
    triggeredBy: { type: String, enum: ["cron", "manual"], default: "cron" },
    triggeredByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    message: { type: String, default: "" },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

scheduledJobLogSchema.index({ jobKey: 1, createdAt: -1 });

module.exports = mongoose.model("ScheduledJobLog", scheduledJobLogSchema);
