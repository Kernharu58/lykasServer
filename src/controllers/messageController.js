const Message = require("../models/Message");
const User = require("../models/User");

// Real-time send/receive still happens over Socket.io (see server.js's
// `sendMessage` / `receiveMessage` handlers) — these two REST endpoints are
// the read-only fallback: initial history load for a returning user, and
// the admin conversation list. They used to live inline in server.js;
// extracted here so they're testable and consistent with every other
// resource's route/controller split.

// @desc    Full message history for one conversation, oldest-first
// @route   GET /api/messages/:userId
// @access  Protected — the conversation's own owner, or staff/admin/super_admin
const getConversationHistory = async (req, res) => {
  try {
    const isStaff = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwnConversation = req.user._id.toString() === req.params.userId;

    if (!isStaff && !isOwnConversation) {
      return res.status(403).json({
        message: "You do not have permission to view these messages.",
      });
    }

    const messages = await Message.find({ userId: req.params.userId }).sort({
      createdAt: 1,
    });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Every user, ordered by most-recent-message-first (active
//          conversations), then everyone else with no messages yet — powers
//          the admin chat console's conversation list.
// @route   GET /api/chat-sessions
// @access  staff / admin / super_admin only
const getChatSessions = async (_req, res) => {
  try {
    const allUsers = await User.find({}).select("-password");
    const latestMessages = await Message.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$userId", latestMessageAt: { $first: "$createdAt" } } },
      { $sort: { latestMessageAt: -1 } },
    ]);

    const activeUserIds = latestMessages.map((msg) => msg._id.toString());
    const activeUsers = activeUserIds
      .map((id) => allUsers.find((user) => user._id.toString() === id))
      .filter(Boolean);
    const inactiveUsers = allUsers.filter(
      (user) => !activeUserIds.includes(user._id.toString()),
    );

    res.status(200).json([...activeUsers, ...inactiveUsers]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getConversationHistory, getChatSessions };
