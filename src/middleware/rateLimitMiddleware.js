const rateLimit = require("express-rate-limit");

// Rate limit for login attempts: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  // REMOVE THIS LINE: trustProxy: 1, 
  skip: (req, res) => {
    return !req.body.email || !req.body.password;
  },
});

// Rate limit for registration: 3 attempts per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per windowMs
  message: "Too many registration attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1, // Trust first proxy for IPv6 support
  skip: (req, res) => {
    // Don't count requests that don't have required fields
    return !req.body.email || !req.body.password || !req.body.displayName;
  },
});

// Rate limit for password reset requests: 3 attempts per hour per IP
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: "Too many password reset attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: 1, // Trust first proxy for IPv6 support
  skip: (req, res) => {
    return !req.body.email;
  },
});

module.exports = {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
};
