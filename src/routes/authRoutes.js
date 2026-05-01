const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  toggleFavorite,
  getFavorites,
  getMe,                  
  uploadProfilePicture,
  updateProfile, // 👉 ADDED
  googleLogin,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  impersonateUser,
  getAuditLogs,
  deleteUser
} = require("../controllers/authController");

// Middleware to protect routes and handle file uploads
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { upload } = require("../config/cloudinary");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];
const superAdminOnly = [protect, restrictTo("super_admin")];

// @desc    Register a new user
router.post("/register", registerUser);

// @desc    Toggle a pet in favorites
router.post("/favorites/:petId", protect, toggleFavorite);

// @desc    Login user and get token
router.post("/login", loginUser);

// @desc    Get current logged in user details
router.get("/me", protect, getMe);

// 👉 NEW: Update user profile details
router.put("/profile", protect, updateProfile);

// @desc    Upload & Update Profile Picture
router.post("/profile-picture", protect, upload.single("image"), uploadProfilePicture);

// @desc    Get all pets in the user's favorites list
router.get("/favorites", protect, getFavorites);

// @desc    Google OAuth 2.0 Login Route
router.post("/google", googleLogin);

// 👉 NEW: Admin User Management Routes
router.get("/users", adminOnly, getAllUsers);
router.put("/users/:id/role", adminOnly, updateUserRole);
router.put("/users/:id/status", adminOnly, updateUserStatus);
router.post("/users/:id/impersonate", superAdminOnly, impersonateUser);
router.delete("/users/:id", adminOnly, deleteUser);
router.get("/audit-logs", superAdminOnly, getAuditLogs);

module.exports = router;
