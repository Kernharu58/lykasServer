const mongoose = require("mongoose");

const volunteerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One volunteer profile per user
    },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    motivation: { type: String, trim: true }, // Why do you want to volunteer?
    availability: {
      type: [String],
      enum: ["Weekday mornings", "Weekday afternoons", "Weekends", "Flexible"],
      default: [],
    },
    skills: { type: [String], default: [] }, // e.g. ["Dog handling", "Photography"]
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relationship: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "inactive"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    totalHours: { type: Number, default: 0 },
    notes: { type: String, default: "" }, // Admin notes
  },
  { timestamps: true }
);

volunteerSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("Volunteer", volunteerSchema);