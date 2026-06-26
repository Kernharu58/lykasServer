const Interview    = require("../models/Interview");
const Application  = require("../models/Application");
const AuditLog     = require("../models/AuditLog");
const { notify } = require("../utils/notificationHelper");
const { autoRejectApplication } = require("./applicationController");

const logAction = async ({ actor, action, targetUser, metadata }) => {
  try { await AuditLog.create({ actor, action, targetUser, metadata }); } catch (e) { /* silent */ }
};

// ═══════════════════════════════════════════════════════════
// ADMIN: Schedule an interview
// ═══════════════════════════════════════════════════════════
// POST /api/interviews
// { applicationId, scheduledDate, method, location }
const scheduleInterview = async (req, res) => {
  try {
    const { applicationId, scheduledDate, method, location } = req.body;

    const application = await Application.findById(applicationId)
      .populate("applicant", "displayName email")
      .populate("pet", "name");

    if (!application) return res.status(404).json({ message: "Application not found" });
    if (application.status === "rejected") {
      return res.status(400).json({ message: "Cannot schedule interview for a rejected application" });
    }

    // Prevent duplicate scheduled interviews for the same application
    const existing = await Interview.findOne({ application: applicationId, status: "scheduled" });
    if (existing) {
      return res.status(400).json({ message: "An interview is already scheduled for this application" });
    }

    const interview = await Interview.create({
      application: applicationId,
      applicant:   application.applicant._id,
      pet:         application.pet._id,
      scheduledDate,
      method,
      location,
      conductedBy: req.user._id,
    });

    await logAction({
      actor: req.user._id,
      action: "INTERVIEW_SCHEDULED",
      targetUser: application.applicant._id,
      metadata: { interviewId: interview._id, applicationId, scheduledDate, method },
    });

    await notify({
      recipient: application.applicant._id,
      sender: req.user._id,
      type: "INTERVIEW_SCHEDULED",
      title: "Interview scheduled",
      message: `An interview for your application for ${application.pet.name} has been scheduled (${method}).`,
      refModel: "Interview",
      refId: interview._id,
    });

    res.status(201).json({ message: "Interview scheduled", interview });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// ADMIN: Get all interviews (with filters)
// ═══════════════════════════════════════════════════════════
// GET /api/interviews?status=scheduled&page=1&limit=20
const getAllInterviews = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && ["scheduled", "completed", "cancelled", "no-show"].includes(status)) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [interviews, total] = await Promise.all([
      Interview.find(filter)
        .populate("applicant",   "displayName email profilePicture")
        .populate("pet",         "name species breed imageUrl")
        .populate("application", "status createdAt")
        .populate("conductedBy", "displayName email")
        .sort({ scheduledDate: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Interview.countDocuments(filter),
    ]);

    res.status(200).json({
      interviews,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// SHARED: Get a single interview
// ═══════════════════════════════════════════════════════════
// GET /api/interviews/:id
const getInterviewById = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate("applicant",   "displayName email profilePicture")
      .populate("pet",         "name species breed imageUrl")
      .populate("application", "status phone address experience createdAt")
      .populate("conductedBy", "displayName email");

    if (!interview) return res.status(404).json({ message: "Interview not found" });

    // Users can only view their own interviews
    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = interview.applicant._id.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this interview" });
    }

    res.status(200).json(interview);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// USER: Get my interviews
// ═══════════════════════════════════════════════════════════
// GET /api/interviews/my
const getMyInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({ applicant: req.user._id })
      .populate("pet",         "name species breed imageUrl")
      .populate("application", "status createdAt")
      .populate("conductedBy", "displayName email")
      .sort({ scheduledDate: 1 });

    res.status(200).json(interviews);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// ADMIN: Update interview (reschedule or change details)
// ═══════════════════════════════════════════════════════════
// PUT /api/interviews/:id
// { scheduledDate, method, location, conductedBy }
const updateInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });

    if (interview.status === "completed") {
      return res.status(400).json({ message: "Cannot edit a completed interview" });
    }

    const { scheduledDate, method, location, conductedBy } = req.body;
    if (scheduledDate !== undefined) interview.scheduledDate = scheduledDate;
    if (method !== undefined)        interview.method        = method;
    if (location !== undefined)      interview.location      = location;
    if (conductedBy !== undefined)   interview.conductedBy   = conductedBy;

    await interview.save();

    await logAction({
      actor: req.user._id, action: "INTERVIEW_RESCHEDULED",
      targetUser: interview.applicant,
      metadata: { interviewId: interview._id, newDate: scheduledDate },
    });

    res.status(200).json({ message: "Interview updated", interview });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// ADMIN: Complete an interview & record result
// ═══════════════════════════════════════════════════════════
// PUT /api/interviews/:id/complete
// { result: "passed" | "failed", notes }
const completeInterview = async (req, res) => {
  try {
    const { result, notes } = req.body;

    if (!["passed", "failed"].includes(result)) {
      return res.status(400).json({ message: "Result must be 'passed' or 'failed'" });
    }

    const interview = await Interview.findById(req.params.id)
      .populate("applicant", "displayName email")
      .populate("pet", "name");
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.status === "completed") {
      return res.status(400).json({ message: "Interview is already completed" });
    }

    interview.status      = "completed";
    interview.result      = result;
    interview.notes       = notes || interview.notes;
    interview.completedAt = new Date();
    interview.conductedBy = req.user._id;
    await interview.save();

    await logAction({
      actor: req.user._id,
      action: result === "passed" ? "INTERVIEW_PASSED" : "INTERVIEW_FAILED",
      targetUser: interview.applicant._id,
      metadata: { interviewId: interview._id, applicationId: interview.application, result },
    });

    if (result === "failed") {
      // ── Single source of truth for status: a failed interview rejects the
      // application and frees the pet, instead of leaving it stuck "pending".
      await autoRejectApplication({
        applicationId: interview.application,
        actorId: req.user._id,
        reason: `Application rejected after interview (${notes || "no additional notes"}).`,
      });
    } else {
      await notify({
        recipient: interview.applicant._id,
        sender: req.user._id,
        type: "INTERVIEW_RESULT",
        title: "Interview passed",
        message: `Your interview for ${interview.pet?.name || "the pet"} passed. Staff will follow up about the home visit.`,
        refModel: "Interview",
        refId: interview._id,
      });
    }

    res.status(200).json({ message: `Interview marked as ${result}`, interview });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// ADMIN: Cancel an interview
// ═══════════════════════════════════════════════════════════
// PUT /api/interviews/:id/cancel  { cancelReason }
const cancelInterview = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate("applicant", "displayName email");
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (["completed", "cancelled"].includes(interview.status)) {
      return res.status(400).json({ message: `Interview is already ${interview.status}` });
    }

    interview.status       = "cancelled";
    interview.cancelReason = req.body.cancelReason || "";
    await interview.save();

    await logAction({
      actor: req.user._id, action: "INTERVIEW_CANCELLED",
      targetUser: interview.applicant._id,
      metadata: { interviewId: interview._id, reason: interview.cancelReason },
    });

    await notify({
      recipient: interview.applicant._id,
      sender: req.user._id,
      type: "INTERVIEW_CANCELLED",
      title: "Interview cancelled",
      message: interview.cancelReason || "Your scheduled interview was cancelled.",
      refModel: "Interview",
      refId: interview._id,
    });

    res.status(200).json({ message: "Interview cancelled", interview });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// ADMIN: Mark as no-show
// ═══════════════════════════════════════════════════════════
// PUT /api/interviews/:id/no-show
const markNoShow = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.status !== "scheduled") {
      return res.status(400).json({ message: "Only scheduled interviews can be marked as no-show" });
    }

    interview.status = "no-show";
    await interview.save();

    await logAction({
      actor: req.user._id, action: "INTERVIEW_NO_SHOW",
      targetUser: interview.applicant,
      metadata: { interviewId: interview._id },
    });

    res.status(200).json({ message: "Interview marked as no-show", interview });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

module.exports = {
  scheduleInterview,
  getAllInterviews,
  getInterviewById,
  getMyInterviews,
  updateInterview,
  completeInterview,
  cancelInterview,
  markNoShow,
};
