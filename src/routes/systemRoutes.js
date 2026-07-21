const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getSystemHealth, getVersion } = require("../controllers/systemHealthController");

router.get("/health", protect, restrictTo("admin", "staff", "super_admin"), getSystemHealth);
router.get("/version", protect, restrictTo("admin", "staff", "super_admin"), getVersion);

module.exports = router;
