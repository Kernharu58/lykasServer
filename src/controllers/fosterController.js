const { Foster, FosterReport } = require("../models/Foster");
const Pet      = require("../models/Pet");
const AuditLog = require("../models/AuditLog");

const logAction = async ({ actor, action, targetUser, metadata }) => {
  try { await AuditLog.create({ actor, action, targetUser, metadata }); } catch (e) { /* silent */ }
};

// ═══════════════════════════════════════════════════════════
// FOSTER PLACEMENTS
// ═══════════════════════════════════════════════════════════

// ─── ADMIN: Start a foster placement ─────────────────────────────────────────
// POST /api/foster
// { petId, fostererId, startDate, expectedEndDate, applicationId, pickupNotes, fosterAgreementSigned }
const startFoster = async (req, res) => {
  try {
    const { petId, fostererId, startDate, expectedEndDate, applicationId, pickupNotes, fosterAgreementSigned } = req.body;

    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    // Prevent double-fostering the same pet
    const existing = await Foster.findOne({ pet: petId, status: "active" });
    if (existing) {
      return res.status(400).json({ message: `${pet.name} already has an active foster placement` });
    }

    const foster = await Foster.create({
      pet:         petId,
      fosterer:    fostererId,
      application: applicationId || null,
      startDate:   startDate || new Date(),
      expectedEndDate,
      pickupNotes,
      fosterAgreementSigned: fosterAgreementSigned || false,
      assignedBy:  req.user._id,
    });

    await logAction({
      actor: req.user._id,
      action: "FOSTER_STARTED",
      targetUser: fostererId,
      metadata: { fosterId: foster._id, petId, petName: pet.name },
    });

    res.status(201).json({ message: `Foster placement started for ${pet.name}`, foster });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: End / return a foster placement ───────────────────────────────────
// PUT /api/foster/:id/end  { returnNotes }
const endFoster = async (req, res) => {
  try {
    const foster = await Foster.findById(req.params.id).populate("pet", "name");
    if (!foster) return res.status(404).json({ message: "Foster placement not found" });
    if (foster.status !== "active") {
      return res.status(400).json({ message: "Foster placement is already ended" });
    }

    foster.status      = "completed";
    foster.endDate     = new Date();
    foster.endedBy     = req.user._id;
    foster.returnNotes = req.body.returnNotes || "";
    await foster.save();

    await logAction({
      actor: req.user._id,
      action: "FOSTER_ENDED",
      targetUser: foster.fosterer,
      metadata: { fosterId: foster._id, petId: foster.pet._id, petName: foster.pet.name },
    });

    res.status(200).json({ message: "Foster placement ended", foster });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Cancel a foster placement ────────────────────────────────────────
// PUT /api/foster/:id/cancel  { notes }
const cancelFoster = async (req, res) => {
  try {
    const foster = await Foster.findById(req.params.id);
    if (!foster) return res.status(404).json({ message: "Foster placement not found" });
    if (foster.status !== "active") {
      return res.status(400).json({ message: "Only active placements can be cancelled" });
    }

    foster.status  = "cancelled";
    foster.endDate = new Date();
    foster.endedBy = req.user._id;
    if (req.body.notes) foster.notes = req.body.notes;
    await foster.save();

    await logAction({
      actor: req.user._id, action: "FOSTER_CANCELLED",
      targetUser: foster.fosterer,
      metadata: { fosterId: foster._id, petId: foster.pet },
    });

    res.status(200).json({ message: "Foster placement cancelled", foster });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all foster placements ────────────────────────────────────────
// GET /api/foster?status=active&page=1&limit=20
const getAllFosters = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && ["active", "completed", "cancelled"].includes(status)) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [fosters, total] = await Promise.all([
      Foster.find(filter)
        .populate("pet",         "name species breed imageUrl status")
        .populate("fosterer",    "displayName email profilePicture")
        .populate("assignedBy",  "displayName email")
        .populate("endedBy",     "displayName email")
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Foster.countDocuments(filter),
    ]);

    res.status(200).json({
      fosters,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── SHARED: Get single foster placement ─────────────────────────────────────
// GET /api/foster/:id
const getFosterById = async (req, res) => {
  try {
    const foster = await Foster.findById(req.params.id)
      .populate("pet",         "name species breed imageUrl age gender description")
      .populate("fosterer",    "displayName email profilePicture")
      .populate("assignedBy",  "displayName email")
      .populate("application", "status createdAt");

    if (!foster) return res.status(404).json({ message: "Foster placement not found" });

    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = foster.fosterer._id.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this foster placement" });
    }

    res.status(200).json(foster);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get my foster placements ──────────────────────────────────────────
// GET /api/foster/my
const getMyFosters = async (req, res) => {
  try {
    const fosters = await Foster.find({ fosterer: req.user._id })
      .populate("pet", "name species breed imageUrl status")
      .sort({ startDate: -1 });
    res.status(200).json(fosters);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Update foster details ────────────────────────────────────────────
// PUT /api/foster/:id
// { expectedEndDate, fosterAgreementSigned, notes }
const updateFoster = async (req, res) => {
  try {
    const foster = await Foster.findById(req.params.id);
    if (!foster) return res.status(404).json({ message: "Foster placement not found" });
    if (foster.status !== "active") {
      return res.status(400).json({ message: "Can only update active placements" });
    }

    const { expectedEndDate, fosterAgreementSigned, notes, pickupNotes } = req.body;
    if (expectedEndDate       !== undefined) foster.expectedEndDate       = expectedEndDate;
    if (fosterAgreementSigned !== undefined) foster.fosterAgreementSigned = fosterAgreementSigned;
    if (notes                 !== undefined) foster.notes                 = notes;
    if (pickupNotes           !== undefined) foster.pickupNotes           = pickupNotes;

    await foster.save();
    res.status(200).json({ message: "Foster placement updated", foster });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// FOSTER REPORTS
// ═══════════════════════════════════════════════════════════

// ─── USER (fosterer): Submit weekly report ────────────────────────────────────
// POST /api/foster/:fosterId/reports
// { weekNumber, appetite, energy, behavior, healthConcerns, vetVisitRequired,
//   weightChange, overallProgress, photos, notes }
const submitFosterReport = async (req, res) => {
  try {
    const foster = await Foster.findById(req.params.fosterId).populate("pet", "name");
    if (!foster) return res.status(404).json({ message: "Foster placement not found" });

    // Only the fosterer or admin can submit
    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = foster.fosterer.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Only the fosterer can submit reports" });
    }

    if (foster.status !== "active") {
      return res.status(400).json({ message: "Can only submit reports for active placements" });
    }

    const { weekNumber, appetite, energy, behavior, healthConcerns,
            vetVisitRequired, weightChange, overallProgress, photos, notes } = req.body;

    // Prevent duplicate week reports
    const existing = await FosterReport.findOne({ foster: foster._id, weekNumber });
    if (existing) {
      return res.status(400).json({ message: `Week ${weekNumber} report already submitted` });
    }

    const report = await FosterReport.create({
      foster:     foster._id,
      pet:        foster.pet._id,
      fosterer:   req.user._id,
      weekNumber,
      appetite,
      energy,
      behavior,
      healthConcerns,
      vetVisitRequired: vetVisitRequired || false,
      weightChange,
      overallProgress,
      photos:     photos || [],
      notes,
    });

    res.status(201).json({ message: `Week ${weekNumber} report submitted`, report });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── SHARED: Get all reports for a foster placement ───────────────────────────
// GET /api/foster/:fosterId/reports
const getFosterReports = async (req, res) => {
  try {
    const foster = await Foster.findById(req.params.fosterId);
    if (!foster) return res.status(404).json({ message: "Foster placement not found" });

    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = foster.fosterer.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view these reports" });
    }

    const reports = await FosterReport.find({ foster: req.params.fosterId })
      .populate("fosterer",   "displayName email")
      .populate("reviewedBy", "displayName email")
      .sort({ weekNumber: 1 });

    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Review a foster report ───────────────────────────────────────────
// PUT /api/foster/reports/:reportId/review  { adminNotes }
const reviewFosterReport = async (req, res) => {
  try {
    const report = await FosterReport.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();
    report.adminNotes = req.body.adminNotes || "";
    await report.save();

    res.status(200).json({ message: "Report reviewed", report });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all unreviewed reports (for dashboard alert) ─────────────────
// GET /api/foster/reports/pending-review
const getPendingReviews = async (req, res) => {
  try {
    const reports = await FosterReport.find({ reviewedBy: null })
      .populate("pet",      "name species breed imageUrl")
      .populate("fosterer", "displayName email")
      .populate("foster",   "startDate status")
      .sort({ reportDate: -1 });
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  startFoster,
  endFoster,
  cancelFoster,
  getAllFosters,
  getFosterById,
  getMyFosters,
  updateFoster,
  submitFosterReport,
  getFosterReports,
  reviewFosterReport,
  getPendingReviews,
};
