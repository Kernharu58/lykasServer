const mongoose = require("mongoose");

const petSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    species: { type: String, enum: ["Dog", "Cat", "Other"], required: true },
    breed: { type: String, required: true },
    age: { type: String, required: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    size: { type: String, enum: ["Small", "Medium", "Large"] },
    weight: { type: String },
    temperament: {
      type: String,
      enum: ["Calm", "Playful", "Shy", "Energetic", "Affectionate", "Independent"],
    },
    energyLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
    },
    healthStatus: { type: String, default: "See description for medical notes" },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ["Available", "Pending", "Adopted", "Foster"],
      default: "Available",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // ── Soft delete ─────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Pet", petSchema);
