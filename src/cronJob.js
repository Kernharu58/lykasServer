const cron = require("node-cron");
const axios = require("axios");
const { Foster } = require("./models/Foster");

const BACKEND_URL = process.env.BACKEND_URL || "https://your-app.onrender.com";

// ── Ping every 14 minutes to prevent Render free tier from sleeping ────────────
cron.schedule("*/14 * * * *", async () => {
  try {
    const res = await axios.get(`${BACKEND_URL}/health`);
    console.log(`[CRON - PING] ${new Date().toISOString()} - Status: ${res.status} ✅`);
  } catch (err) {
    console.error(`[CRON - PING] ${new Date().toISOString()} - Failed: ${err.message} ❌`);
  }
});

// ── Daily: Flag overdue foster trials (pseudocode §1: checkOverdueFosterTrials) ─
// Runs at midnight daily
cron.schedule("0 0 * * *", async () => {
  const label = `[CRON - FOSTER TRIALS] ${new Date().toISOString()}`;
  try {
    const now = new Date();
    const overdue = await Foster.find({
      status: "active",
      expectedEndDate: { $lte: now },
    }).populate("fosterer", "displayName email").populate("pet", "name");

    if (overdue.length > 0) {
      console.log(`${label} - ${overdue.length} foster trial(s) overdue — staff notification triggered`);
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

// ── Daily: Cleanup and other scheduled tasks ──────────────────────────────────
cron.schedule("0 1 * * *", async () => {
  const label = `[CRON - DAILY] ${new Date().toISOString()}`;
  try {
    console.log(`${label} - Running daily cleanup...`);
    // Example: await User.deleteMany({ isVerified: false, createdAt: { $lt: threeDaysAgo } });
    console.log(`${label} - Done ✅`);
  } catch (err) {
    console.error(`${label} - Failed:`, err.message);
  }
});

console.log("✅ Cron jobs initialized (ping + foster trial monitor + daily cleanup)");
