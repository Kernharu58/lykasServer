const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["general", "complaint", "review", "suggestion"],
      default: "general",
      index: true,
    },
    // Star rating, mainly used for "review" type (e.g. reviewing the adoption experience)
    rating: { type: Number, min: 1, max: 5, default: null },

    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    // Optional link to what the feedback concerns
    relatedPet: { type: mongoose.Schema.Types.ObjectId, ref: "Pet", default: null },

    status: {
      type: String,
      enum: ["new", "in_review", "responded", "resolved", "archived"],
      default: "new",
      index: true,
    },

    // Whether the adopter allows this review to be shown publicly (e.g. success stories)
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },

    adminResponse: { type: String, trim: true, default: "" },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
