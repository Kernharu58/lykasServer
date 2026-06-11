const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  startFoster, endFoster, cancelFoster, getAllFosters, getFosterById, getMyFosters,
  updateFoster, submitFosterReport, getFosterReports, reviewFosterReport, getPendingReviews,
} = require("../controllers/fosterController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// Report sub-routes — must be before /:fosterId to avoid collision
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

// Reports per placement
router.post("/:fosterId/reports",                protect,   submitFosterReport);
router.get("/:fosterId/reports",                 protect,   getFosterReports);

module.exports = router;
