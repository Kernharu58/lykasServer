const BabyBookEntry = require("../models/BabyBook");
const Pet           = require("../models/Pet");
const AuditLog      = require("../models/AuditLog");

const logAction = async ({ actor, action, metadata }) => {
  try { await AuditLog.create({ actor, action, metadata }); } catch (e) { /* silent */ }
};

// ─── Add a baby book entry ────────────────────────────────────────────────────
// POST /api/baby-book
// { petId, date, title, content, category, photos, tags }
// Both admin/staff (for shelter pets) and adopters/fosterers (for their pet) can add
const addEntry = async (req, res) => {
  try {
    const { petId, date, title, content, category, photos, tags } = req.body;

    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    const entry = await BabyBookEntry.create({
      pet:      petId,
      addedBy:  req.user._id,
      date:     date || new Date(),
      title,
      content,
      category: category || "General",
      photos:   photos || [],
      tags:     tags   || [],
    });

    await logAction({
      actor: req.user._id, action: "BABY_BOOK_ENTRY_ADDED",
      metadata: { entryId: entry._id, petId, petName: pet.name, title },
    });

    res.status(201).json({ message: "Baby book entry added", entry });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Get all entries for a pet (timeline) ────────────────────────────────────
// GET /api/baby-book/:petId?category=Milestone&page=1&limit=20
const getEntriesByPet = async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const filter = { pet: req.params.petId };
    if (category && ["Milestone","Health","Funny Moment","Training","First Time","General"].includes(category)) {
      filter.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      BabyBookEntry.find(filter)
        .populate("addedBy", "displayName email profilePicture")
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit)),
      BabyBookEntry.countDocuments(filter),
    ]);

    res.status(200).json({
      entries,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Get single entry ─────────────────────────────────────────────────────────
// GET /api/baby-book/entry/:id
const getEntryById = async (req, res) => {
  try {
    const entry = await BabyBookEntry.findById(req.params.id)
      .populate("pet",     "name species breed imageUrl")
      .populate("addedBy", "displayName email profilePicture");

    if (!entry) return res.status(404).json({ message: "Entry not found" });
    res.status(200).json(entry);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Update an entry ──────────────────────────────────────────────────────────
// PUT /api/baby-book/entry/:id
// Only the creator or admin can update
const updateEntry = async (req, res) => {
  try {
    const entry = await BabyBookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = entry.addedBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to edit this entry" });
    }

    const { title, content, category, photos, tags, date } = req.body;
    if (title    !== undefined) entry.title    = title;
    if (content  !== undefined) entry.content  = content;
    if (category !== undefined) entry.category = category;
    if (photos   !== undefined) entry.photos   = photos;
    if (tags     !== undefined) entry.tags     = tags;
    if (date     !== undefined) entry.date     = date;

    await entry.save();
    res.status(200).json({ message: "Entry updated", entry });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Delete an entry ──────────────────────────────────────────────────────────
// DELETE /api/baby-book/entry/:id
const deleteEntry = async (req, res) => {
  try {
    const entry = await BabyBookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });

    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = entry.addedBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to delete this entry" });
    }

    await entry.deleteOne();
    res.status(200).json({ message: "Entry deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Get entries added by me ──────────────────────────────────────────────────
// GET /api/baby-book/my
const getMyEntries = async (req, res) => {
  try {
    const entries = await BabyBookEntry.find({ addedBy: req.user._id })
      .populate("pet", "name species breed imageUrl")
      .sort({ date: -1 });
    res.status(200).json(entries);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { addEntry, getEntriesByPet, getEntryById, updateEntry, deleteEntry, getMyEntries };
