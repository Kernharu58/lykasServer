const AuditLog = require("../models/AuditLog");

// GET /api/audit-logs?action=&actorId=&targetUserId=&from=&to=&page=1&limit=50
const getAuditLogs = async (req, res) => {
  try {
    const { action, actorId, targetUserId, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (action) filter.action = { $regex: action, $options: "i" };
    if (actorId) filter.actor = actorId;
    if (targetUserId) filter.targetUser = targetUserId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actor",      "displayName email role")
        .populate("targetUser", "displayName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      AuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      logs,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/audit-logs/:id
const getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id)
      .populate("actor",      "displayName email role")
      .populate("targetUser", "displayName email role");

    if (!log) return res.status(404).json({ message: "Audit log not found" });
    res.status(200).json(log);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/audit-logs/actions  (distinct action strings for filter dropdowns)
const getAuditActions = async (req, res) => {
  try {
    const actions = await AuditLog.distinct("action");
    res.status(200).json(actions.sort());
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getAuditLogs, getAuditLogById, getAuditActions };
