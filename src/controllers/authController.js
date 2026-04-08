const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// @desc    Register a new user
// @route   POST /api/auth/register
// @desc    Register a new user
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { displayName, email, password } = req.body;

    // 👉 ADD THIS: Backend Password Security Check
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and contain uppercase, lowercase, numbers, and symbols.",
      });
    }

    // 1. Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create the user in the database
    const user = await User.create({
      displayName,
      email,
      password: hashedPassword,
    });

    // 4. Generate a JWT Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// @desc    Authenticate a user & get token
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Check if the password matches the hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3. Generate a JWT Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Toggle a pet in favorites (add if not there, remove if it is)
// @route   POST /api/auth/favorites/:petId
// @access  Private
const toggleFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const petId = req.params.petId;

    if (user.favorites.includes(petId)) {
      // Remove if already exists
      user.favorites = user.favorites.filter((id) => id.toString() !== petId);
      await user.save();
      return res
        .status(200)
        .json({ message: "Removed from favorites", favorites: user.favorites });
    } else {
      // Add if it doesn't exist
      user.favorites.push(petId);
      await user.save();
      return res
        .status(200)
        .json({ message: "Added to favorites", favorites: user.favorites });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all pets in the user's favorites list
// @route   GET /api/auth/favorites
// @access  Private
const getFavorites = async (req, res) => {
  try {
    // .populate('favorites') grabs the full Pet data instead of just IDs
    const user = await User.findById(req.user._id).populate("favorites");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user.favorites);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update your module.exports at the bottom


// @desc    Get current logged in user details (useful for fetching the profile pic on load)
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Upload & Update Profile Picture
// @route   POST /api/auth/profile-picture
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const user = await User.findById(req.user._id);
    user.profilePicture = req.file.path; 
    await user.save();

    res.status(200).json({ 
      message: "Profile picture updated successfully", 
      profilePicture: user.profilePicture 
    });
  } catch (error) {
    // 👉 ADD THIS LINE to force the terminal to print the exact Cloudinary error:
    console.error("🔴 CLOUDINARY UPLOAD ERROR:", error); 
    
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Login or Register via Google
// @route   POST /api/auth/google
const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    // 1. Verify the token with Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    // 2. Extract the user's Google profile info
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // 3. Check if this user already exists in your MongoDB
    let user = await User.findOne({ email });

    // 4. If they don't exist, create a new account for them instantly!
    if (!user) {
      user = await User.create({
        displayName: name,
        email: email,
        // Give them a random, impossible password since they login with Google
        password: Math.random().toString(36).slice(-8) + Date.now(), 
        profilePicture: picture, // Use their Google photo!
      });
    }

    // 5. Generate your app's standard JWT Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Google login successful",
      token,
      user: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(401).json({ message: "Invalid Google Token" });
  }
};


// 👉 Make sure to export them!
module.exports = { registerUser, loginUser, toggleFavorite, getFavorites, getMe, uploadProfilePicture, googleLogin };