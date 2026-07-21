const crypto = require("crypto");
const ApiKey = require("../models/ApiKey");
const { hashKey } = require("../middleware/apiKeyAuth");

// GET /api/api-keys — masked list (never returns the raw key again)
const getApiKeys = async (_req, res) => {
  try {
    const keys = await ApiKey.find({}).select("-keyHash").sort({ createdAt: -1 }).populate("createdBy", "displayName email");
    res.status(200).json({ keys });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/api-keys  { name, scopes, expiresAt } — raw key is shown ONCE
const createApiKey = async (req, res) => {
  try {
    const { name, scopes, expiresAt } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });

    const raw = `lyk_${crypto.randomBytes(24).toString("hex")}`;
    const apiKey = await ApiKey.create({
      name,
      keyHash: hashKey(raw),
      prefix: raw.slice(0, 12),
      scopes: scopes?.length ? scopes : ["read"],
      expiresAt: expiresAt || null,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: "API key created — copy it now, it will not be shown again.",
      key: raw,
      record: { id: apiKey._id, name: apiKey.name, prefix: apiKey.prefix, scopes: apiKey.scopes },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// DELETE /api/api-keys/:id
const revokeApiKey = async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id);
    if (!apiKey) return res.status(404).json({ message: "API key not found" });
    apiKey.revoked = true;
    apiKey.revokedAt = new Date();
    await apiKey.save();
    res.status(200).json({ message: "API key revoked" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getApiKeys, createApiKey, revokeApiKey };
