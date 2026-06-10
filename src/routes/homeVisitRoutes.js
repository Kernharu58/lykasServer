const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  scheduleHomeVisit, getAllHomeVisits, getHomeVisitById, getMyHomeVisits,
  updateHomeVisit, completeHomeVisit, cancelHomeVisit, markNoShow,
} = require("../controllers/homeVisitController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/my",              protect,   getMyHomeVisits);      // before /:id
router.post("/",               adminOnly, scheduleHomeVisit);
router.get("/",                adminOnly, getAllHomeVisits);
router.get("/:id",             protect,   getHomeVisitById);
router.put("/:id",             adminOnly, updateHomeVisit);
router.put("/:id/complete",    adminOnly, completeHomeVisit);
router.put("/:id/cancel",      adminOnly, cancelHomeVisit);
router.put("/:id/no-show",     adminOnly, markNoShow);

module.exports = router;
EOF

cat > $BASE/routes/riskAssessmentRoutes.js << 'EOF'
const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  createRiskAssessment, updateRiskAssessment, getAllRiskAssessments,
  getByApplication, getRiskAssessmentById,
} = require("../controllers/riskAssessmentController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// Must be before /:id to avoid route collision
router.get("/application/:applicationId", protect,   getByApplication);

router.post("/",    adminOnly, createRiskAssessment);
router.get("/",     adminOnly, getAllRiskAssessments);
router.get("/:id",  protect,   getRiskAssessmentById);
router.put("/:id",  adminOnly, updateRiskAssessment);

module.exports = router;
EOF

cat > $BASE/routes/fosterRoutes.js << 'EOF'
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