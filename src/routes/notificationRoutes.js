const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getMyNotifications, markAsRead, markAllAsRead,
  deleteNotification, deleteAllMyNotifications,
  getUnreadCount, sendNotification, getAllNotifications,
} = require("../controllers/notificationController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// User routes — specific paths BEFORE /:id
router.get("/unread-count",   protect,   getUnreadCount);
router.get("/my",             protect,   getMyNotifications);       // alias
router.put("/read-all",       protect,   markAllAsRead);
router.delete("/",            protect,   deleteAllMyNotifications);

// Admin routes
router.get("/admin",          adminOnly, getAllNotifications);
router.post("/send",          adminOnly, sendNotification);

// Parameterised routes last
router.get("/",               protect,   getMyNotifications);
router.put("/:id/read",       protect,   markAsRead);
router.delete("/:id",         protect,   deleteNotification);

module.exports = router;
