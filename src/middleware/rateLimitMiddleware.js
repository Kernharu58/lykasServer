const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { getRedisClient } = require("../config/redis");

// Every named limiter shares this: if Redis is connected (checked once, at
// the moment this module is first required — see server.js, which requires
// this only *after* connectRedis() has resolved), back it with a
// RedisStore so limits survive restarts and are shared across however many
// server instances are actually running. If Redis isn't connected, `store`
// is left undefined and express-rate-limit falls back to its default
// in-memory MemoryStore — same behavior as before this change, just now the
// *intended* behavior for local dev rather than an accident in production.
const buildStore = (prefix) => {
  const client = getRedisClient();
  if (!client) return undefined;
  return new RedisStore({
    // rate-limit-redis's documented adapter for the node-redis v4+ client.
    sendCommand: (...args) => client.sendCommand(args),
    prefix,
  });
};

// Global limiter for all of /api/ — mounted first in server.js, ahead of
// every resource router. 500 requests / 15 min / IP.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("rl:global:"),
});

// Rate limit for login attempts: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("rl:login:"),
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
  store: buildStore("rl:register:"),
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
  store: buildStore("rl:pwreset:"),
  skip: (req, res) => {
    return !req.body.email;
  },
});

// Rate limit for token refresh: this fires roughly once per access-token
// lifetime (~every 20 min) for every *active* session, including multiple
// tabs/devices per user — so it needs to be far more generous than login,
// while still bounding brute-force/DoS attempts against the endpoint.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many token refresh attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore("rl:refresh:"),
});

module.exports = {
  globalLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  refreshLimiter,
};
