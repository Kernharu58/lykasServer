const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  registerVolunteer,
  getMyVolunteerProfile,
  updateMyVolunteerProfile,
  getAllVolunteers,
  getVolunteerById,
  updateVolunteerStatus,
  logVolunteerHours,
} = require("../controllers/volunteerController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// ─── User routes ─────────────────────────────────────────────────────────────
router.post("/register", protect, registerVolunteer);
router.get("/me", protect, getMyVolunteerProfile);
router.put("/me", protect, updateMyVolunteerProfile);

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.get("/", adminOnly, getAllVolunteers);
router.get("/:id", adminOnly, getVolunteerById);
router.put("/:id/status", adminOnly, updateVolunteerStatus);
router.post("/:id/hours", adminOnly, logVolunteerHours);

module.exports = router;