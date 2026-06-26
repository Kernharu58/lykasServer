const { Foster, FosterReport, MIN_FOSTER_TRIAL_DAYS, MAX_FOSTER_TRIAL_DAYS } = require("../models/Foster");
const Pet      = require("../models/Pet");
const AuditLog = require("../models/AuditLog");

const logAction = async ({ actor, action, targetUser, metadata }) => {
  try { await AuditLog.create({ actor, action, targetUser, metadata }); } catch (e) { /* silent */ }
};

// ═══════════════════════════════════════════════════════════
// FOSTER PLACEMENTS
// ═══════════════════════════════════════════════════════════

// ─── ADMIN: Start a foster placement (trial) ──────────────────────────────────
// POST /api/foster
// { petId, fostererId, startDate, expectedEndDate, trialDurationDays,
//   applicationId, pickupNotes, fosterAgreementSigned }
const startFoster = async (req, res) => {
  try {
    const {
      petId, fostererId, startDate, expectedEndDate, applicationId,
      pickupNotes, fosterAgreementSigned,
      trialDurationDays,   // NEW: explicit trial duration (30–60 days)
    } = req.body;

    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    // Prevent double-fostering the same pet
    const existing = await Foster.findOne({ pet: petId, status: "active" });
    if (existing) {
      return res.status(400).json({ message: `${pet.name} already has an active foster placement` });
    }

    // ── Pseudocode §1: Enforce 30–60 day trial window ────────────────────────
    const days = trialDurationDays ? Number(trialDurationDays) : null;
    if (days !== null) {
      if (days < MIN_FOSTER_TRIAL_DAYS) {
        return res.status(400).json({ message: `Trial must be at least ${MIN_FOSTER_TRIAL_DAYS} days` });
      }
      if (days > MAX_FOSTER_TRIAL_DAYS) {
        return res.status(400).json({ message: `Trial cannot exceed ${MAX_FOSTER_TRIAL_DAYS} days` });
      }
    }

    const start = startDate ? new Date(startDate) : new Date();
    const computedEndDate = days
      ? new Date(start.getTime() + days * 86400000)
      : (expectedEndDate ? new Date(expectedEndDate) : null);

    const weeksRequired = days ? Math.ceil(days / 7) : null;

    const foster = await Foster.create({
      pet:         petId,
      fosterer:    fostererId,
      application: applicationId || null,
      startDate:   start,
      expectedEndDate: computedEndDate,
      trialDurationDays:      days,
      weeklyReportsRequired:  weeksRequired,
      weeklyReportsSubmitted: 0,
      pickupNotes,
      fosterAgreementSigned: fosterAgreementSigned || false,
      assignedBy:  req.user._id,
    });

    await logAction({
      actor: req.user._id,
      action: "FOSTER_STARTED",
      targetUser: fostererId,
      metadata: { fosterId: foster._id, petId, petName: pet.name, trialDurationDays: days },
    });

    res.status(201).json({ message: `Foster placement started for ${pet.name}`, foster });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Check eligibility before finalizing adoption ─────────────────────
// GET /api/foster/:id/can-finalize
// Implements pseudocode §1: canFinalizeAdoption()
const canFinalizeAdoption = async (req, res) => {
  try {
    const foster = await Foster.findById(req.params.id);
    if (!foster) return res.status(404).json({ message: "Foster placement not found" });

    if (foster.status !== "active") {
      return res.status(200).json({ allowed: false, reason: "Trial is not active" });
    }

    // Check minimum trial period
    const minEnd = new Date(foster.startDate.getTime() + MIN_FOSTER_TRIAL_DAYS * 86400000);
    if (new Date() < minEnd) {
      const daysLeft = Math.ceil((minEnd - new Date()) / 86400000);
      return res.status(200).json({
        allowed: false,
        reason: `Minimum ${MIN_FOSTER_TRIAL_DAYS}-day trial period not yet met (${daysLeft} days remaining)`,
      });
    }

    // Check all weekly reports submitted
    if (foster.weeklyReportsRequired !== null) {
      const missing = foster.weeklyReportsRequired - foster.weeklyReportsSubmitted;
      if (missing > 0) {
        return res.status(200).json({
          allowed: false,
          reason: `${missing} weekly report(s) still missing`,
        });
      }
    }

    res.status(200).json({ allowed: true });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: End / return a foster placement ───────────────────────────────────
// PUT /api/foster/:id/end
// { returnNotes, outcome }   outcome = ADOPTED | RETURNED | EXTENDED
const endFoster = async (req, res) => {
  try {
    const foster = await Foster.findById(req.params.id).populate("pet", "name");
    if (!foster) return res.status(404).json({ message: "Foster placement not found" });
    if (foster.status !== "active") {
      return res.status(400).json({ message: "Foster placement is already ended" });
    }

    const outcome = req.body.outcome || "RETURNED";

    // ── Pseudocode §1: finalizeFosterTrial – gate on eligibility for ADOPTED
    if (outcome === "ADOPTED") {
      // Inline canFinalizeAdoption check
      const minEnd = new Date(foster.startDate.getTime() + MIN_FOSTER_TRIAL_DAYS * 86400000);
      if (new Date() < minEnd) {
        const daysLeft = Math.ceil((minEnd - new Date()) / 86400000);
        return res.status(400).json({
          message: `Cannot finalize adoption: minimum trial period not met (${daysLeft} days left)`,
        });
      }
      if (foster.weeklyReportsRequired !== null) {
        const missing = foster.weeklyReportsRequired - foster.weeklyReportsSubmitted;
        if (missing > 0) {
          return res.status(400).json({
            message: `Cannot finalize adoption: ${missing} weekly report(s) still missing`,
          });
        }
      }
    }

    // ── Handle EXTENDED outcome ──────────────────────────────────────────────
    if (outcome === "EXTENDED") {
      const EXTENSION_DAYS = 14;
      const currentEnd = foster.expectedEndDate || new Date();
      const newEnd = new Date(currentEnd.getTime() + EXTENSION_DAYS * 86400000);
      // Cap at MAX_FOSTER_TRIAL_DAYS from start
      const hardCap = new Date(foster.startDate.getTime() + MAX_FOSTER_TRIAL_DAYS * 86400000);
      foster.expectedEndDate = newEnd > hardCap ? hardCap : newEnd;
      if (foster.trialDurationDays) {
        foster.trialDurationDays = Math.min(
          foster.trialDurationDays + EXTENSION_DAYS,
          MAX_FOSTER_TRIAL_DAYS
        );
        foster.weeklyReportsRequired = Math.ceil(foster.trialDurationDays / 7);
      }
      foster.staffNotes = req.body.staffNotes || req.body.returnNotes || "";
      await foster.save();
      await logAction({
        actor: req.user._id, action: "FOSTER_EXTENDED",
        targetUser: foster.fosterer,
        metadata: { fosterId: foster._id, petId: foster.pet._id, petName: foster.pet.name, newEndDate: foster.expectedEndDate },
      });
      return res.status(200).json({ message: "Foster trial extended by 14 days", foster });
    }

    // ── ADOPTED or RETURNED ──────────────────────────────────────────────────
    foster.status      = "completed";
    foster.outcome     = outcome;
    foster.endDate     = new Date();
    foster.closedAt    = new Date();
    foster.endedBy     = req.user._id;
    foster.returnNotes = req.body.returnNotes || "";
    foster.staffNotes  = req.body.staffNotes  || "";
    await foster.save();

    await logAction({
      actor: req.user._id,
      action: outcome === "ADOPTED" ? "FOSTER_FINALIZED_ADOPTED" : "FOSTER_ENDED",
      targetUser: foster.fosterer,
      metadata: { fosterId: foster._id, petId: foster.pet._id, petName: foster.pet.name, outcome },
    });

    res.status(200).json({ message: `Foster placement ${outcome === "ADOPTED" ? "finalized (adopted)" : "ended"}`, foster });
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
// FOSTER REPORTS (pseudocode §2)
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

    // ── Pseudocode §2: increment weeklyReportsSubmitted ──────────────────────
    foster.weeklyReportsSubmitted = (foster.weeklyReportsSubmitted || 0) + 1;
    await foster.save();

    res.status(201).json({ message: `Week ${weekNumber} report submitted`, report });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── SHARED: Get missing weekly report numbers ────────────────────────────────
// GET /api/foster/:fosterId/reports/missing
// Implements pseudocode §2: getMissingWeeklyReports()
const getMissingWeeklyReports = async (req, res) => {
  try {
    const foster = await Foster.findById(req.params.fosterId);
    if (!foster) return res.status(404).json({ message: "Foster placement not found" });

    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = foster.fosterer.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return res.status(403).json({ message: "Not authorized" });

    const required = foster.weeklyReportsRequired || 0;
    const submitted = await FosterReport.find({ foster: foster._id }, "weekNumber");
    const submittedWeeks = new Set(submitted.map(r => r.weekNumber));

    const missing = [];
    for (let w = 1; w <= required; w++) {
      if (!submittedWeeks.has(w)) missing.push(w);
    }

    res.status(200).json({ missing, required, submitted: submittedWeeks.size });
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
  canFinalizeAdoption,
  submitFosterReport,
  getMissingWeeklyReports,
  getFosterReports,
  reviewFosterReport,
  getPendingReviews,
};
