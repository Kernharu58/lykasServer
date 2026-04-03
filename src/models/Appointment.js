const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // e.g., "Morning Dog Walking"
    date: { type: Date, required: true },
    durationHours: { type: Number, required: true },
    capacity: { type: Number, required: true }, // Max number of volunteers allowed
    enrolledUsers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        phone: { type: String },
        emergencyContact: { type: String },
        notes: { type: String },
        appliedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ["Open", "Full", "Completed"],
      default: "Open",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Appointment", appointmentSchema);
