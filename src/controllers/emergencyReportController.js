const EmergencyReport = require("../models/EmergencyReport");
const AuditLog        = require("../models/AuditLog");
const { notify, notifyMany } = require("../utils/notificationHelper");
const User            = require("../models/User");
const cloudinary      = require("../config/cloudinary");

const logAction = async ({ actor, action, metadata }) => {
  try { await AuditLog.create({ actor, action, metadata }); } catch (e) { /* silent */ }
};

// ─── USER: Submit an emergency report ────────────────────────────────────────
// POST /api/emergency-reports
// { type, animalType, description, location, coordinates, contactName, contactPhone, photos }
const submitReport = async (req, res) => {
  try {
    const {
      type, animalType, description, location,
      coordinates, contactName, contactPhone, photos,
    } = req.body;

    const report = await EmergencyReport.create({
      submittedBy:  req.user._id,
      type,
      animalType,
      description,
      location,
      coordinates:  coordinates || { lat: null, lng: null },
      contactName:  contactName  || req.user.displayName,
      contactPhone: contactPhone || "",
      photos:       photos || [],
      // Auto-set priority based on type
      priority: type === "injured_animal" || type === "abuse_report" ? "high" : "medium",
    });

    // Notify all admins immediately
    const admins = await User.find({ role: { $in: ["admin", "super_admin", "staff"] } }, "_id");
    await notifyMany(admins.map(a => a._id), {
      sender:   req.user._id,
      type:     "GENERAL",
      title:    `🚨 Emergency Report — ${type.replace(/_/g, " ")}`,
      message:  `A new emergency report was submitted at "${location}". ${animalType ? "Animal: " + animalType + "." : ""} Please review immediately.`,
      refModel: null,
      refId:    null,
    });

    await logAction({
      actor: req.user._id, action: "EMERGENCY_REPORT_SUBMITTED",
      metadata: { reportId: report._id, type, location, priority: report.priority },
    });

    res.status(201).json({ message: "Emergency report submitted. Our team has been notified.", report });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get my submitted reports ──────────────────────────────────────────
// GET /api/emergency-reports/my
const getMyReports = async (req, res) => {
  try {
    const reports = await EmergencyReport.find({ submittedBy: req.user._id })
      .populate("assignedTo", "displayName email")
      .populate("linkedPet",  "name imageUrl")
      .sort({ createdAt: -1 });
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all reports ───────────────────────────────────────────────────
// GET /api/emergency-reports?status=open&priority=high&page=1&limit=20
const getAllReports = async (req, res) => {
  try {
    const { status, priority, type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status   && ["open","in_progress","resolved","dismissed"].includes(status))   filter.status   = status;
    if (priority && ["low","medium","high","critical"].includes(priority))             filter.priority = priority;
    if (type)    filter.type = type;

    const skip = (Number(page) - 1) * Number(limit);
    const [reports, total] = await Promise.all([
      EmergencyReport.find(filter)
        .populate("submittedBy", "displayName email profilePicture")
        .populate("assignedTo",  "displayName email")
        .populate("resolvedBy",  "displayName email")
        .populate("linkedPet",   "name imageUrl")
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      EmergencyReport.countDocuments(filter),
    ]);

    res.status(200).json({
      reports,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get single report ─────────────────────────────────────────────────
// GET /api/emergency-reports/:id
const getReportById = async (req, res) => {
  try {
    const report = await EmergencyReport.findById(req.params.id)
      .populate("submittedBy", "displayName email profilePicture")
      .populate("assignedTo",  "displayName email")
      .populate("resolvedBy",  "displayName email")
      .populate("linkedPet",   "name imageUrl species breed");

    if (!report) return res.status(404).json({ message: "Report not found" });

    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = report.submittedBy._id.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return res.status(403).json({ message: "Not authorized" });

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Update report (assign, change status, resolve) ───────────────────
// PUT /api/emergency-reports/:id
// { status, priority, assignedTo, resolutionNote, linkedPet }
const updateReport = async (req, res) => {
  try {
    const report = await EmergencyReport.findById(req.params.id)
      .populate("submittedBy", "displayName email");
    if (!report) return res.status(404).json({ message: "Report not found" });

    const { status, priority, assignedTo, resolutionNote, linkedPet } = req.body;

    const previousStatus = report.status;

    if (status     !== undefined) report.status     = status;
    if (priority   !== undefined) report.priority   = priority;
    if (assignedTo !== undefined) report.assignedTo = assignedTo;
    if (linkedPet  !== undefined) report.linkedPet  = linkedPet;

    if (status === "resolved" || status === "dismissed") {
      report.resolvedBy   = req.user._id;
      report.resolvedAt   = new Date();
      report.resolutionNote = resolutionNote || "";
    }

    await report.save();

    await logAction({
      actor: req.user._id, action: "EMERGENCY_REPORT_UPDATED",
      metadata: { reportId: report._id, status, priority },
    });

    // Let the reporter know their report was acted on — previously this
    // endpoint only logged the change and admins never heard back.
    if (
      report.submittedBy &&
      status !== undefined &&
      status !== previousStatus &&
      (status === "resolved" || status === "dismissed" || status === "in_progress")
    ) {
      const titleByStatus = {
        resolved:    "Your report has been resolved ✅",
        dismissed:   "Your report was reviewed",
        in_progress: "Your report is being investigated",
      };
      const messageByStatus = {
        resolved:    resolutionNote || "Thanks for the report — our team has resolved this.",
        dismissed:   resolutionNote || "Our team reviewed your report and closed it.",
        in_progress: "Our team has picked up your report and is looking into it.",
      };

      await notify({
        recipient: report.submittedBy._id,
        sender:    req.user._id,
        type:      "GENERAL",
        title:     titleByStatus[status],
        message:   messageByStatus[status],
        refModel:  "EmergencyReport",
        refId:     report._id,
      });
    }

    res.status(200).json({ message: "Report updated", report });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { submitReport, getMyReports, getAllReports, getReportById, updateReport };