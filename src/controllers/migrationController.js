const Migration = require("../models/Migration");

// GET /api/migrations
const getMigrations = async (_req, res) => {
  try {
    const migrations = await Migration.find({}).sort({ appliedAt: -1 }).populate("appliedBy", "displayName email");
    res.status(200).json({ migrations });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/migrations  { name, description, status }
// Manual ledger entry — there's no automated runner, so this records that a
// schema/data change (e.g. a one-off backfill script) was applied.
const recordMigration = async (req, res) => {
  try {
    const { name, description, status } = req.body;
    if (!name) return res.status(400).json({ message: "name is required" });
    const migration = await Migration.create({
      name, description, status: status || "applied", appliedBy: req.user._id, appliedAt: new Date(),
    });
    res.status(201).json({ message: "Migration recorded", migration });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A migration with that name is already recorded" });
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getMigrations, recordMigration };
