const HomeVisit   = require("../models/HomeVisit");
const Application = require("../models/Application");
const AuditLog    = require("../models/AuditLog");
const { notify } = require("../utils/notificationHelper");
const { autoRejectApplication } = require("./applicationController");

const logAction = async ({ actor, action, targetUser, metadata }) => {
  try { await AuditLog.create({ actor, action, targetUser, metadata }); } catch (e) { /* silent */ }
};

// ─── ADMIN: Schedule a home visit ─────────────────────────────────────────────
// POST /api/home-visits
// { applicationId, scheduledDate, address, assignedTo }
const scheduleHomeVisit = async (req, res) => {
  try {
    const { applicationId, scheduledDate, address, assignedTo } = req.body;

    const application = await Application.findById(applicationId)
      .populate("applicant", "displayName email")
      .populate("pet", "name");

    if (!application) return res.status(404).json({ message: "Application not found" });
    if (application.status === "rejected") {
      return res.status(400).json({ message: "Cannot schedule home visit for a rejected application" });
    }

    const existing = await HomeVisit.findOne({ application: applicationId, status: "scheduled" });
    if (existing) {
      return res.status(400).json({ message: "A home visit is already scheduled for this application" });
    }

    const visit = await HomeVisit.create({
      application: applicationId,
      applicant:   application.applicant._id,
      pet:         application.pet._id,
      scheduledDate,
      address:     address || application.address,
      assignedTo:  assignedTo || req.user._id,
    });

    await logAction({
      actor: req.user._id,
      action: "HOME_VISIT_SCHEDULED",
      targetUser: application.applicant._id,
      metadata: { visitId: visit._id, applicationId, scheduledDate },
    });

    await notify({
      recipient: application.applicant._id,
      sender: req.user._id,
      type: "HOME_VISIT_SCHEDULED",
      title: "Home visit scheduled",
      message: `A home visit for your application for ${application.pet.name} has been scheduled.`,
      refModel: "HomeVisit",
      refId: visit._id,
    });

    res.status(201).json({ message: "Home visit scheduled", visit });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all home visits ────────────────────────────────────────────────
// GET /api/home-visits?status=scheduled&page=1&limit=20
const getAllHomeVisits = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && ["scheduled", "completed", "cancelled", "rescheduled", "no-show"].includes(status)) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [visits, total] = await Promise.all([
      HomeVisit.find(filter)
        .populate("applicant",   "displayName email profilePicture")
        .populate("pet",         "name species breed imageUrl")
        .populate("application", "status createdAt")
        .populate("assignedTo",  "displayName email")
        .sort({ scheduledDate: 1 })
        .skip(skip)
        .limit(Number(limit)),
      HomeVisit.countDocuments(filter),
    ]);

    res.status(200).json({
      visits,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── SHARED: Get single home visit ────────────────────────────────────────────
// GET /api/home-visits/:id
const getHomeVisitById = async (req, res) => {
  try {
    const visit = await HomeVisit.findById(req.params.id)
      .populate("applicant",   "displayName email profilePicture")
      .populate("pet",         "name species breed imageUrl age gender")
      .populate("application", "status phone address experience createdAt")
      .populate("assignedTo",  "displayName email");

    if (!visit) return res.status(404).json({ message: "Home visit not found" });

    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = visit.applicant._id.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this home visit" });
    }

    res.status(200).json(visit);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get my home visits ─────────────────────────────────────────────────
// GET /api/home-visits/my
const getMyHomeVisits = async (req, res) => {
  try {
    const visits = await HomeVisit.find({ applicant: req.user._id })
      .populate("pet",         "name species breed imageUrl")
      .populate("application", "status createdAt")
      .populate("assignedTo",  "displayName email")
      .sort({ scheduledDate: 1 });
    res.status(200).json(visits);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Reschedule ────────────────────────────────────────────────────────
// PUT /api/home-visits/:id
// { scheduledDate, address, assignedTo }
const updateHomeVisit = async (req, res) => {
  try {
    const visit = await HomeVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: "Home visit not found" });
    if (visit.status === "completed") {
      return res.status(400).json({ message: "Cannot edit a completed home visit" });
    }

    const { scheduledDate, address, assignedTo } = req.body;
    if (scheduledDate !== undefined) { visit.scheduledDate = scheduledDate; visit.status = "rescheduled"; }
    if (address    !== undefined) visit.address    = address;
    if (assignedTo !== undefined) visit.assignedTo = assignedTo;

    await visit.save();

    await logAction({
      actor: req.user._id, action: "HOME_VISIT_RESCHEDULED",
      targetUser: visit.applicant,
      metadata: { visitId: visit._id, newDate: scheduledDate },
    });

    res.status(200).json({ message: "Home visit updated", visit });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Submit visit report & complete ────────────────────────────────────
// PUT /api/home-visits/:id/complete
// { report: { livingSpace, safetyCheck, ... }, result, notes }
const completeHomeVisit = async (req, res) => {
  try {
    const { report, result, notes } = req.body;

    if (!["passed", "failed"].includes(result)) {
      return res.status(400).json({ message: "Result must be 'passed' or 'failed'" });
    }

    const visit = await HomeVisit.findById(req.params.id)
      .populate("applicant", "displayName email")
      .populate("pet", "name");
    if (!visit) return res.status(404).json({ message: "Home visit not found" });
    if (visit.status === "completed") {
      return res.status(400).json({ message: "Home visit is already completed" });
    }

    visit.status      = "completed";
    visit.result      = result;
    visit.report      = { ...visit.report, ...report };
    visit.notes       = notes || visit.notes;
    visit.completedAt = new Date();
    visit.assignedTo  = req.user._id;
    await visit.save();

    await logAction({
      actor: req.user._id,
      action: result === "passed" ? "HOME_VISIT_PASSED" : "HOME_VISIT_FAILED",
      targetUser: visit.applicant._id,
      metadata: { visitId: visit._id, applicationId: visit.application, result },
    });

    if (result === "failed") {
      // ── Single source of truth for status: a failed home visit rejects the
      // application and frees the pet, instead of leaving it stuck "pending".
      await autoRejectApplication({
        applicationId: visit.application,
        actorId: req.user._id,
        reason: `Application rejected after home visit (${notes || "no additional notes"}).`,
      });
    } else {
      await notify({
        recipient: visit.applicant._id,
        sender: req.user._id,
        type: "HOME_VISIT_RESULT",
        title: "Home visit passed",
        message: `Your home visit for ${visit.pet?.name || "the pet"} passed. Staff will follow up with a final decision.`,
        refModel: "HomeVisit",
        refId: visit._id,
      });
    }

    res.status(200).json({ message: `Home visit marked as ${result}`, visit });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Cancel ────────────────────────────────────────────────────────────
// PUT /api/home-visits/:id/cancel  { cancelReason }
const cancelHomeVisit = async (req, res) => {
  try {
    const visit = await HomeVisit.findById(req.params.id)
      .populate("applicant", "displayName email");
    if (!visit) return res.status(404).json({ message: "Home visit not found" });
    if (["completed", "cancelled"].includes(visit.status)) {
      return res.status(400).json({ message: `Home visit is already ${visit.status}` });
    }

    visit.status       = "cancelled";
    visit.cancelReason = req.body.cancelReason || "";
    await visit.save();

    await logAction({
      actor: req.user._id, action: "HOME_VISIT_CANCELLED",
      targetUser: visit.applicant._id,
      metadata: { visitId: visit._id, reason: visit.cancelReason },
    });

    await notify({
      recipient: visit.applicant._id,
      sender: req.user._id,
      type: "HOME_VISIT_CANCELLED",
      title: "Home visit cancelled",
      message: visit.cancelReason || "Your scheduled home visit was cancelled.",
      refModel: "HomeVisit",
      refId: visit._id,
    });

    res.status(200).json({ message: "Home visit cancelled", visit });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Mark no-show ──────────────────────────────────────────────────────
// PUT /api/home-visits/:id/no-show
const markNoShow = async (req, res) => {
  try {
    const visit = await HomeVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: "Home visit not found" });
    if (visit.status !== "scheduled" && visit.status !== "rescheduled") {
      return res.status(400).json({ message: "Only scheduled visits can be marked as no-show" });
    }
    visit.status = "no-show";
    await visit.save();

    await logAction({
      actor: req.user._id, action: "HOME_VISIT_NO_SHOW",
      targetUser: visit.applicant,
      metadata: { visitId: visit._id },
    });

    res.status(200).json({ message: "Home visit marked as no-show", visit });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  scheduleHomeVisit,
  getAllHomeVisits,
  getHomeVisitById,
  getMyHomeVisits,
  updateHomeVisit,
  completeHomeVisit,
  cancelHomeVisit,
  markNoShow,
};
