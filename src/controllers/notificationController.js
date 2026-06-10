const Notification = require("../models/Notification");

// ─── USER: Get my notifications ───────────────────────────────────────────────
// GET /api/notifications?unreadOnly=true&page=1&limit=20
const getMyNotifications = async (req, res) => {
  try {
    const { unreadOnly, page = 1, limit = 20 } = req.query;
    const filter = { recipient: req.user._id };
    if (unreadOnly === "true") filter.isRead = false;

    const skip = (Number(page) - 1) * Number(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate("sender", "displayName profilePicture")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.status(200).json({
      notifications,
      unreadCount,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Mark one notification as read ──────────────────────────────────────
// PUT /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notification not found" });

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({ message: "Marked as read", notification });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Mark ALL my notifications as read ─────────────────────────────────
// PUT /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Delete a notification ─────────────────────────────────────────────
// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: "Notification not found" });

    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await notification.deleteOne();
    res.status(200).json({ message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Delete all my notifications ───────────────────────────────────────
// DELETE /api/notifications
const deleteAllMyNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.status(200).json({ message: "All notifications cleared" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get unread count only (for badge) ─────────────────────────────────
// GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.status(200).json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Send a notification to a user or broadcast ───────────────────────
// POST /api/notifications/send
// { recipientId: "userId" | "all", type: "GENERAL", title, message, refModel, refId }
const sendNotification = async (req, res) => {
  try {
    const { recipientId, type, title, message, refModel, refId } = req.body;
    const User = require("../models/User");

    if (recipientId === "all") {
      // Broadcast to all active users
      const users = await User.find({ status: "active" }, "_id");
      const docs = users.map(u => ({
        recipient: u._id,
        sender:    req.user._id,
        type:      type || "GENERAL",
        title, message,
        refModel:  refModel || null,
        refId:     refId    || null,
      }));
      await Notification.insertMany(docs, { ordered: false });
      return res.status(201).json({ message: `Broadcast sent to ${docs.length} users` });
    }

    await Notification.create({
      recipient: recipientId,
      sender:    req.user._id,
      type:      type || "GENERAL",
      title, message,
      refModel:  refModel || null,
      refId:     refId    || null,
    });

    res.status(201).json({ message: "Notification sent" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all notifications (any user) ─────────────────────────────────
// GET /api/notifications/admin?recipientId=&type=&page=1&limit=50
const getAllNotifications = async (req, res) => {
  try {
    const { recipientId, type, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (recipientId) filter.recipient = recipientId;
    if (type)        filter.type      = type;

    const skip = (Number(page) - 1) * Number(limit);
    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate("recipient", "displayName email")
        .populate("sender",    "displayName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Notification.countDocuments(filter),
    ]);

    res.status(200).json({
      notifications,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllMyNotifications,
  getUnreadCount,
  sendNotification,
  getAllNotifications,
};
