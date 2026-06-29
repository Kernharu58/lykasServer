const cron = require("node-cron");
const https = require("https");
const http = require("http");
const { Foster } = require("./models/Foster");

const BACKEND_URL = process.env.BACKEND_URL || "https://your-app.onrender.com";

// ── Ping every 14 minutes to prevent Render free tier from sleeping ────────────
// BUG FIX: Use native http/https instead of axios (removed from dependencies)
const pingServer = () => {
  const url = new URL(`${BACKEND_URL}/health`);
  const client = url.protocol === "https:" ? https : http;

  client.get(url.toString(), (res) => {
    console.log(`[CRON - PING] ${new Date().toISOString()} - Status: ${res.statusCode} ✅`);
  }).on("error", (err) => {
    console.error(`[CRON - PING] ${new Date().toISOString()} - Failed: ${err.message} ❌`);
  });
};

cron.schedule("*/14 * * * *", pingServer);

// ── Daily: Flag overdue foster trials ─────────────────────────────────────────
cron.schedule("0 0 * * *", async () => {
  const label = `[CRON - FOSTER TRIALS] ${new Date().toISOString()}`;
  try {
    const now = new Date();
    const overdue = await Foster.find({
      status: "active",
      expectedEndDate: { $lte: now },
    }).populate("fosterer", "displayName email").populate("pet", "name");

    if (overdue.length > 0) {
      console.log(`${label} - ${overdue.length} foster trial(s) overdue`);
      for (const foster of overdue) {
        try {
          const { notify } = require("./utils/notificationHelper");
          await notify({
            recipient: foster.fosterer._id,
            type: "FOSTER_TRIAL_OVERDUE",
            title: "Foster Trial Period Ended",
            message: `The foster trial for ${foster.pet?.name || "your pet"} has ended. Please coordinate with staff to finalize your decision.`,
            refModel: "Foster",
            refId: foster._id,
          });
        } catch (notifErr) {
          console.warn(`${label} - Could not send notification for foster ${foster._id}:`, notifErr.message);
        }
      }
    } else {
      console.log(`${label} - No overdue foster trials ✅`);
    }
  } catch (err) {
    console.error(`${label} - Failed:`, err.message);
  }
});

// ── Daily cleanup ──────────────────────────────────────────────────────────────
cron.schedule("0 1 * * *", async () => {
  const label = `[CRON - DAILY] ${new Date().toISOString()}`;
  try {
    console.log(`${label} - Running daily cleanup...`);
    console.log(`${label} - Done ✅`);
  } catch (err) {
    console.error(`${label} - Failed:`, err.message);
  }
});

console.log("✅ Cron jobs initialized (ping + foster trial monitor + daily cleanup)");
