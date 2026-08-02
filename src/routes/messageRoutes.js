const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getConversationHistory, getChatSessions } = require("../controllers/messageController");

// Mounted at /api/messages in server.js.
// GET /api/messages/:userId — ownership check happens inside the controller
// (owner or staff), same as the original inline handler.
router.get("/:userId", protect, getConversationHistory);

module.exports = router;

// GET /api/chat-sessions is a *separate* top-level path (not nested under
// /api/messages) — mounted directly in server.js as its own tiny router so
// the real API surface matches §5.3 exactly instead of inventing
// /api/messages/chat-sessions, which nothing else references.
module.exports.chatSessionsRouter = express.Router().get(
  "/",
  protect,
  restrictTo("admin", "staff", "super_admin"),
  getChatSessions,
);
