const mongoose = require("mongoose");

// One row per login/device, identified by its refresh token rather than the
// (now short-lived, ~20min) access token. Previously this row stored the raw
// access JWT itself in `token`, which meant "one row per issued JWT" and
// revocation only worked by blacklisting that exact JWT string. Access
// tokens now rotate every ~20 minutes via /api/auth/refresh, so keying a
// session on the access token would mean a new row every 20 minutes for a
// single logged-in device — instead, `refreshTokenHash` identifies the
// session, and each refresh call rotates it *in place* (see authController's
// refreshAccessToken), so a device that stays logged in for a week is still
// exactly one row here, and revoking it stops future refreshes immediately —
// see authMiddleware.js's protect(), which checks the access token's
// embedded sessionId against this row's `revoked` flag on every request.
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    refreshTokenExpiresAt: { type: Date, required: true },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    lastActiveAt: { type: Date, default: Date.now },
    // Kept as a general "this row is stale" marker, distinct from
    // refreshTokenExpiresAt — mirrors the field name already used
    // elsewhere in the schema for consistency with the rest of the app.
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

sessionSchema.index({ user: 1, revoked: 1 });
// TTL: once a session's refresh token has been expired for 7 days, the row
// itself is no longer useful for anything (not shown in "active sessions",
// can't be refreshed) — auto-prune it so revoked/expired sessions don't
// accumulate in the collection forever.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model("Session", sessionSchema);
