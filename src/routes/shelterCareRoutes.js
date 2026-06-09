const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  addHealthCheck, getHealthChecks, getFlaggedHealthChecks,
  addFeedingLog, getFeedingLogs,
  addBehavioralObs, getBehavioralObs,
  assignCage, getCageHistory, getAllActiveCages, releaseCage,
  startQuarantine, endQuarantine, getQuarantineHistory, getActiveQuarantines,
  getPetShelterSummary,
} = require("../controllers/shelterCareController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// Summary
router.get("/summary/:petId",           protect, getPetShelterSummary);

// Health Checks
router.post("/health-checks",           adminOnly, addHealthCheck);
router.get("/health-checks/flagged",    adminOnly, getFlaggedHealthChecks);  // before /:petId
router.get("/health-checks/:petId",     protect,   getHealthChecks);

// Feeding Logs
router.post("/feeding-logs",            adminOnly, addFeedingLog);
router.get("/feeding-logs/:petId",      protect,   getFeedingLogs);

// Behavioral Observations
router.post("/behavioral-obs",          adminOnly, addBehavioralObs);
router.get("/behavioral-obs/:petId",    protect,   getBehavioralObs);

// Cages
router.post("/cages",                   adminOnly, assignCage);
router.get("/cages",                    adminOnly, getAllActiveCages);
router.get("/cages/:petId",             protect,   getCageHistory);
router.delete("/cages/:assignmentId",   adminOnly, releaseCage);

// Quarantine
router.post("/quarantine",              adminOnly, startQuarantine);
router.get("/quarantine",               adminOnly, getActiveQuarantines);
router.get("/quarantine/:petId",        protect,   getQuarantineHistory);
router.put("/quarantine/:id/end",       adminOnly, endQuarantine);

module.exports = router;
