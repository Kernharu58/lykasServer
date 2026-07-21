const ErrorLog = require("../models/ErrorLog");

// POST /api/errors/report — client-side crash reporting (admin panel or mobile app)
const reportError = async (req, res) => {
  try {
    const { message, stack, route, severity, metadata, source } = req.body;
    if (!message) return res.status(400).json({ message: "message is required" });

    const log = await ErrorLog.create({
      source: source || "admin",
      message,
      stack: stack || null,
      route: route || null,
      severity: severity || "error",
      metadata: metadata || null,
      userId: req.user?._id || null,
    });
    res.status(201).json({ message: "Error report received", id: log._id });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/errors?resolved=&severity=&source=&page=&limit=
const getErrors = async (req, res) => {
  try {
    const { resolved, severity, source, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (resolved !== undefined) filter.resolved = resolved === "true";
    if (severity) filter.severity = severity;
    if (source) filter.source = source;

    const skip = (Number(page) - 1) * Number(limit);
    const [errors, total] = await Promise.all([
      ErrorLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      ErrorLog.countDocuments(filter),
    ]);
    res.status(200).json({ errors, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// PUT /api/errors/:id/resolve
const resolveError = async (req, res) => {
  try {
    const log = await ErrorLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Error log not found" });
    log.resolved = true;
    log.resolvedBy = req.user._id;
    log.resolvedAt = new Date();
    await log.save();
    res.status(200).json({ message: "Marked resolved", log });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Internal helper — used by the server's global error handler to persist
// unhandled server-side errors automatically.
const logServerError = async ({ message, stack, route, method, statusCode, userId }) => {
  try {
    await ErrorLog.create({ source: "server", message, stack, route, method, statusCode, userId, severity: "error" });
  } catch (e) {
    console.error("Failed to persist error log:", e.message);
  }
};

module.exports = { reportError, getErrors, resolveError, logServerError };
