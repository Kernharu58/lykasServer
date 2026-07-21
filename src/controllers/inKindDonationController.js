const InKindDonation = require("../models/InKindDonation");
const AuditLog       = require("../models/AuditLog");
const { notify }     = require("../utils/notificationHelper");
const { logChange, getRecordHistory } = require("../utils/auditLogger");
const { buildListQuery, buildPagination } = require("../utils/queryBuilder");
const { sendCsv, sendExcel, sendPdf } = require("../utils/exportUtil");

const logAction = async ({ actor, action, metadata }) => {
  try { await AuditLog.create({ actor, action, metadata }); } catch { }
};

// POST /api/donations/goods
const createDonation = async (req, res) => {
  try {
    const { items, dropOff, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "At least one item is required" });

    for (const item of items) {
      if (!item.name || !item.quantity || item.quantity < 1)
        return res.status(400).json({ message: "Each item needs a name and quantity ≥ 1" });
    }

    const donation = await InKindDonation.create({
      donatedBy: req.user._id,
      items,
      dropOff: dropOff || "walk_in",
      notes:   notes || "",
    });

    // Notify all admins/staff
    try {
      const User   = require("../models/User");
      const admins = await User.find({ role: { $in: ["admin", "staff", "super_admin"] } }).select("_id");
      await Promise.allSettled(
        admins.map(admin =>
          notify({
            recipient: admin._id,
            type:      "GENERAL",
            title:     "New Goods Donation Pledge",
            message:   `${req.user.displayName} pledged ${items.length} type(s) of goods.`,
            refModel:  "InKindDonation",
            refId:     donation._id,
          })
        )
      );
    } catch { }

    await logAction({
      actor: req.user._id,
      action: "IN_KIND_DONATION_CREATED",
      metadata: { donationId: donation._id, itemCount: items.length, dropOff },
    });

    res.status(201).json({ message: "Donation pledge submitted", donation });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/donations/goods/my  — logged-in user's own donations
const getMyDonations = async (req, res) => {
  try {
    const donations = await InKindDonation.find({ donatedBy: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ donations });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/donations/goods  — admin: search/sort/filter + pagination
const getAllDonations = async (req, res) => {
  try {
    const { filter, sort, skip, limit, page } = buildListQuery(req.query, {
      filterFields: ["status", "dropOff"],
      softDelete: true,
    });

    const [donations, total] = await Promise.all([
      InKindDonation.find(filter)
        .populate("donatedBy", "displayName email phone")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      InKindDonation.countDocuments(filter),
    ]);

    res.status(200).json({ donations, pagination: buildPagination(total, page, limit) });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// PATCH /api/donations/goods/:id/status  — admin: update status + notify donor
const updateStatus = async (req, res) => {
  try {
    const { status, staffNote } = req.body;
    const VALID = ["confirmed", "received", "cancelled"];

    if (!VALID.includes(status))
      return res.status(400).json({ message: `Status must be one of: ${VALID.join(", ")}` });

    const donation = await InKindDonation.findById(req.params.id)
      .populate("donatedBy", "_id displayName");
    if (!donation)
      return res.status(404).json({ message: "Donation not found" });

    donation.status    = status;
    donation.staffNote = staffNote || donation.staffNote;
    if (status === "received") donation.receivedAt = new Date();
    await donation.save();

    const msgs = {
      confirmed: "Your goods donation pledge has been confirmed! Please proceed with your chosen drop-off method.",
      received:  "Your donated goods have been received by the shelter. Thank you! 🐾",
      cancelled: "Your goods donation pledge has been cancelled. Contact the shelter for questions.",
    };

    await notify({
      recipient: donation.donatedBy._id,
      type:      "GENERAL",
      title:     "Goods Donation Update",
      message:   msgs[status],
      refModel:  "InKindDonation",
      refId:     donation._id,
    });

    await logAction({
      actor: req.user._id,
      action: `IN_KIND_DONATION_${status.toUpperCase()}`,
      metadata: { donationId: donation._id, status, staffNote },
    });

    res.status(200).json({ message: "Status updated", donation });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// DELETE /api/donations/goods/:id  — admin: soft delete (recoverable)
const deleteDonation = async (req, res) => {
  try {
    const donation = await InKindDonation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    if (donation.isDeleted) return res.status(400).json({ message: "Already deleted" });

    donation.isDeleted = true;
    donation.deletedAt = new Date();
    donation.deletedBy = req.user._id;
    await donation.save();

    await logChange({
      actor: req.user._id,
      action: "DONATION_SOFT_DELETE",
      entityType: "InKindDonation",
      entityId: donation._id,
      before: { isDeleted: false },
      after: { isDeleted: true },
      req,
    });

    res.status(200).json({ message: "Donation moved to Deleted (recoverable)." });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/donations/goods/:id/restore
const restoreDonation = async (req, res) => {
  try {
    const donation = await InKindDonation.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    if (!donation.isDeleted) return res.status(400).json({ message: "Donation is not deleted" });

    donation.isDeleted = false;
    donation.deletedAt = null;
    donation.deletedBy = null;
    await donation.save();

    await logChange({
      actor: req.user._id,
      action: "DONATION_RESTORE",
      entityType: "InKindDonation",
      entityId: donation._id,
      before: { isDeleted: true },
      after: { isDeleted: false },
      req,
    });

    res.status(200).json({ message: "Donation restored.", donation });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/donations/goods/bulk-status  { ids: [...], status: "confirmed"|"received"|"cancelled" }
const bulkUpdateDonationStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    const VALID = ["confirmed", "received", "cancelled"];
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids must be a non-empty array" });
    }
    if (!VALID.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${VALID.join(", ")}` });
    }

    const update = { status };
    if (status === "received") update.receivedAt = new Date();
    const result = await InKindDonation.updateMany({ _id: { $in: ids } }, update);

    await logChange({
      actor: req.user._id,
      action: "DONATION_BULK_STATUS",
      entityType: "InKindDonation",
      entityId: null,
      after: { ids, status },
      req,
      metadata: { count: result.modifiedCount },
    });

    res.status(200).json({ message: `${result.modifiedCount} donation(s) updated to ${status}` });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/donations/goods/export?format=csv
const exportDonations = async (req, res) => {
  try {
    const { filter } = buildListQuery(req.query, { filterFields: ["status"], softDelete: true });
    const format = (req.query.format || "csv").toLowerCase();
    const donations = await InKindDonation.find(filter).populate("donatedBy", "displayName email").sort("-createdAt");

    const rows = donations.map((d) => ({
      id: d._id.toString(),
      donor: d.donatedBy?.displayName || "",
      email: d.donatedBy?.email || "",
      items: d.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join("; "),
      dropOff: d.dropOff,
      status: d.status,
      createdAt: d.createdAt?.toISOString(),
    }));

    if (format === "excel" || format === "xlsx") return sendExcel(res, "donations.xlsx", rows);
    if (format === "pdf") return sendPdf(res, "donations.pdf", "Goods Donations Export", rows);
    return sendCsv(res, "donations.csv", rows);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/donations/goods/:id/history
const getDonationHistory = async (req, res) => {
  try {
    const history = await getRecordHistory("InKindDonation", req.params.id, req.query);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  createDonation,
  getMyDonations,
  getAllDonations,
  updateStatus,
  deleteDonation,
  restoreDonation,
  bulkUpdateDonationStatus,
  exportDonations,
  getDonationHistory,
};