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
