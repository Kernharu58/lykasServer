const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getSummary } = require("../controllers/apiMonitoringController");

router.get("/summary", protect, restrictTo("admin", "staff", "super_admin"), getSummary);

module.exports = router;
