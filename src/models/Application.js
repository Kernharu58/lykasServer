const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    experience: {
      type: String,
      required: true,
      trim: true,
    },
    householdSize: {
      type: Number,
      default: null,
    },
    isRenting: {
      type: Boolean,
      default: false,
    },
    landlordApproval: {
      type: Boolean,
      default: false,
    },
    // 'adoption' (default) or 'foster'
    type: {
      type: String,
      enum: ["adoption", "foster"],
      default: "adoption",
      index: true,
    },
    // Only relevant for foster applications
    fosterPeriod: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    // ── Full approval workflow stage ──────────────────────────────────────
    // `status` above remains the simple pending/approved/rejected outcome
    // used everywhere else in the app. `stage` tracks *where in the pipeline*
    // a pending application currently sits, so the admin UI can show a real
    // progress tracker instead of just "Pending".
    stage: {
      type: String,
      enum: [
        "submitted",
        "document_review",
        "interview",
        "home_visit",
        "risk_assessment",
        "approved",
        "adoption_scheduled",
        "completed",
        "rejected",
      ],
      default: "submitted",
      index: true,
    },
    stageHistory: [
      {
        stage: { type: String },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, trim: true, default: "" },
      },
    ],
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    // Internal coordinator notes — hidden from applicant
    internalNotes: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

applicationSchema.index({ pet: 1, applicant: 1, status: 1 });

module.exports = mongoose.model("Application", applicationSchema);
