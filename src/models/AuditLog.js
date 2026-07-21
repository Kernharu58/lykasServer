// C:\Users\Kernharu\Desktop\capstone_mid\lykas\services\src\models\AuditLog.js
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g., 'ROLE_CHANGE', 'IMPERSONATE', 'SUSPEND'
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed }, // Extra details
    // ── Per-record audit history (added for generic entity tracking) ────────
    // entityType/entityId let any record (Pet, Application, Volunteer, ...)
    // show its own "created by / edited by / deleted by" history instead of
    // only the global user-centric log above.
    entityType: {
      type: String,
      enum: ["Pet", "User", "Application", "Volunteer", "InKindDonation", "Shelter", null],
      default: null,
      index: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    previousValues: { type: mongoose.Schema.Types.Mixed, default: null },
    newValues: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);