const mongoose = require("mongoose");

const shelterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    contactPerson: { type: String, trim: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },
    contactEmail: { type: String, trim: true, default: "" },

    capacity: { type: Number, required: true, min: 0, default: 0 },
    // Denormalized count for quick dashboard reads; recalculated from Pet.shelter on writes
    currentOccupancy: { type: Number, default: 0, min: 0 },

    type: {
      type: String,
      enum: ["main_shelter", "foster_hub", "clinic", "satellite"],
      default: "main_shelter",
    },
    status: {
      type: String,
      enum: ["active", "at_capacity", "under_maintenance", "inactive"],
      default: "active",
      index: true,
    },

    operatingHours: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    manager: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

shelterSchema.virtual("occupancyRate").get(function () {
  if (!this.capacity) return 0;
  return Math.round((this.currentOccupancy / this.capacity) * 100);
});
shelterSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Shelter", shelterSchema);
