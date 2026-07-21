const Role = require("../models/Role");
const { PERMISSIONS } = require("../models/Role");

const DEFAULT_ROLES = [
  { key: "super_admin", label: "Super Admin", isSystem: true, permissions: ["*"], description: "Full, unrestricted access to every module." },
  { key: "admin", label: "Admin", isSystem: true, permissions: PERMISSIONS.filter((p) => p !== "manage_roles"), description: "Full operational access, excluding role management." },
  { key: "staff", label: "Staff", isSystem: true, permissions: ["manage_pets", "manage_applications", "manage_interviews", "manage_home_visits", "manage_risk_assessments", "view_reports", "manage_donations", "manage_inventory", "manage_volunteers", "manage_notifications"], description: "Day-to-day shelter operations." },
  { key: "veterinarian", label: "Veterinarian", isSystem: false, permissions: ["manage_pets", "manage_risk_assessments", "view_reports"], description: "Medical/health-focused staff role." },
  { key: "volunteer_coordinator", label: "Volunteer Coordinator", isSystem: false, permissions: ["manage_volunteers", "manage_notifications", "view_reports"], description: "Manages volunteer scheduling and communication." },
  { key: "user", label: "User (Adopter)", isSystem: true, permissions: [], description: "Public/mobile-app account with no admin permissions." },
];

// Ensures the built-in roles exist so the permissions UI always has
// something to show, even on a fresh database.
const ensureDefaultRoles = async () => {
  for (const role of DEFAULT_ROLES) {
    await Role.updateOne(
      { key: role.key },
      { $setOnInsert: role },
      { upsert: true },
    );
  }
};

// GET /api/roles
const getRoles = async (_req, res) => {
  try {
    await ensureDefaultRoles();
    const roles = await Role.find({}).sort({ key: 1 });
    res.status(200).json({ roles, availablePermissions: PERMISSIONS });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/roles  { key, label, description, permissions }
const createRole = async (req, res) => {
  try {
    const { key, label, description, permissions } = req.body;
    if (!key || !label) {
      return res.status(400).json({ message: "key and label are required" });
    }
    const invalid = (permissions || []).filter((p) => p !== "*" && !PERMISSIONS.includes(p));
    if (invalid.length) {
      return res.status(400).json({ message: `Unknown permissions: ${invalid.join(", ")}` });
    }
    const role = await Role.create({
      key: key.toLowerCase().trim(),
      label,
      description,
      permissions: permissions || [],
    });
    res.status(201).json({ message: "Role created", role });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "A role with that key already exists" });
    }
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// PUT /api/roles/:id  { label, description, permissions }
const updateRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });

    const { label, description, permissions } = req.body;
    if (permissions) {
      const invalid = permissions.filter((p) => p !== "*" && !PERMISSIONS.includes(p));
      if (invalid.length) {
        return res.status(400).json({ message: `Unknown permissions: ${invalid.join(", ")}` });
      }
      role.permissions = permissions;
    }
    if (label !== undefined) role.label = label;
    if (description !== undefined) role.description = description;
    await role.save();
    res.status(200).json({ message: "Role updated", role });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// DELETE /api/roles/:id  (system roles can't be deleted — they back User.role)
const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });
    if (role.isSystem) {
      return res.status(400).json({ message: "System roles cannot be deleted" });
    }
    await role.deleteOne();
    res.status(200).json({ message: "Role deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getRoles, createRole, updateRole, deleteRole, ensureDefaultRoles };
