const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getMyApplications,
  getApplicationById,
  cancelApplication,
  getAllApplications,
  updateApplicationStatus,
} = require("../controllers/applicationController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// ─── User routes ─────────────────────────────────────────────────────────────
// GET  /api/applications/my          → logged-in user's own applications
router.get("/my", protect, getMyApplications);

// ─── Admin routes ─────────────────────────────────────────────────────────────
// GET  /api/applications             → all applications (admin)
router.get("/", adminOnly, getAllApplications);

// ─── Shared routes (auth check + ownership enforced in controller) ─────────────
// GET    /api/applications/:id          → view one application
// DELETE /api/applications/:id          → user cancels their own pending app
router.get("/:id", protect, getApplicationById);
router.delete("/:id", protect, cancelApplication);

// PUT  /api/applications/:id/status   → admin approve/reject
router.put("/:id/status", adminOnly, updateApplicationStatus);

module.exports = router;