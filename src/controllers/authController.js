const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const AuditLog = require("../models/AuditLog");
const TokenBlacklist = require("../models/TokenBlacklist");
const { sendVerificationEmail, sendPasswordResetEmail, sendEmail } = require("../utils/emailService");
const { OAuth2Client } = require("google-auth-library");

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const MOBILE_APP_URL = process.env.MOBILE_APP_URL || "lykas://";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const createAuditLog = async ({ actor, action, targetUser, metadata }) => {
  try {
    if (!actor) return;
    await AuditLog.create({ actor, action, targetUser, metadata });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
};

// @desc    Register a new user (Applied your signup logic)
// @route   POST /api/auth/signup
const signup = async (req, res) => {
  try {
    // Accept both 'name' and 'displayName' for flexibility
    const { name, displayName, email, password } = req.body;
    const userName = name || displayName;

    if (!userName || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Generate a random verification token
    let token = crypto.randomBytes(32).toString('hex'); 

    // 👉 APPLIED FIX: Hash the password using bcrypt before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create and save the new user
    const newUser = new User({
      displayName: userName,  // ✅ Use displayName field (required by schema)
      email,
      password: hashedPassword,
      emailVerificationToken: token,  // ✅ Correct field name from schema
      emailVerified: false  // ✅ Correct field name from schema
    });
    
    await newUser.save();

    // 4. Send the verification email (non-blocking)
    let emailSent = false;
    let emailSkipped = false;
    try {
      const emailResult = await sendVerificationEmail({
        email: newUser.email,
        displayName: newUser.displayName,  // ✅ Use displayName (not name)
        verificationToken: token,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000' 
      });
      
      if (emailResult.skipped) {
        emailSkipped = true;
        console.warn(`⚠️ Signup: Email service not configured, skipping verification email for ${newUser.email}`);
      } else if (emailResult.success) {
        emailSent = true;
        console.log(`✅ Verification email sent to ${newUser.email}`);
      } else {
        console.warn(`⚠️ Failed to send verification email to ${newUser.email}: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error(`❌ Email service error for ${newUser.email}:`, emailError.message);
      // Don't fail signup if email fails - user can request email resend later
    }

    // 5. Generate JWT Token for instant login
    token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    // 6. Success response with token for auto-login
    let message = 'Account created successfully!';
    if (emailSent) {
      message = 'Signup successful! Please check your email to verify your account.';
    } else if (emailSkipped) {
      message = 'Account created, but email verification is not yet configured. You can proceed to login.';
    } else {
      message = 'Account created! Please check your email to verify your account (check spam folder if needed).';
    }

    res.status(201).json({ 
      message,
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        displayName: newUser.displayName,
        emailVerified: newUser.emailVerified,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('❌ Signup error:', error.message);
    
    // Check if it's a database validation error
    if (error.name === 'ValidationError') {
      const details = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        message: 'Invalid input data',
        details
      });
    }
    
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ 
        message: `This ${field} is already registered`,
        field
      });
    }
    
    res.status(500).json({ 
      message: 'Server error during signup', 
      error: error.message 
    });
  }
};

// @desc    Authenticate a user & get token
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // 1. Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Check account status
    if (user.status === "suspended") {
      return res.status(403).json({ message: "Account is suspended. Please contact support." });
    }
    if (user.status === "locked") {
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        return res.status(403).json({ message: `Account locked until ${user.lockedUntil}` });
      } else if (user.lockedUntil && new Date() >= user.lockedUntil) {
        // Auto-unlock if lock period has expired
        user.status = "active";
        user.lockedUntil = null;
        await user.save();
      } else {
        return res.status(403).json({ message: "Account is locked permanently." });
      }
    }

    // 3. Check if the password matches the hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3b. Block login if email has not been verified yet (Shichi Auth §3)
    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in. Check your inbox for a verification link.",
      });
    }

    // 4. Generate a JWT Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Verify user email with verification token
// @route   POST /api/auth/verify-email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    // Note: Adjusted to look for both possible token fields based on the merge
    const user = await User.findOne({
      $or: [
        { emailVerificationToken: token, emailVerificationExpires: { $gt: Date.now() } },
        { verificationToken: token }
      ]
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification token" });
    }

    // Mark email as verified
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    await createAuditLog({
      actor: user._id,
      action: "EMAIL_VERIFIED",
      targetUser: user._id,
      metadata: { email: user.email },
    });

    res.status(200).json({
      message: "Email verified successfully",
      user: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Request password reset email
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // For security, don't reveal if email exists
      return res.status(200).json({
        message: "If an account exists with this email, a password reset link has been sent",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    // Send password reset email
    await sendPasswordResetEmail({
      email: user.email,
      displayName: user.displayName,
      resetToken,
      frontendUrl: FRONTEND_URL,
    });

    await createAuditLog({
      actor: null,
      action: "PASSWORD_RESET_REQUESTED",
      targetUser: user._id,
      metadata: { email: user.email },
    });

    res.status(200).json({
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Validate strong password
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and contain uppercase, lowercase, numbers, and symbols.",
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired password reset token" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Blacklist all existing tokens for this user
    await TokenBlacklist.deleteMany({ userId: user._id });

    await createAuditLog({
      actor: user._id,
      action: "PASSWORD_RESET",
      targetUser: user._id,
      metadata: { email: user.email },
    });

    res.status(200).json({
      message: "Password reset successfully. Please login with your new password.",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Logout user and blacklist token
// @route   POST /api/auth/logout
const logoutUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(400).json({ message: "No token provided" });
    }

    // Decode token to get expiration
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add token to blacklist
    await TokenBlacklist.create({
      token,
      userId: decoded.id,
      expiresAt: new Date(decoded.exp * 1000), // Convert unix timestamp to date
      reason: "logout",
    });

    await createAuditLog({
      actor: req.user?._id,
      action: "LOGOUT",
      targetUser: req.user?._id,
      metadata: {},
    });

    res.status(200).json({ message: "Logged out successfully" });
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

// @desc    Get current logged in user details
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
    console.error("🔴 CLOUDINARY UPLOAD ERROR:", error); 
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 👉 NEW: Update Profile details (Display Name)
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { displayName, notificationsEnabled } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.displayName = displayName || user.displayName;
    if (typeof notificationsEnabled === "boolean") {
      user.notificationsEnabled = notificationsEnabled;
    }
    const updatedUser = await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        displayName: updatedUser.displayName,
        email: updatedUser.email,
        profilePicture: updatedUser.profilePicture,
        notificationsEnabled: updatedUser.notificationsEnabled,
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 👉 NEW: Get all users for the Admin Dashboard
// @route   GET /api/auth/users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 👉 NEW: Update a user's role (Promote to Staff/Admin)
// @route   PUT /api/auth/users/:id/role
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const existingUser = await User.findById(req.params.id).select("-password");

    if (!existingUser) return res.status(404).json({ message: "User not found" });

    const previousRole = existingUser.role;
    existingUser.role = role;
    const user = await existingUser.save();

    await createAuditLog({
      actor: req.user?._id,
      action: "ROLE_CHANGE",
      targetUser: user._id,
      metadata: { previousRole, newRole: role },
    });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update a user's account status
// @route   PUT /api/auth/users/:id/status
const updateUserStatus = async (req, res) => {
  try {
    const { status, lockedUntil } = req.body;
    const allowedStatuses = ["active", "suspended", "locked"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid account status" });
    }

    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const previousStatus = user.status;
    user.status = status;
    user.lockedUntil = status === "locked" && lockedUntil ? new Date(lockedUntil) : null;

    await user.save();

    await createAuditLog({
      actor: req.user?._id,
      action: "STATUS_CHANGE",
      targetUser: user._id,
      metadata: { previousStatus, newStatus: status, lockedUntil: user.lockedUntil },
    });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Generate a short-lived token to impersonate a user
// @route   POST /api/auth/users/:id/impersonate
const impersonateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const token = jwt.sign(
      { id: user._id, impersonatedBy: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    await createAuditLog({
      actor: req.user?._id,
      action: "IMPERSONATE",
      targetUser: user._id,
      metadata: { targetEmail: user.email },
    });

    res.status(200).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Fetch audit logs for privileged review
// @route   GET /api/auth/audit-logs
const getAuditLogs = async (_req, res) => {
  try {
    const logs = await AuditLog.find({})
      .populate("actor", "displayName name email role")
      .populate("targetUser", "displayName name email role")
      .sort({ createdAt: -1 })
      .limit(250);

    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 👉 NEW: Delete a user account completely
// @route   DELETE /api/auth/users/:id
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await createAuditLog({
      actor: req.user?._id,
      action: "USER_DELETE",
      targetUser: user._id,
      metadata: { email: user.email, role: user.role, status: user.status },
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 👉 NEW: Master Password Reset function for Admins
// @route   POST /api/auth/users/:id/reset-password
const adminResetAnyPassword = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 1. Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    targetUser.resetPasswordToken = resetToken;
    targetUser.resetPasswordExpires = resetPasswordExpires;
    await targetUser.save({ validateBeforeSave: false });

    // 2. Determine the correct frontend URL based on user role
    let frontendUrl = FRONTEND_URL;
    if (targetUser.role === 'user') {
      frontendUrl = MOBILE_APP_URL;
    }

    // 3. Send the password reset email using the email service
    await sendPasswordResetEmail({
      email: targetUser.email,
      displayName: targetUser.displayName,
      resetToken: resetToken,
      frontendUrl: frontendUrl,
    });

    // 4. Log the admin action
    await createAuditLog({
      actor: req.user?._id,
      action: "ADMIN_PASSWORD_RESET",
      targetUser: targetUser._id,
      metadata: { email: targetUser.email, role: targetUser.role },
    });

    res.status(200).json({ 
      message: `Password reset email sent to ${targetUser.email}`,
      success: true 
    });

  } catch (error) {
    console.error("Admin Reset Error:", error);
    res.status(500).json({ message: 'Failed to process password reset.' });
  }
};

// @desc    Login or Register via Google
// @route   POST /api/auth/google
const googleLogin = async (req, res) => {
  console.log("\n========== 🚀 GOOGLE AUTH DEBUG START ==========");
  const { idToken } = req.body;
  
  if (!idToken) {
    return res.status(400).json({ message: "No ID token provided" });
  }

  try {
    // Verify token with all possible client IDs
    const clientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.ANDROID_CLIENT_ID,
      process.env.IOS_CLIENT_ID
    ].filter(Boolean);

    if (clientIds.length === 0) {
      console.error("❌ [CRITICAL] No Google Client IDs configured in environment variables");
      return res.status(500).json({ 
        message: "Google Auth is not properly configured on the server",
        details: "Missing GOOGLE_CLIENT_ID environment variables"
      });
    }

    console.log(`[Google Auth] Verifying token against ${clientIds.length} client IDs...`);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientIds
    });
    
    const payload = ticket.getPayload();
    console.log(`[Google Auth] ✅ Token verified for email: ${payload.email}`);

    // Check if user already exists
    let user = await User.findOne({ email: payload.email });
    
    if (!user) {
      console.log(`[Google Auth] 🆕 Creating new user: ${payload.email}`);
      
      // Create new user from Google profile
      user = await User.create({
        displayName: payload.name,
        email: payload.email,
        password: Math.random().toString(36).slice(-10) + "A1!", // Random password for OAuth users
        emailVerified: payload.email_verified || true, // Google emails are verified
        role: "user",
        profilePicture: payload.picture || "" // Store Google profile picture if available
      });
      
      console.log(`[Google Auth] ✅ New user created: ${user._id}`);
    } else {
      console.log(`[Google Auth] 👤 Existing user found: ${user._id}`);
      
      // Update profile picture if available and not already set
      if (payload.picture && !user.profilePicture) {
        user.profilePicture = payload.picture;
        await user.save();
      }
    }

    // Generate JWT token
    const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    console.log(`[Google Auth] ✅ JWT token generated, logging user in`);

    await createAuditLog({
      actor: user._id,
      action: "GOOGLE_LOGIN",
      targetUser: user._id,
      metadata: { email: user.email, googleId: payload.sub },
    });

    res.status(200).json({
      message: "Google login successful",
      token: jwtToken,
      user: {
        _id: user._id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        emailVerified: user.emailVerified
      },
    });

  } catch (error) {
    console.error("❌ [GOOGLE AUTH ERROR]:", error.message);
    console.error("Stack:", error.stack);
    
    // Handle specific verification errors
    if (error.message.includes("Token used too late")) {
      return res.status(400).json({ 
        message: "Google token has expired. Please try again.",
        error: error.message 
      });
    }
    
    if (error.message.includes("Wrong number of segments")) {
      return res.status(400).json({ 
        message: "Invalid Google token format.",
        error: error.message 
      });
    }

    res.status(500).json({ 
      message: "Google authentication failed", 
      error: error.message 
    });
  }
};

module.exports = { 
  registerUser: signup,
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
  adminResetAnyPassword,
  signup,
};