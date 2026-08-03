const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Session = require("../models/Session");
const TokenBlacklist = require("../models/TokenBlacklist");

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Check if token is blacklisted
    const blacklistedToken = await TokenBlacklist.findOne({ token });
    if (blacklistedToken) {
      return res.status(401).json({ message: "Token has been revoked" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Access tokens issued by tokenService.js embed the Session they belong
    // to — checking it here is what makes "revoke this session" (or "revoke
    // all other sessions") take effect immediately, rather than only once
    // the access token naturally expires on its own (~20 min). Tokens
    // without a sessionId (e.g. the separate short-lived impersonation
    // token minted by impersonateUser) skip this check by design.
    if (decoded.sessionId) {
      const session = await Session.findById(decoded.sessionId).select("revoked");
      if (!session || session.revoked) {
        return res.status(401).json({
          message: "This session has been revoked. Please log in again.",
          code: "SESSION_REVOKED",
        });
      }
    }

    req.user = await User.findById(decoded.id).select("-password");
    req.sessionId = decoded.sessionId || null;

    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (req.user.isDeleted) {
      return res.status(403).json({ message: "This account has been deleted." });
    }

    // Check account status
    if (req.user.status === "suspended") {
      return res.status(403).json({ message: "Account is suspended." });
    }

    if (req.user.status === "locked") {
      if (req.user.lockedUntil && new Date() < req.user.lockedUntil) {
        return res.status(403).json({
          message: `Account locked until ${req.user.lockedUntil}`,
        });
      } else if (req.user.lockedUntil && new Date() >= req.user.lockedUntil) {
        // Auto-unlock expired lock
        req.user.status = "active";
        req.user.lockedUntil = null;
        await req.user.save();
      } else {
        return res.status(403).json({ message: "Account is locked permanently." });
      }
    }

    next();
  } catch (error) {
    // Access tokens now expire quickly (~20 min by default) as a deliberate
    // trade-off for a smaller stolen-token blast radius — which means
    // clients need to hit this path far more often than the old 7-day
    // tokens ever did. Tell them explicitly when it's "call POST
    // /api/auth/refresh" (expected, frequent, not an error worth logging
    // loudly) versus "the token itself is bad" (re-auth from scratch).
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Access token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Not authorized, token failed", code: "TOKEN_INVALID" });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
};

// Alias for routes that import adminAuth explicitly
const adminAuth = restrictTo("admin", "staff", "super_admin");

module.exports = { protect, restrictTo, adminAuth };
