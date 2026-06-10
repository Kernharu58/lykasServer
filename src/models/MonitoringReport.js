const mongoose = require("mongoose");

const monitoringReportSchema = new mongoose.Schema(
  {
    // Who submitted and what adoption it relates to
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
      index: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null,
    },

    reportDate:  { type: Date, required: true, default: Date.now },
    reportMonth: { type: Number, required: true }, // 1–12 (which month post-adoption)

    // Pet welfare fields
    petName:        { type: String, trim: true },
    currentWeight:  { type: String, trim: true },
    diet:           { type: String, trim: true },
    exerciseRoutine:{ type: String, trim: true },
    vetVisits:      { type: String, trim: true },

    overallCondition: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Poor"],
      required: true,
    },
    behaviorAtHome: { type: String, trim: true },
    issuesOrConcerns: { type: String, trim: true },
    additionalPets:   { type: String, trim: true },

    // Photos submitted by adopter
    photos: [{ type: String }], // Cloudinary URLs

    // Adopter satisfaction
    satisfactionRating: { type: Number, min: 1, max: 5, default: null },
    comments:           { type: String, trim: true },

    status: {
      type: String,
      enum: ["pending", "reviewed", "flagged"],
      default: "pending",
      index: true,
    },

    // Admin review
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    adminNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MonitoringReport", monitoringReportSchema);
