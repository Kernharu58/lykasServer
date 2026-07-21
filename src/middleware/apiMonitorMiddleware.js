const ApiLog = require("../models/ApiLog");

// Lightweight request logger for the admin "API Monitoring" page. Fire-and-forget
// so logging never adds latency to (or can fail) the actual request.
const apiMonitor = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    ApiLog.create({
      method: req.method,
      path: req.route ? `${req.baseUrl}${req.route.path}` : req.originalUrl.split("?")[0],
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?._id || null,
      ipAddress: req.ip,
    }).catch(() => {}); // never let logging failures affect the request
  });

  next();
};

module.exports = apiMonitor;
