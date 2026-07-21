const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true }, // sha256 of the raw key — raw key is only ever shown once
    prefix: { type: String, required: true }, // first 8 chars, shown in the UI so admins can tell keys apart
    scopes: { type: [String], default: ["read"] }, // e.g. ["read","write"]
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ApiKey", apiKeySchema);
