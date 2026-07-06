const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  logoutUser,
  toggleFavorite,
  getFavorites,
  getMe,                  
  uploadProfilePicture,
  updateProfile,
  googleLogin,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  impersonateUser,
  getAuditLogs,
  deleteUser,
  adminResetAnyPassword, // 👉 Added from your snippet
  getVerificationQueue,
  updateIdentityVerification,
} = require("../controllers/authController");

// Middleware to protect routes and handle file uploads
// 👉 Added adminAuth to the destructuring list
const { protect, restrictTo, adminAuth } = require("../middleware/authMiddleware"); 
const { upload } = require("../config/cloudinary");
const { loginLimiter, registerLimiter, passwordResetLimiter } = require("../middleware/rateLimitMiddleware");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];
const superAdminOnly = [protect, restrictTo("super_admin")];

// @desc    Register a new user
router.post("/register", registerLimiter, registerUser);

// @desc    Login user and get token
router.post("/login", loginLimiter, loginUser);

// @desc    Verify email with token (no protection needed)
router.post("/verify-email", verifyEmail);

// @desc    Request password reset email (no protection needed)
router.post("/forgot-password", passwordResetLimiter, forgotPassword);

// @desc    Reset password with token (no protection needed)
router.post("/reset-password", resetPassword);

// @desc    Logout user and blacklist token
router.post("/logout", protect, logoutUser);

// @desc    Get current logged in user details
router.get("/me", protect, getMe);

// 👉 NEW: Update user profile details
router.put("/profile", protect, updateProfile);

// @desc    Upload & Update Profile Picture
router.post("/profile-picture", protect, upload.single("image"), uploadProfilePicture);

// @desc    Toggle a pet in favorites
router.post("/favorites/:petId", protect, toggleFavorite);

// @desc    Get all pets in the user's favorites list
router.get("/favorites", protect, getFavorites);

// @desc    Google OAuth 2.0 Login Route
router.post("/google", googleLogin);

// 👉 NEW: Admin User Management Routes
router.get("/users", adminOnly, getAllUsers);
// Specific paths declared before "/users/:id/..." so they aren't swallowed by the :id param
router.get("/users/verification-queue", adminOnly, getVerificationQueue);
router.put("/users/:id/role", adminOnly, updateUserRole);
router.put("/users/:id/status", adminOnly, updateUserStatus);
router.put("/users/:id/verification", adminOnly, updateIdentityVerification);
router.post("/users/:id/impersonate", superAdminOnly, impersonateUser);
router.delete("/users/:id", adminOnly, deleteUser);
router.get("/audit-logs", superAdminOnly, getAuditLogs);

// 👉 NEW: Force password reset
// The ':id' can be a mobile user ID OR a staff member ID
router.post("/admin/force-reset/:id", protect, restrictTo("admin", "super_admin"), adminResetAnyPassword);
module.exports = router;