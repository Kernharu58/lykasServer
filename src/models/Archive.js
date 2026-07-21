const mongoose = require("mongoose");

// Generic "cold storage" collection: a snapshot of a document that was
// removed from its live collection, kept so it can be browsed or restored
// instead of being permanently deleted.
const archiveSchema = new mongoose.Schema(
  {
    sourceCollection: { type: String, required: true, index: true }, // e.g. "Application"
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, default: "manual" }, // "manual" | "auto_age" | ...
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    restoredAt: { type: Date, default: null },
    restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Archive", archiveSchema);
