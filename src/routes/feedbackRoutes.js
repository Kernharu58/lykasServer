const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  submitFeedback, getMyFeedback, getPublicFeedback,
  getAllFeedback, getFeedbackById, updateFeedback, deleteFeedback,
} = require("../controllers/feedbackController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/public", getPublicFeedback);
router.get("/my", protect, getMyFeedback);
router.post("/", protect, submitFeedback);

router.get("/", adminOnly, getAllFeedback);
router.get("/:id", adminOnly, getFeedbackById);
router.put("/:id", adminOnly, updateFeedback);
router.delete("/:id", [protect, restrictTo("admin", "super_admin")], deleteFeedback);

module.exports = router;
