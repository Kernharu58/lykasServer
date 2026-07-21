const Note = require("../models/Note");

const ALLOWED_TYPES = ["Pet", "User", "Volunteer", "InKindDonation", "Shelter"];

// GET /api/notes/:entityType/:entityId
const getNotes = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    if (!ALLOWED_TYPES.includes(entityType)) {
      return res.status(400).json({ message: `entityType must be one of: ${ALLOWED_TYPES.join(", ")}` });
    }
    const notes = await Note.find({ entityType, entityId })
      .populate("author", "displayName email")
      .sort({ createdAt: -1 });
    res.status(200).json({ notes });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/notes/:entityType/:entityId  { text: "..." }
const addNote = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { text } = req.body;
    if (!ALLOWED_TYPES.includes(entityType)) {
      return res.status(400).json({ message: `entityType must be one of: ${ALLOWED_TYPES.join(", ")}` });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Note text is required" });
    }

    const note = await Note.create({ entityType, entityId, author: req.user._id, text: text.trim() });
    await note.populate("author", "displayName email");

    res.status(201).json({ message: "Note added", note });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// DELETE /api/notes/:id  (only the author or a super_admin may remove a note)
const deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const isAuthor = note.author.toString() === req.user._id.toString();
    const isSuperAdmin = req.user.role === "super_admin";
    if (!isAuthor && !isSuperAdmin) {
      return res.status(403).json({ message: "Only the author or a super admin can delete this note" });
    }

    await note.deleteOne();
    res.status(200).json({ message: "Note deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getNotes, addNote, deleteNote };
