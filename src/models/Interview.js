const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    scheduledDate: { type: Date, required: true },
    method: {
      type: String,
      enum: ["In-person", "Video call", "Phone call"],
      required: true,
    },
    location: { type: String, trim: true },      // address or meeting link
    conductedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "no-show"],
      default: "scheduled",
      index: true,
    },
    // Result filled in after the interview
    result: {
      type: String,
      enum: ["passed", "failed", "pending"],
      default: "pending",
    },
    notes:       { type: String, trim: true },    // interviewer notes
    cancelReason:{ type: String, trim: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Interview", interviewSchema);
