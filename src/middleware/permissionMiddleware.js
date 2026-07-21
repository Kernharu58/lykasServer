const Role = require("../models/Role");

// Granular RBAC on top of the existing `protect` / `restrictTo(role...)`
// middleware. Use it on routes that need finer control than "any staff
// member", e.g.:
//
//   router.delete("/:id", protect, requirePermission("delete_users"), ctrl.remove);
//
// super_admin always passes. Everyone else is checked against the
// permissions array on their Role document (seeded by roleController).
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized" });
      }
      if (req.user.role === "super_admin") return next();

      const role = await Role.findOne({ key: req.user.role });
      const permissions = role?.permissions || [];
      if (permissions.includes("*") || permissions.includes(permission)) {
        return next();
      }
      return res.status(403).json({
        message: `You do not have the '${permission}' permission required for this action.`,
      });
    } catch (error) {
      return res.status(500).json({ message: "Permission check failed", error: error.message });
    }
  };
};

module.exports = { requirePermission };
