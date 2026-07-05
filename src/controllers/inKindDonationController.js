const InKindDonation = require("../models/InKindDonation");
const AuditLog       = require("../models/AuditLog");
const { notify }     = require("../utils/notificationHelper");

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

// GET /api/donations/goods  — admin: list all, optional ?status= filter
const getAllDonations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const donations = await InKindDonation.find(filter)
      .populate("donatedBy", "displayName email phone")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ donations });
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

module.exports = { createDonation, getMyDonations, getAllDonations, updateStatus };