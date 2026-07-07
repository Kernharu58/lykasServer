const mongoose = require("mongoose");

const contentItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["faq", "policy", "page", "announcement"],
      required: true,
      index: true,
    },
    // For FAQs: the question. For policies/pages: the page title.
    title: { type: String, required: true, trim: true },
    // For FAQs: the answer. For policies/pages: the body (markdown/plain text).
    body: { type: String, required: true },

    category: { type: String, trim: true, default: "General" },
    // Used for FAQ ordering and page ordering within a category
    order: { type: Number, default: 0 },

    // Only published items are served to the mobile/user app
    isPublished: { type: Boolean, default: true, index: true },

    // Slug for policy/page lookups from the user app, e.g. "privacy-policy"
    slug: { type: String, trim: true, lowercase: true, default: null, index: true, sparse: true },

    version: { type: Number, default: 1 },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

contentItemSchema.index({ type: 1, isPublished: 1, order: 1 });

module.exports = mongoose.model("ContentItem", contentItemSchema);
