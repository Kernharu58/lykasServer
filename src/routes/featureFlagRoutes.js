const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getFlags, getPublicFlags, updateFlag, createFlag } = require("../controllers/featureFlagController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];
const superAdminOnly = [protect, restrictTo("super_admin")];

// Public (but still authenticated) — lets admin/mobile clients fetch which
// features are turned on at startup without needing elevated permissions.
router.get("/public", protect, getPublicFlags);
router.get("/", adminOnly, getFlags);
router.post("/", superAdminOnly, createFlag);
router.put("/:key", superAdminOnly, updateFlag);

module.exports = router;
