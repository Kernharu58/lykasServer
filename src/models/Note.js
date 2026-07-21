const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["Pet", "User", "Volunteer", "InKindDonation", "Shelter"],
      required: true,
      index: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
    // Internal notes are staff-only by default; kept explicit in case a future
    // "shared with applicant" note type is needed.
    visibility: { type: String, enum: ["internal"], default: "internal" },
  },
  { timestamps: true },
);

noteSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model("Note", noteSchema);
