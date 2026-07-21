const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getSystemHealth } = require("../controllers/systemHealthController");

router.get("/health", protect, restrictTo("admin", "staff", "super_admin"), getSystemHealth);

module.exports = router;
