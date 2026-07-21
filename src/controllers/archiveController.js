const mongoose = require("mongoose");
const Archive = require("../models/Archive");
const Application = require("../models/Application");
const InKindDonation = require("../models/InKindDonation");
const Payment = require("../models/Payment");

// Registry of what's archivable, the date field to age against, and which
// statuses are safe to move to cold storage (Nice-to-Have: "Data Archive").
const ARCHIVABLE = {
  Application: { model: Application, dateField: "updatedAt", statusField: "status", archivableStatuses: ["approved", "rejected"] },
  InKindDonation: { model: InKindDonation, dateField: "updatedAt", statusField: "status", archivableStatuses: ["received", "cancelled"] },
  Payment: { model: Payment, dateField: "updatedAt", statusField: "status", archivableStatuses: ["paid", "refunded", "failed"] },
};

// POST /api/archive/:collection  { olderThanDays: 180 }
const archiveOldRecords = async (req, res) => {
  try {
    const config = ARCHIVABLE[req.params.collection];
    if (!config) {
      return res.status(400).json({ message: `Archiving isn't supported for '${req.params.collection}'. Supported: ${Object.keys(ARCHIVABLE).join(", ")}` });
    }
    const olderThanDays = Number(req.body?.olderThanDays) || 180;
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const candidates = await config.model.find({
      [config.dateField]: { $lte: cutoff },
      [config.statusField]: { $in: config.archivableStatuses },
    });

    if (!candidates.length) {
      return res.status(200).json({ message: "No records old enough to archive", archivedCount: 0 });
    }

    const archiveDocs = candidates.map((doc) => ({
      sourceCollection: req.params.collection,
      originalId: doc._id,
      data: doc.toObject(),
      reason: "auto_age",
      archivedBy: req.user._id,
    }));
    await Archive.insertMany(archiveDocs);
    await config.model.deleteMany({ _id: { $in: candidates.map((c) => c._id) } });

    res.status(200).json({ message: "Records archived", archivedCount: candidates.length });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/archive?sourceCollection=&page=&limit=
const getArchive = async (req, res) => {
  try {
    const { sourceCollection, page = 1, limit = 20 } = req.query;
    const filter = { restoredAt: null };
    if (sourceCollection) filter.sourceCollection = sourceCollection;

    const skip = (Number(page) - 1) * Number(limit);
    const [records, total] = await Promise.all([
      Archive.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Archive.countDocuments(filter),
    ]);
    res.status(200).json({ records, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/archive/:id/restore
const restoreFromArchive = async (req, res) => {
  try {
    const record = await Archive.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Archive record not found" });
    if (record.restoredAt) return res.status(400).json({ message: "This record was already restored" });

    const config = ARCHIVABLE[record.sourceCollection];
    if (!config) return res.status(400).json({ message: `Unknown source collection: ${record.sourceCollection}` });

    const { _id, ...data } = record.data;
    await config.model.create({ _id, ...data });

    record.restoredAt = new Date();
    record.restoredBy = req.user._id;
    await record.save();

    res.status(200).json({ message: "Record restored" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { archiveOldRecords, getArchive, restoreFromArchive };
