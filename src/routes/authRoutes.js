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
  googleLogin
} = require("../controllers/authController");

// Middleware to protect routes and handle file uploads
const { protect } = require("../middleware/authMiddleware");
const { upload } = require("../config/cloudinary");

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

module.exports = router;