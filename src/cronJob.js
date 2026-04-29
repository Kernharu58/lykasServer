const cron = require("node-cron");
const axios = require("axios");

const BACKEND_URL = process.env.BACKEND_URL || "https://your-app.onrender.com"; // 🔁 Add this in your .env

// ✅ Ping every 14 minutes to prevent Render free tier from sleeping
cron.schedule("*/14 * * * *", async () => {
  try {
    const res = await axios.get(`${BACKEND_URL}/health`);
    console.log(`[CRON - PING] ${new Date().toISOString()} - Status: ${res.status} ✅`);
  } catch (err) {
    console.error(`[CRON - PING] ${new Date().toISOString()} - Failed: ${err.message} ❌`);
  }
});

// ✅ Optional: Daily cleanup or any scheduled task (runs every midnight)
cron.schedule("0 0 * * *", async () => {
  try {
    console.log(`[CRON - DAILY] ${new Date().toISOString()} - Running daily task...`);
    // Example: await User.deleteMany({ isVerified: false, createdAt: { $lt: threeDaysAgo } });
    console.log(`[CRON - DAILY] Done ✅`);
  } catch (err) {
    console.error(`[CRON - DAILY] Failed:`, err.message);
  }
});

console.log("✅ Cron jobs initialized");