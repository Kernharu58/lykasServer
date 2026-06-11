const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  submitReport, getMyReports, getAllReports, getReportById, updateReport,
} = require("../controllers/emergencyReportController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/my",   protect,   getMyReports);
router.post("/",    protect,   submitReport);
router.get("/",     adminOnly, getAllReports);
router.get("/:id",  protect,   getReportById);
router.put("/:id",  adminOnly, updateReport);

module.exports = router;
