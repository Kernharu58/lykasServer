const crypto = require("crypto");
const ApiKey = require("../models/ApiKey");

const hashKey = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

// Alternative to JWT `protect` for machine-to-machine access, e.g. an
// external integration pulling reports. Expects `X-Api-Key: <key>`.
const requireApiKey = (requiredScope) => {
  return async (req, res, next) => {
    try {
      const raw = req.headers["x-api-key"];
      if (!raw) return res.status(401).json({ message: "Missing X-Api-Key header" });

      const keyHash = hashKey(raw);
      const apiKey = await ApiKey.findOne({ keyHash, revoked: false });
      if (!apiKey) return res.status(401).json({ message: "Invalid or revoked API key" });
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return res.status(401).json({ message: "API key has expired" });
      }
      if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
        return res.status(403).json({ message: `API key lacks required scope: ${requiredScope}` });
      }

      apiKey.lastUsedAt = new Date();
      await apiKey.save();
      req.apiKey = apiKey;
      next();
    } catch (error) {
      res.status(500).json({ message: "API key validation failed", error: error.message });
    }
  };
};

module.exports = { requireApiKey, hashKey };
