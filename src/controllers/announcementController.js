const Announcement = require("../models/Announcement");

// GET /api/announcements (admin — full list)
const getAnnouncements = async (_req, res) => {
  try {
    const announcements = await Announcement.find({}).sort({ createdAt: -1 }).populate("createdBy", "displayName email");
    res.status(200).json({ announcements });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/announcements/active — for the currently authenticated audience (or "all" if public)
const getActiveAnnouncements = async (req, res) => {
  try {
    const now = new Date();
    const isStaff = req.user && ["admin", "staff", "super_admin"].includes(req.user.role);
    const audience = isStaff ? ["all", "admin"] : ["all", "user"];

    const announcements = await Announcement.find({
      isActive: true,
      audience: { $in: audience },
      startAt: { $lte: now },
      $or: [{ endAt: null }, { endAt: { $gte: now } }],
    }).sort({ level: -1, startAt: -1 });

    res.status(200).json({ announcements });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/announcements  { title, message, level, audience, startAt, endAt }
const createAnnouncement = async (req, res) => {
  try {
    const { title, message, level, audience, startAt, endAt } = req.body;
    if (!title || !message) return res.status(400).json({ message: "title and message are required" });

    const announcement = await Announcement.create({
      title, message, level, audience, startAt, endAt, createdBy: req.user._id,
    });
    res.status(201).json({ message: "Announcement created", announcement });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// PUT /api/announcements/:id
const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });

    const fields = ["title", "message", "level", "audience", "startAt", "endAt", "isActive"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) announcement[f] = req.body[f];
    });
    await announcement.save();
    res.status(200).json({ message: "Announcement updated", announcement });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// DELETE /api/announcements/:id
const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    await announcement.deleteOne();
    res.status(200).json({ message: "Announcement deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getAnnouncements, getActiveAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };
