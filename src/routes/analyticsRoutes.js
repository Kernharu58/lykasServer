const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getOverview, getTrends, getPetsBreakdown } = require("../controllers/analyticsController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/overview", adminOnly, getOverview);
router.get("/trends", adminOnly, getTrends);
router.get("/pets-breakdown", adminOnly, getPetsBreakdown);

module.exports = router;
