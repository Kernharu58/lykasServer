// C:\Users\Kernharu\Desktop\capstone_mid\lykas\services\src\middleware\authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const TokenBlacklist = require("../models/TokenBlacklist");

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Check if token is blacklisted
      const blacklistedToken = await TokenBlacklist.findOne({ token });
      if (blacklistedToken) {
        return res.status(401).json({ message: "Token has been revoked" });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      
      if (!req.user) return res.status(401).json({ message: "User not found" });

      // Check account status
      if (req.user.status === 'suspended') {
        return res.status(403).json({ message: "Account is suspended." });
      }
      if (req.user.status === 'locked') {
        if (req.user.lockedUntil && new Date() < req.user.lockedUntil) {
           return res.status(403).json({ message: `Account locked until ${req.user.lockedUntil}` });
        } else if (req.user.lockedUntil && new Date() >= req.user.lockedUntil) {
           // Auto-unlock
           req.user.status = 'active';
           req.user.lockedUntil = null;
           await req.user.save();
        } else {
           return res.status(403).json({ message: "Account is locked permanently." });
        }
      }

      next();
    } catch (error) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token provided" });
  }
};

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "You do not have permission to perform this action." });
        }
        next();
    };
};

// Alias for routes that import adminAuth explicitly
const adminAuth = restrictTo("admin", "staff", "super_admin");

module.exports = { protect, restrictTo, adminAuth };