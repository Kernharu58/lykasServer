const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getDashboard } = require("../controllers/dashboardController");

router.get("/", [protect, restrictTo("admin", "staff", "super_admin")], getDashboard);

module.exports = router;
