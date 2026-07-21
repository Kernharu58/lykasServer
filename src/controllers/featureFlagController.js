const FeatureFlag = require("../models/FeatureFlag");

const DEFAULT_FLAGS = [
  { key: "maintenance_mode", label: "Maintenance Mode", description: "Blocks non-staff API access with a 503 while enabled.", enabled: false },
  { key: "chat", label: "Live Chat", description: "In-app chat between adopters and staff.", enabled: true },
  { key: "payments", label: "Payments", description: "Online adoption/donation payments.", enabled: true },
  { key: "foster_program", label: "Foster Program", description: "Foster application + tracking module.", enabled: true },
  { key: "baby_book", label: "Baby Book", description: "Growth/milestone tracking for young pets.", enabled: true },
  { key: "volunteer_portal", label: "Volunteer Portal", description: "Volunteer signup, shifts, and hour tracking.", enabled: true },
  { key: "emergency_reports", label: "Emergency Reports", description: "Public emergency/rescue reporting.", enabled: true },
];

const ensureDefaultFlags = async () => {
  for (const flag of DEFAULT_FLAGS) {
    await FeatureFlag.updateOne({ key: flag.key }, { $setOnInsert: flag }, { upsert: true });
  }
};

// GET /api/feature-flags (admin — full list)
const getFlags = async (_req, res) => {
  try {
    await ensureDefaultFlags();
    const flags = await FeatureFlag.find({}).sort({ key: 1 });
    res.status(200).json({ flags });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/feature-flags/public — key:enabled map for admin/mobile clients to consume at startup
const getPublicFlags = async (_req, res) => {
  try {
    await ensureDefaultFlags();
    const flags = await FeatureFlag.find({}).select("key enabled -_id");
    const map = flags.reduce((acc, f) => ({ ...acc, [f.key]: f.enabled }), {});
    res.status(200).json(map);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// PUT /api/feature-flags/:key  { enabled }
const updateFlag = async (req, res) => {
  try {
    const flag = await FeatureFlag.findOne({ key: req.params.key });
    if (!flag) return res.status(404).json({ message: "Feature flag not found" });
    flag.enabled = !!req.body.enabled;
    flag.updatedBy = req.user._id;
    await flag.save();
    res.status(200).json({ message: "Feature flag updated", flag });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/feature-flags  { key, label, description, enabled }
const createFlag = async (req, res) => {
  try {
    const { key, label, description, enabled } = req.body;
    if (!key || !label) return res.status(400).json({ message: "key and label are required" });
    const flag = await FeatureFlag.create({ key, label, description, enabled: !!enabled, updatedBy: req.user._id });
    res.status(201).json({ message: "Feature flag created", flag });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A flag with that key already exists" });
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getFlags, getPublicFlags, updateFlag, createFlag, ensureDefaultFlags };
