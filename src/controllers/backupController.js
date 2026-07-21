const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const mongoose = require("mongoose");
const Backup = require("../models/Backup");

// Collections we never want to dump/restore wholesale — auth/session
// internals regenerate themselves and shouldn't be replayed onto another
// environment.
const EXCLUDED_COLLECTIONS = ["sessions", "apilogs", "tokenblacklists"];

const BACKUP_DIR = path.join(__dirname, "..", "..", "backups");
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const dumpDatabase = async () => {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const dump = {};
  let documentCount = 0;
  for (const { name } of collections) {
    if (EXCLUDED_COLLECTIONS.includes(name)) continue;
    const docs = await mongoose.connection.db.collection(name).find({}).toArray();
    dump[name] = docs;
    documentCount += docs.length;
  }
  return { dump, documentCount, collections: Object.keys(dump) };
};

// POST /api/backups  { type?: "manual" }
const createBackup = async (req, res) => {
  const record = await Backup.create({
    type: req.body?.type === "automatic" ? "automatic" : "manual",
    status: "running",
    createdBy: req.user?._id || null,
  });

  try {
    const { dump, documentCount, collections } = await dumpDatabase();
    const json = JSON.stringify(dump);
    const gzipped = zlib.gzipSync(json);

    const fileName = `backup-${record._id}-${Date.now()}.json.gz`;
    const filePath = path.join(BACKUP_DIR, fileName);
    fs.writeFileSync(filePath, gzipped);

    record.status = "completed";
    record.filePath = filePath;
    record.fileName = fileName;
    record.sizeBytes = gzipped.length;
    record.collections = collections;
    record.documentCount = documentCount;
    await record.save();

    res.status(201).json({ message: "Backup created", backup: record });
  } catch (error) {
    record.status = "failed";
    record.error = error.message;
    await record.save();
    res.status(500).json({ message: "Backup failed", error: error.message });
  }
};

// GET /api/backups
const getBackups = async (_req, res) => {
  try {
    const backups = await Backup.find({}).sort({ createdAt: -1 }).populate("createdBy", "displayName email");
    res.status(200).json({ backups });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/backups/:id/download
const downloadBackup = async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup || backup.status !== "completed" || !backup.filePath) {
      return res.status(404).json({ message: "Backup file not found" });
    }
    if (!fs.existsSync(backup.filePath)) {
      return res.status(410).json({ message: "Backup file no longer exists on disk" });
    }
    res.download(backup.filePath, backup.fileName);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/backups/:id/restore
// DANGEROUS: replaces the contents of every collection in the backup.
// Restricted to super_admin at the route level.
const restoreBackup = async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup || backup.status !== "completed" || !backup.filePath) {
      return res.status(404).json({ message: "Backup not found or incomplete" });
    }
    if (!fs.existsSync(backup.filePath)) {
      return res.status(410).json({ message: "Backup file no longer exists on disk" });
    }
    if (req.body?.confirm !== backup.fileName) {
      return res.status(400).json({
        message: "Restore not confirmed. Pass { confirm: '<fileName>' } to proceed.",
        fileName: backup.fileName,
      });
    }

    const gzipped = fs.readFileSync(backup.filePath);
    const dump = JSON.parse(zlib.gunzipSync(gzipped).toString("utf8"));

    for (const [collectionName, docs] of Object.entries(dump)) {
      const coll = mongoose.connection.db.collection(collectionName);
      await coll.deleteMany({});
      if (docs.length) await coll.insertMany(docs, { ordered: false });
    }

    backup.restoredAt = new Date();
    backup.restoredBy = req.user._id;
    await backup.save();

    res.status(200).json({ message: "Restore completed", collectionsRestored: Object.keys(dump) });
  } catch (error) {
    res.status(500).json({ message: "Restore failed", error: error.message });
  }
};

// DELETE /api/backups/:id
const deleteBackup = async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);
    if (!backup) return res.status(404).json({ message: "Backup not found" });
    if (backup.filePath && fs.existsSync(backup.filePath)) {
      fs.unlinkSync(backup.filePath);
    }
    await backup.deleteOne();
    res.status(200).json({ message: "Backup deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { createBackup, getBackups, downloadBackup, restoreBackup, deleteBackup };
