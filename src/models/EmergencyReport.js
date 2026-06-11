const mongoose = require("mongoose");

const emergencyReportSchema = new mongoose.Schema(
  {
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["stray_animal", "injured_animal", "abuse_report", "abandoned_animal", "other"],
      required: true,
    },
    animalType:   { type: String, trim: true },        // "Dog", "Cat", etc.
    description:  { type: String, required: true, trim: true },
    location:     { type: String, required: true, trim: true },
    // GeoJSON-style coords for map display (optional)
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    photos:       [{ type: String }],                  // Cloudinary URLs
    contactName:  { type: String, trim: true },
    contactPhone: { type: String, trim: true },

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },

    // Admin handling
    assignedTo:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt:   { type: Date, default: null },
    resolutionNote: { type: String, trim: true },

    // If this report led to a pet being added to the system
    linkedPet:    { type: mongoose.Schema.Types.ObjectId, ref: "Pet", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EmergencyReport", emergencyReportSchema);
