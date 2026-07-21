const mongoose = require("mongoose");

const donationItemSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unit:     { type: String, required: true, trim: true },
  },
  { _id: false }
);

const inKindDonationSchema = new mongoose.Schema(
  {
    donatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [donationItemSchema],
      validate: {
        validator: (arr) => arr && arr.length > 0,
        message: "At least one item is required",
      },
    },
    dropOff: {
      type: String,
      enum: ["walk_in", "schedule", "courier"],
      default: "walk_in",
    },
    notes:     { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "received", "cancelled"],
      default: "pending",
      index: true,
    },
    staffNote:  { type: String, trim: true, default: "" },
    receivedAt: { type: Date, default: null },
    // ── Soft delete ─────────────────────────────────────────────────────────
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InKindDonation", inKindDonationSchema);