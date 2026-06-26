const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  startFoster, endFoster, cancelFoster, getAllFosters, getFosterById, getMyFosters,
  updateFoster, canFinalizeAdoption,
  submitFosterReport, getMissingWeeklyReports, getFosterReports,
  reviewFosterReport, getPendingReviews,
} = require("../controllers/fosterController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// Report sub-routes — must be before /:id to avoid collision
router.get("/reports/pending-review",            adminOnly, getPendingReviews);
router.put("/reports/:reportId/review",          adminOnly, reviewFosterReport);

// My fosters (user)
router.get("/my",                                protect,   getMyFosters);

// Placement CRUD
router.post("/",                                 adminOnly, startFoster);
router.get("/",                                  adminOnly, getAllFosters);
router.get("/:id",                               protect,   getFosterById);
router.put("/:id",                               adminOnly, updateFoster);
router.put("/:id/end",                           adminOnly, endFoster);
router.put("/:id/cancel",                        adminOnly, cancelFoster);

// ── NEW: Adoption eligibility gate (pseudocode §1: canFinalizeAdoption) ───────
router.get("/:id/can-finalize",                  adminOnly, canFinalizeAdoption);

// Reports per placement
router.post("/:fosterId/reports",                protect,   submitFosterReport);
router.get("/:fosterId/reports",                 protect,   getFosterReports);
// ── NEW: Missing report checker (pseudocode §2: getMissingWeeklyReports) ──────
router.get("/:fosterId/reports/missing",         protect,   getMissingWeeklyReports);

module.exports = router;
