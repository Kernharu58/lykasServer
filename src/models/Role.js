const mongoose = require("mongoose");

// Master list of granular permissions the admin panel can gate on.
// Kept as a plain export (not an enum on the schema) so new permissions
// can be added without a migration — unknown keys are simply ignored by
// requirePermission().
const PERMISSIONS = [
  "manage_pets",
  "approve_adoptions",
  "manage_applications",
  "manage_interviews",
  "manage_home_visits",
  "manage_risk_assessments",
  "view_reports",
  "manage_payments",
  "manage_donations",
  "manage_inventory",
  "manage_shelters",
  "manage_staff",
  "manage_volunteers",
  "manage_users",
  "delete_users",
  "manage_settings",
  "manage_content",
  "manage_notifications",
  "view_audit_logs",
  "manage_backups",
  "manage_feature_flags",
  "manage_announcements",
  "manage_roles",
  "manage_email_templates",
  "manage_files",
  "manage_api_keys",
  "view_api_monitoring",
  "manage_archive",
];

const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    permissions: { type: [String], default: [] },
    // System roles (user/staff/admin/super_admin) can be edited but not
    // deleted or renamed — they back the base `User.role` enum.
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Role", roleSchema);
module.exports.PERMISSIONS = PERMISSIONS;
