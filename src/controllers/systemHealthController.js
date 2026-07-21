const mongoose = require("mongoose");
const os = require("os");

const MONGO_STATES = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

// GET /api/system/health — detailed status for the admin System Health page.
// (The lightweight, unauthenticated /health at the app root stays as-is for
// uptime pingers/load balancers — this is the richer, admin-only view.)
const getSystemHealth = async (_req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    let dbStats = null;
    if (dbState === 1) {
      try {
        const stats = await mongoose.connection.db.stats();
        dbStats = {
          collections: stats.collections,
          dataSizeMB: +(stats.dataSize / (1024 * 1024)).toFixed(2),
          storageSizeMB: +(stats.storageSize / (1024 * 1024)).toFixed(2),
          indexSizeMB: +(stats.indexSize / (1024 * 1024)).toFixed(2),
        };
      } catch (e) {
        dbStats = { error: "Could not read DB stats" };
      }
    }

    res.status(200).json({
      status: dbState === 1 ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        platform: os.platform(),
        loadAverage: os.loadavg(), // [1min, 5min, 15min]
        cpuCount: os.cpus().length,
      },
      memory: {
        totalMB: +(totalMem / (1024 * 1024)).toFixed(0),
        usedMB: +(usedMem / (1024 * 1024)).toFixed(0),
        freeMB: +(freeMem / (1024 * 1024)).toFixed(0),
        usedPercent: +((usedMem / totalMem) * 100).toFixed(1),
        processRssMB: +(process.memoryUsage().rss / (1024 * 1024)).toFixed(0),
      },
      database: {
        state: MONGO_STATES[dbState] || "unknown",
        host: mongoose.connection.host || null,
        name: mongoose.connection.name || null,
        stats: dbStats,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

// GET /api/system/version — Operational Feature: "Version information"
const getVersion = async (_req, res) => {
  try {
    const pkg = require("../../package.json");
    let commit = null;
    try {
      commit = require("child_process")
        .execSync("git rev-parse --short HEAD", { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch (e) {
      commit = null; // not a git checkout (e.g. deployed as a plain build) — fine to omit
    }

    res.status(200).json({
      name: pkg.name,
      version: pkg.version,
      commit,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getSystemHealth, getVersion };
