const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { archiveOldRecords, getArchive, restoreFromArchive } = require("../controllers/archiveController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/", adminOnly, getArchive);
router.post("/:collection", adminOnly, archiveOldRecords);
router.post("/:id/restore", adminOnly, restoreFromArchive);

module.exports = router;
