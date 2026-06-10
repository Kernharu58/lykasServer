const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  createRiskAssessment, updateRiskAssessment, getAllRiskAssessments,
  getByApplication, getRiskAssessmentById,
} = require("../controllers/riskAssessmentController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/application/:applicationId", protect,   getByApplication);
router.post("/",   adminOnly, createRiskAssessment);
router.get("/",    adminOnly, getAllRiskAssessments);
router.get("/:id", protect,   getRiskAssessmentById);
router.put("/:id", adminOnly, updateRiskAssessment);

module.exports = router;
