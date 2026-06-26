const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getSettings, updateSettings } = require("../controllers/settingsController");

// Shelter contact info is fine to expose publicly (read-only)
router.get("/", getSettings);

// 🔒 SECURITY FIX: this was previously unauthenticated — anyone could
// overwrite the shelter's public contact info. Now admin/staff only.
router.put("/", protect, restrictTo("admin", "staff", "super_admin"), updateSettings);

module.exports = router;