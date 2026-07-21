const ApiLog = require("../models/ApiLog");

// GET /api/monitoring/api/summary?hours=24
const getSummary = async (req, res) => {
  try {
    const hours = Number(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const match = { createdAt: { $gte: since } };

    const [totals] = await ApiLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          avgDurationMs: { $avg: "$durationMs" },
          failedRequests: { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
        },
      },
    ]);

    const slowestEndpoints = await ApiLog.aggregate([
      { $match: match },
      { $group: { _id: { method: "$method", path: "$path" }, avgDurationMs: { $avg: "$durationMs" }, count: { $sum: 1 } } },
      { $sort: { avgDurationMs: -1 } },
      { $limit: 10 },
    ]);

    const mostUsedEndpoints = await ApiLog.aggregate([
      { $match: match },
      { $group: { _id: { method: "$method", path: "$path" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const recentFailures = await ApiLog.find({ ...match, statusCode: { $gte: 400 } })
      .sort({ createdAt: -1 })
      .limit(25);

    res.status(200).json({
      windowHours: hours,
      totalRequests: totals?.totalRequests || 0,
      avgDurationMs: Math.round(totals?.avgDurationMs || 0),
      failedRequests: totals?.failedRequests || 0,
      slowestEndpoints,
      mostUsedEndpoints,
      recentFailures,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getSummary };
