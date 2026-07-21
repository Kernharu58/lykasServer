const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getMyApplications,
  getApplicationById,
  cancelApplication,
  getAllApplications,
  updateApplicationStatus,
  addInternalNote,
  getInternalNotes,
  getVettingStatus,
  exportApplications,
  bulkUpdateStatus,
  getApplicationHistory,
  advanceStage,
} = require("../controllers/applicationController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// ─── User routes ─────────────────────────────────────────────────────────────
// GET  /api/applications/my          → logged-in user's own applications
router.get("/my", protect, getMyApplications);

// ─── Admin routes ─────────────────────────────────────────────────────────────
// GET  /api/applications             → all applications (search/sort/filter/pagination)
router.get("/", adminOnly, getAllApplications);

// GET  /api/applications/export?format=csv|excel|pdf
router.get("/export", adminOnly, exportApplications);

// POST /api/applications/bulk-status  { ids: [...], status: "approved"|"rejected" }
router.post("/bulk-status", adminOnly, bulkUpdateStatus);

// ─── Shared routes (auth check + ownership enforced in controller) ─────────────
// GET    /api/applications/:id          → view one application
// DELETE /api/applications/:id          → user cancels their own pending app
router.get("/:id", protect, getApplicationById);
router.delete("/:id", protect, cancelApplication);

// PUT  /api/applications/:id/status   → admin approve/reject
router.put("/:id/status", adminOnly, updateApplicationStatus);

// PUT  /api/applications/:id/stage    → admin moves the workflow stage forward
router.put("/:id/stage", adminOnly, advanceStage);

// GET  /api/applications/:id/history  → per-record audit trail
router.get("/:id/history", adminOnly, getApplicationHistory);

// ─── Internal (staff-only) coordinator notes ──────────────────────────────────
// GET  /api/applications/:id/notes   → list notes (hidden from applicant)
// POST /api/applications/:id/notes   → add a note
router.get("/:id/notes", adminOnly, getInternalNotes);
router.post("/:id/notes", adminOnly, addInternalNote);

// GET /api/applications/:id/vetting-status → interview/home-visit gate status
router.get("/:id/vetting-status", adminOnly, getVettingStatus);

module.exports = router;