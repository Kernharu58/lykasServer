const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { createBackup, getBackups, downloadBackup, restoreBackup, deleteBackup } = require("../controllers/backupController");

// Backups touch the entire database — super_admin only.
const superAdminOnly = [protect, restrictTo("super_admin")];

router.get("/", superAdminOnly, getBackups);
router.post("/", superAdminOnly, createBackup);
router.get("/:id/download", superAdminOnly, downloadBackup);
router.post("/:id/restore", superAdminOnly, restoreBackup);
router.delete("/:id", superAdminOnly, deleteBackup);

module.exports = router;
