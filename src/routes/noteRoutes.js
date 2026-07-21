const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getNotes, addNote, deleteNote } = require("../controllers/noteController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// GET  /api/notes/:entityType/:entityId  → list internal notes for a record
// POST /api/notes/:entityType/:entityId  → add a note
router.get("/:entityType/:entityId", adminOnly, getNotes);
router.post("/:entityType/:entityId", adminOnly, addNote);
router.delete("/:id", adminOnly, deleteNote);

module.exports = router;
