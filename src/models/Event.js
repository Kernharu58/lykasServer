const mongoose = require("mongoose");

// ── Event ─────────────────────────────────────────────────────────────────────
const eventSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: ["Adoption Drive", "Fundraiser", "Training", "Community", "Volunteer", "Other"],
      required: true,
    },
    date:      { type: Date, required: true },
    endDate:   { type: Date, default: null },
    location:  { type: String, trim: true },
    isOnline:  { type: Boolean, default: false },
    onlineLink:{ type: String, trim: true },

    maxAttendees: { type: Number, default: null }, // null = unlimited
    currentAttendees: { type: Number, default: 0 },

    imageUrl:  { type: String, default: "" },

    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// ── Event Registration (attendee) ─────────────────────────────────────────────
const eventRegistrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    registeredAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["registered", "attended", "cancelled"],
      default: "registered",
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Prevent duplicate registrations
eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });

// ── Volunteer Assignment to Event ─────────────────────────────────────────────
const eventAssignmentSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    volunteer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role:     { type: String, trim: true },  // e.g. "Registration desk", "Pet handler"
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["assigned", "confirmed", "completed", "cancelled"],
      default: "assigned",
    },
    hoursLogged: { type: Number, default: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

eventAssignmentSchema.index({ event: 1, volunteer: 1 }, { unique: true });

module.exports = {
  Event:               mongoose.model("Event",               eventSchema),
  EventRegistration:   mongoose.model("EventRegistration",   eventRegistrationSchema),
  EventAssignment:     mongoose.model("EventAssignment",     eventAssignmentSchema),
};
