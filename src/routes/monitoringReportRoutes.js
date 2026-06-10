const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  submitReport, getMyReports, getReportById, getAllReports,
  reviewReport, getFlaggedReports, getReportsByPet,
} = require("../controllers/monitoringReportController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// Must be before /:id
router.get("/my",              protect,   getMyReports);
router.get("/flagged",         adminOnly, getFlaggedReports);
router.get("/pet/:petId",      adminOnly, getReportsByPet);

router.post("/",               protect,   submitReport);
router.get("/",                adminOnly, getAllReports);
router.get("/:id",             protect,   getReportById);
router.put("/:id/review",      adminOnly, reviewReport);

module.exports = router;
