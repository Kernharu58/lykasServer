const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  toggleFavorite,
  getFavorites,
  getMe,                  
  uploadProfilePicture
} = require("../controllers/authController");
// Middleware to protect routes and handle file uploads
const { protect } = require("../middleware/authMiddleware");
// Import the upload middleware from Cloudinary config
const { upload } = require("../config/cloudinary");
// @desc    Register a new user
router.post("/register", registerUser);
// @desc    Login user and get token
router.post("/favorites/:petId", protect, toggleFavorite);
// @desc    Login user and get token
router.post("/login", loginUser);
// @desc    Get current logged in user details (useful for fetching the profile pic on load)
router.get("/me", protect, getMe);
// @desc    Upload & Update Profile Picture
router.post("/profile-picture", protect, upload.single("image"), uploadProfilePicture);
// @desc    Get all pets in the user's favorites list
router.get("/favorites", protect, getFavorites);

// Google OAuth 2.0 Login Route
const { googleLogin } = require("../controllers/authController");
router.post("/google", googleLogin);

module.exports = router;
