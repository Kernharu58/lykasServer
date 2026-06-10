const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  startFoster, endFoster, cancelFoster, getAllFosters, getFosterById, getMyFosters,
  updateFoster, submitFosterReport, getFosterReports, reviewFosterReport, getPendingReviews,
} = require("../controllers/fosterController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/reports/pending-review",   adminOnly, getPendingReviews);
router.put("/reports/:reportId/review", adminOnly, reviewFosterReport);
router.get("/my",                       protect,   getMyFosters);
router.post("/",                        adminOnly, startFoster);
router.get("/",                         adminOnly, getAllFosters);
router.get("/:id",                      protect,   getFosterById);
router.put("/:id",                      adminOnly, updateFoster);
router.put("/:id/end",                  adminOnly, endFoster);
router.put("/:id/cancel",               adminOnly, cancelFoster);
router.post("/:fosterId/reports",       protect,   submitFosterReport);
router.get("/:fosterId/reports",        protect,   getFosterReports);

module.exports = router;
