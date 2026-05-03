const rateLimit = require("express-rate-limit");

// Rate limit for login attempts: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many login attempts, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req, res) => {
    // Use IP address as key
    return req.ip || req.connection.remoteAddress;
  },
  skip: (req, res) => {
    // Don't count requests that don't have email/password
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
  keyGenerator: (req, res) => {
    return req.ip || req.connection.remoteAddress;
  },
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
  keyGenerator: (req, res) => {
    return req.ip || req.connection.remoteAddress;
  },
  skip: (req, res) => {
    return !req.body.email;
  },
});

module.exports = {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
};
