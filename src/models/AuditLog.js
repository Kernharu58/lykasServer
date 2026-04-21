// C:\Users\Kernharu\Desktop\capstone_mid\lykas\services\src\models\AuditLog.js
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g., 'ROLE_CHANGE', 'IMPERSONATE', 'SUSPEND'
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed }, // Extra details
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);