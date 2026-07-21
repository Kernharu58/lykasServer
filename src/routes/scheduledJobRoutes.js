const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getJobs, getJobHistory, triggerJob } = require("../controllers/scheduledJobController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/", adminOnly, getJobs);
router.get("/:jobKey/history", adminOnly, getJobHistory);
router.post("/:jobKey/run", adminOnly, triggerJob);

module.exports = router;
