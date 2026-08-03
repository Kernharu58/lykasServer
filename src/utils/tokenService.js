const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Session = require("../models/Session");

// Short-lived access token (default 20 minutes) + a longer-lived, rotatable,
// revocable refresh token — replacing the single 7-day JWT the app used to
// issue with no way to invalidate it short of the blacklist. A stolen access
// token now has at most a 20-minute blast radius instead of up to a week.
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "20m";
const REFRESH_TOKEN_EXPIRES_IN_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 30);

const generateRefreshToken = () => crypto.randomBytes(40).toString("hex");

// Refresh tokens are high-entropy random bytes already (not a user-chosen
// secret), so a fast hash is the right tool here — unlike a password, there's
// nothing for bcrypt's deliberate slowness to protect against, and every
// refresh call needs a lookup by this hash.
const hashRefreshToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const signAccessToken = (userId, sessionId) =>
  jwt.sign({ id: userId, sessionId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

// Called at signup / login / Google login — creates a brand new Session row
// (one per device/login) and returns the token pair for it.
const issueTokenPair = async (user, req) => {
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  );

  const session = await Session.create({
    user: user._id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshTokenExpiresAt,
    expiresAt: refreshTokenExpiresAt,
    ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    userAgent: req.headers["user-agent"] || null,
    lastActiveAt: new Date(),
  });

  const accessToken = signAccessToken(user._id, session._id);
  return { accessToken, refreshToken, sessionId: session._id };
};

// Called at POST /api/auth/refresh — rotates the SAME session row in place
// (new refresh token value, same _id) rather than creating a new row every
// ~20 minutes, so one logged-in device stays exactly one Session document
// for its whole lifetime instead of fragmenting into hundreds of rows.
const rotateTokenPair = async (session, user) => {
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  );

  session.refreshTokenHash = hashRefreshToken(refreshToken);
  session.refreshTokenExpiresAt = refreshTokenExpiresAt;
  session.expiresAt = refreshTokenExpiresAt;
  session.lastActiveAt = new Date();
  await session.save();

  const accessToken = signAccessToken(user._id, session._id);
  return { accessToken, refreshToken };
};

module.exports = {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN_DAYS,
  hashRefreshToken,
  issueTokenPair,
  rotateTokenPair,
};
