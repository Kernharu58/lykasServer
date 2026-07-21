const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { reportError, getErrors, resolveError } = require("../controllers/errorLogController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// Any authenticated client (admin panel or mobile app) can report a crash.
router.post("/report", protect, reportError);
router.get("/", adminOnly, getErrors);
router.put("/:id/resolve", adminOnly, resolveError);

module.exports = router;
