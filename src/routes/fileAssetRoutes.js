const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { getFiles, getStorageStats, uploadFile, deleteFile } = require("../controllers/fileAssetController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/", adminOnly, getFiles);
router.get("/storage-stats", adminOnly, getStorageStats);
router.post("/", adminOnly, upload.single("file"), uploadFile);
router.delete("/:id", adminOnly, deleteFile);

module.exports = router;
