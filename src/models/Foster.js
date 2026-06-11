const mongoose = require("mongoose");

// ── Active Foster Placement ────────────────────────────────────────────────────
const fosterSchema = new mongoose.Schema(
  {
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
      index: true,
    },
    fosterer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null,           // optional link to an adoption application
    },
    startDate:  { type: Date, required: true },
    endDate:    { type: Date, default: null }, // null = still active
    expectedEndDate: { type: Date, default: null },

    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
      index: true,
    },

    // Agreement / intake details
    fosterAgreementSigned: { type: Boolean, default: false },
    pickupNotes:  { type: String, trim: true },
    returnNotes:  { type: String, trim: true },

    // Set by admin on creation
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// ── Weekly Foster Report ───────────────────────────────────────────────────────
const fosterReportSchema = new mongoose.Schema(
  {
    foster: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Foster",
      required: true,
      index: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    fosterer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    weekNumber:   { type: Number, required: true },   // week 1, 2, 3…
    reportDate:   { type: Date, required: true, default: Date.now },

    // Pet welfare during the week
    weightChange: { type: String, trim: true },        // e.g. "gained 0.2kg"
    appetite:     { type: String, enum: ["Excellent", "Good", "Fair", "Poor"], required: true },
    energy:       { type: String, enum: ["Very Active", "Active", "Low", "Lethargic"], required: true },
    behavior:     { type: String, trim: true },        // free-text behavioral notes
    healthConcerns: { type: String, trim: true },      // any medical issues noticed
    vetVisitRequired: { type: Boolean, default: false },

    // Photos/media submitted by fosterer
    photos: [{ type: String }],                       // Cloudinary URLs

    overallProgress: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Needs Attention"],
      required: true,
    },
    notes: { type: String, trim: true },

    // Admin review
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    adminNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = {
  Foster:       mongoose.model("Foster",       fosterSchema),
  FosterReport: mongoose.model("FosterReport", fosterReportSchema),
};
