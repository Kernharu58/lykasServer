const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  adoptionReport, financialReport, volunteerReport, welfareReport,
} = require("../controllers/reportsController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/adoptions",  adminOnly, adoptionReport);
router.get("/financial",  adminOnly, financialReport);
router.get("/volunteers", adminOnly, volunteerReport);
router.get("/welfare",    adminOnly, welfareReport);

module.exports = router;
