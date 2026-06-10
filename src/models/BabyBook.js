const mongoose = require("mongoose");

const babyBookEntrySchema = new mongoose.Schema(
  {
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
      index: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date:    { type: Date, required: true, default: Date.now },
    title:   { type: String, required: true, trim: true },   // e.g. "First bath!"
    content: { type: String, trim: true },                   // description / story
    category: {
      type: String,
      enum: ["Milestone", "Health", "Funny Moment", "Training", "First Time", "General"],
      default: "General",
    },
    photos: [{ type: String }],  // Cloudinary URLs
    tags:   [{ type: String, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BabyBookEntry", babyBookEntrySchema);
