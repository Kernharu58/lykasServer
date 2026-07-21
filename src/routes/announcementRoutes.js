const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getAnnouncements,
  getActiveAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require("../controllers/announcementController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/active", protect, getActiveAnnouncements);
router.get("/", adminOnly, getAnnouncements);
router.post("/", adminOnly, createAnnouncement);
router.put("/:id", adminOnly, updateAnnouncement);
router.delete("/:id", adminOnly, deleteAnnouncement);

module.exports = router;
