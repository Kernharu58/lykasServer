const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  toggleFavorite,
  getFavorites,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
// Route for user registration
router.post("/register", registerUser);
router.post("/favorites/:petId", protect, toggleFavorite);
// Route for user login
router.post("/login", loginUser);

router.get("/favorites", protect, getFavorites);

module.exports = router;
