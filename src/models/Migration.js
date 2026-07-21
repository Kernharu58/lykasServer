const mongoose = require("mongoose");

// Manual ledger of schema/data migrations applied to this deployment.
// There's no automated migration runner in this project, so entries are
// logged by whoever ran the change (admin UI or a one-off script).
const migrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["applied", "failed", "rolled_back"], default: "applied" },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Migration", migrationSchema);
