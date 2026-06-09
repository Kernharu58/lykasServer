const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  scheduleInterview, getAllInterviews, getInterviewById, getMyInterviews,
  updateInterview, completeInterview, cancelInterview, markNoShow,
} = require("../controllers/interviewController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// User
router.get("/my",                  protect,   getMyInterviews);

// Admin
router.post("/",                   adminOnly, scheduleInterview);
router.get("/",                    adminOnly, getAllInterviews);

// Shared (ownership enforced in controller)
router.get("/:id",                 protect,   getInterviewById);

// Admin actions
router.put("/:id",                 adminOnly, updateInterview);
router.put("/:id/complete",        adminOnly, completeInterview);
router.put("/:id/cancel",          adminOnly, cancelInterview);
router.put("/:id/no-show",         adminOnly, markNoShow);

module.exports = router;
