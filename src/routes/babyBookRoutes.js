const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  addEntry, getEntriesByPet, getEntryById, updateEntry, deleteEntry, getMyEntries,
} = require("../controllers/babyBookController");

// GET /api/baby-book/my              → entries I added
// GET /api/baby-book/entry/:id       → single entry
// GET /api/baby-book/:petId          → all entries for a pet (timeline)
// POST /api/baby-book                → add entry
// PUT /api/baby-book/entry/:id       → update entry (owner or admin)
// DELETE /api/baby-book/entry/:id    → delete entry (owner or admin)

router.get("/my",           protect, getMyEntries);
router.get("/entry/:id",    protect, getEntryById);
router.post("/",            protect, addEntry);
router.put("/entry/:id",    protect, updateEntry);
router.delete("/entry/:id", protect, deleteEntry);
router.get("/:petId",       protect, getEntriesByPet);

module.exports = router;
