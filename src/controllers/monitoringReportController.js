const MonitoringReport = require("../models/MonitoringReport");
const AuditLog         = require("../models/AuditLog");

const logAction = async ({ actor, action, targetUser, metadata }) => {
  try { await AuditLog.create({ actor, action, targetUser, metadata }); } catch (e) { /* silent */ }
};

// ─── USER: Submit a monitoring report ────────────────────────────────────────
// POST /api/monitoring-reports
const submitReport = async (req, res) => {
  try {
    const {
      petId, applicationId, reportMonth, petName, currentWeight, diet,
      exerciseRoutine, vetVisits, overallCondition, behaviorAtHome,
      issuesOrConcerns, additionalPets, photos, satisfactionRating, comments,
    } = req.body;

    const report = await MonitoringReport.create({
      submittedBy:      req.user._id,
      pet:              petId,
      application:      applicationId || null,
      reportMonth,
      petName,
      currentWeight,
      diet,
      exerciseRoutine,
      vetVisits,
      overallCondition,
      behaviorAtHome,
      issuesOrConcerns,
      additionalPets,
      photos:           photos || [],
      satisfactionRating,
      comments,
    });

    await logAction({
      actor: req.user._id, action: "MONITORING_REPORT_SUBMITTED",
      targetUser: req.user._id,
      metadata: { reportId: report._id, petId, reportMonth, overallCondition },
    });

    res.status(201).json({ message: "Monitoring report submitted successfully", report });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get my submitted reports ──────────────────────────────────────────
// GET /api/monitoring-reports/my
const getMyReports = async (req, res) => {
  try {
    const reports = await MonitoringReport.find({ submittedBy: req.user._id })
      .populate("pet",         "name species breed imageUrl")
      .populate("application", "status createdAt")
      .sort({ reportDate: -1 });
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get single report (own only) ──────────────────────────────────────
// GET /api/monitoring-reports/:id
const getReportById = async (req, res) => {
  try {
    const report = await MonitoringReport.findById(req.params.id)
      .populate("pet",         "name species breed imageUrl")
      .populate("submittedBy", "displayName email profilePicture")
      .populate("reviewedBy",  "displayName email")
      .populate("application", "status createdAt");

    if (!report) return res.status(404).json({ message: "Report not found" });

    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = report.submittedBy._id.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this report" });
    }

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all reports with filters ─────────────────────────────────────
// GET /api/monitoring-reports?status=pending&page=1&limit=20
const getAllReports = async (req, res) => {
  try {
    const { status, overallCondition, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && ["pending", "reviewed", "flagged"].includes(status)) filter.status = status;
    if (overallCondition && ["Excellent", "Good", "Fair", "Poor"].includes(overallCondition)) {
      filter.overallCondition = overallCondition;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [reports, total] = await Promise.all([
      MonitoringReport.find(filter)
        .populate("submittedBy", "displayName email profilePicture")
        .populate("pet",         "name species breed imageUrl")
        .populate("reviewedBy",  "displayName email")
        .sort({ reportDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      MonitoringReport.countDocuments(filter),
    ]);

    res.status(200).json({
      reports,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Review a report ───────────────────────────────────────────────────
// PUT /api/monitoring-reports/:id/review  { status: "reviewed"|"flagged", adminNotes }
const reviewReport = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    if (!["reviewed", "flagged"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'reviewed' or 'flagged'" });
    }

    const report = await MonitoringReport.findById(req.params.id)
      .populate("submittedBy", "displayName email");
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status     = status;
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    report.adminNotes = adminNotes || "";
    await report.save();

    await logAction({
      actor: req.user._id,
      action: status === "flagged" ? "MONITORING_REPORT_FLAGGED" : "MONITORING_REPORT_REVIEWED",
      targetUser: report.submittedBy._id,
      metadata: { reportId: report._id, status, adminNotes },
    });

    res.status(200).json({ message: `Report marked as ${status}`, report });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all flagged reports (dashboard alert) ────────────────────────
// GET /api/monitoring-reports/flagged
const getFlaggedReports = async (req, res) => {
  try {
    const reports = await MonitoringReport.find({ status: "flagged" })
      .populate("submittedBy", "displayName email profilePicture")
      .populate("pet",         "name species breed imageUrl")
      .sort({ reportDate: -1 });
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get reports by pet ────────────────────────────────────────────────
// GET /api/monitoring-reports/pet/:petId
const getReportsByPet = async (req, res) => {
  try {
    const reports = await MonitoringReport.find({ pet: req.params.petId })
      .populate("submittedBy", "displayName email")
      .populate("reviewedBy",  "displayName email")
      .sort({ reportMonth: 1 });
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  submitReport,
  getMyReports,
  getReportById,
  getAllReports,
  reviewReport,
  getFlaggedReports,
  getReportsByPet,
};
