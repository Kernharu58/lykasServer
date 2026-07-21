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

// ── Scheduled reminder jobs (High Priority #6) ─────────────────────────────────
const { runJob } = require("./jobs/reminderJobs");

// Home visit + interview reminders: daily 7:00am
cron.schedule("0 7 * * *", async () => {
  for (const jobKey of ["interview_reminders", "home_visit_reminders"]) {
    try {
      const log = await runJob(jobKey, { triggeredBy: "cron" });
      console.log(`[CRON - ${jobKey}] ${log.message}`);
    } catch (err) {
      console.error(`[CRON - ${jobKey}] Failed:`, err.message);
    }
  }
});

// Adoption / vaccination / expired-document reminders: daily 8:00am
cron.schedule("0 8 * * *", async () => {
  for (const jobKey of ["adoption_reminders", "vaccination_reminders", "expired_documents"]) {
    try {
      const log = await runJob(jobKey, { triggeredBy: "cron" });
      console.log(`[CRON - ${jobKey}] ${log.message}`);
    } catch (err) {
      console.error(`[CRON - ${jobKey}] Failed:`, err.message);
    }
  }
});

// Donation reminders: daily 9:00am
cron.schedule("0 9 * * *", async () => {
  try {
    const log = await runJob("donation_reminders", { triggeredBy: "cron" });
    console.log(`[CRON - donation_reminders] ${log.message}`);
  } catch (err) {
    console.error(`[CRON - donation_reminders] Failed:`, err.message);
  }
});

// ── Automatic nightly backup (High Priority #5) ─────────────────────────────────
cron.schedule("0 2 * * *", async () => {
  const label = `[CRON - BACKUP] ${new Date().toISOString()}`;
  try {
    // Lazily required to avoid pulling in the backup controller (and its
    // fs/zlib usage) unless the cron job actually fires.
    const Backup = require("./models/Backup");
    const fs = require("fs");
    const path = require("path");
    const zlib = require("zlib");
    const mongoose = require("mongoose");

    const record = await Backup.create({ type: "automatic", status: "running" });
    const collections = await mongoose.connection.db.listCollections().toArray();
    const EXCLUDED = ["sessions", "apilogs", "tokenblacklists"];
    const dump = {};
    let documentCount = 0;
    for (const { name } of collections) {
      if (EXCLUDED.includes(name)) continue;
      const docs = await mongoose.connection.db.collection(name).find({}).toArray();
      dump[name] = docs;
      documentCount += docs.length;
    }

    const backupDir = path.join(__dirname, "..", "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const fileName = `backup-${record._id}-${Date.now()}.json.gz`;
    const filePath = path.join(backupDir, fileName);
    const gzipped = zlib.gzipSync(JSON.stringify(dump));
    fs.writeFileSync(filePath, gzipped);

    record.status = "completed";
    record.filePath = filePath;
    record.fileName = fileName;
    record.sizeBytes = gzipped.length;
    record.collections = Object.keys(dump);
    record.documentCount = documentCount;
    await record.save();

    // Keep only the last 14 automatic backups on disk to bound storage use.
    const old = await Backup.find({ type: "automatic", status: "completed" }).sort({ createdAt: -1 }).skip(14);
    for (const b of old) {
      if (b.filePath && fs.existsSync(b.filePath)) fs.unlinkSync(b.filePath);
      await b.deleteOne();
    }

    console.log(`${label} - Backup completed: ${fileName} (${documentCount} documents) ✅`);
  } catch (err) {
    console.error(`${label} - Failed:`, err.message);
  }
});

// ── Monthly data archive (Nice-to-Have) ──────────────────────────────────────────
// Runs on the 1st of each month at 3am — moves old completed/closed records
// (180+ days) to cold storage. Mirrors POST /api/archive/:collection.
cron.schedule("0 3 1 * *", async () => {
  const label = `[CRON - ARCHIVE] ${new Date().toISOString()}`;
  try {
    const Archive = require("./models/Archive");
    const Application = require("./models/Application");
    const InKindDonation = require("./models/InKindDonation");
    const Payment = require("./models/Payment");

    const targets = [
      { name: "Application", model: Application, statusField: "status", statuses: ["approved", "rejected"] },
      { name: "InKindDonation", model: InKindDonation, statusField: "status", statuses: ["received", "cancelled"] },
      { name: "Payment", model: Payment, statusField: "status", statuses: ["paid", "refunded", "failed"] },
    ];
    const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    let totalArchived = 0;

    for (const target of targets) {
      const candidates = await target.model.find({
        updatedAt: { $lte: cutoff },
        [target.statusField]: { $in: target.statuses },
      });
      if (!candidates.length) continue;

      await Archive.insertMany(
        candidates.map((doc) => ({
          sourceCollection: target.name,
          originalId: doc._id,
          data: doc.toObject(),
          reason: "auto_age",
        })),
      );
      await target.model.deleteMany({ _id: { $in: candidates.map((c) => c._id) } });
      totalArchived += candidates.length;
    }

    console.log(`${label} - Archived ${totalArchived} record(s) ✅`);
  } catch (err) {
    console.error(`${label} - Failed:`, err.message);
  }
});

console.log("✅ Cron jobs initialized (ping + foster trial monitor + daily cleanup + reminders + nightly backup + monthly archive)");
