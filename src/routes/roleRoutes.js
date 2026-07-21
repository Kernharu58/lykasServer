const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getRoles, createRole, updateRole, deleteRole } = require("../controllers/roleController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];
const superAdminOnly = [protect, restrictTo("super_admin")];

router.get("/", adminOnly, getRoles);
router.post("/", superAdminOnly, createRole);
router.put("/:id", superAdminOnly, updateRole);
router.delete("/:id", superAdminOnly, deleteRole);

module.exports = router;
