const RiskAssessment = require("../models/RiskAssessment");
const Application    = require("../models/Application");
const AuditLog       = require("../models/AuditLog");

const logAction = async ({ actor, action, targetUser, metadata }) => {
  try { await AuditLog.create({ actor, action, targetUser, metadata }); } catch (e) { /* silent */ }
};

// ─── ADMIN: Create / submit a risk assessment ─────────────────────────────────
// POST /api/risk-assessments
// { applicationId, scores: { housingStability, financialReadiness, petExperience,
//                             lifestyleMatch, familyCommitment, knowledgeOfPet },
//   notes, redFlags, recommendation }
const createRiskAssessment = async (req, res) => {
  try {
    const { applicationId, scores, notes, redFlags, recommendation } = req.body;

    const application = await Application.findById(applicationId)
      .populate("applicant", "displayName email")
      .populate("pet", "name");

    if (!application) return res.status(404).json({ message: "Application not found" });

    // One assessment per application — prevent duplicates
    const existing = await RiskAssessment.findOne({ application: applicationId });
    if (existing) {
      return res.status(400).json({
        message: "A risk assessment already exists for this application. Use PUT to update it.",
        existingId: existing._id,
      });
    }

    const assessment = await RiskAssessment.create({
      application: applicationId,
      applicant:   application.applicant._id,
      pet:         application.pet._id,
      assessedBy:  req.user._id,
      scores,
      notes,
      redFlags:    redFlags || [],
      recommendation,
    });

    await logAction({
      actor: req.user._id,
      action: "RISK_ASSESSMENT_CREATED",
      targetUser: application.applicant._id,
      metadata: {
        assessmentId:  assessment._id,
        applicationId,
        riskLevel:     assessment.riskLevel,
        totalScore:    assessment.totalScore,
        recommendation,
      },
    });

    res.status(201).json({ message: "Risk assessment submitted", assessment });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Update an existing assessment ────────────────────────────────────
// PUT /api/risk-assessments/:id
const updateRiskAssessment = async (req, res) => {
  try {
    const { scores, notes, redFlags, recommendation } = req.body;

    const assessment = await RiskAssessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Risk assessment not found" });

    if (scores        !== undefined) assessment.scores        = scores;
    if (notes         !== undefined) assessment.notes         = notes;
    if (redFlags      !== undefined) assessment.redFlags      = redFlags;
    if (recommendation !== undefined) assessment.recommendation = recommendation;
    assessment.assessedBy = req.user._id; // track who last updated

    await assessment.save(); // pre-save hook will recalculate score & riskLevel

    await logAction({
      actor: req.user._id,
      action: "RISK_ASSESSMENT_UPDATED",
      targetUser: assessment.applicant,
      metadata: {
        assessmentId: assessment._id,
        riskLevel:    assessment.riskLevel,
        totalScore:   assessment.totalScore,
      },
    });

    res.status(200).json({ message: "Risk assessment updated", assessment });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all risk assessments ─────────────────────────────────────────
// GET /api/risk-assessments?riskLevel=High&page=1&limit=20
const getAllRiskAssessments = async (req, res) => {
  try {
    const { riskLevel, recommendation, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (riskLevel && ["Low", "Medium", "High"].includes(riskLevel)) filter.riskLevel = riskLevel;
    if (recommendation && ["Approve", "Reject", "Further Review"].includes(recommendation)) {
      filter.recommendation = recommendation;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [assessments, total] = await Promise.all([
      RiskAssessment.find(filter)
        .populate("applicant",   "displayName email profilePicture")
        .populate("pet",         "name species breed imageUrl")
        .populate("application", "status createdAt")
        .populate("assessedBy",  "displayName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      RiskAssessment.countDocuments(filter),
    ]);

    res.status(200).json({
      assessments,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── SHARED: Get by application ───────────────────────────────────────────────
// GET /api/risk-assessments/application/:applicationId
const getByApplication = async (req, res) => {
  try {
    const assessment = await RiskAssessment.findOne({ application: req.params.applicationId })
      .populate("applicant",   "displayName email profilePicture")
      .populate("pet",         "name species breed imageUrl")
      .populate("assessedBy",  "displayName email");

    if (!assessment) {
      return res.status(404).json({ message: "No risk assessment found for this application" });
    }

    // Users can only view their own assessment
    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = assessment.applicant._id.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this assessment" });
    }

    res.status(200).json(assessment);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── SHARED: Get single assessment by ID ─────────────────────────────────────
// GET /api/risk-assessments/:id
const getRiskAssessmentById = async (req, res) => {
  try {
    const assessment = await RiskAssessment.findById(req.params.id)
      .populate("applicant",   "displayName email profilePicture")
      .populate("pet",         "name species breed imageUrl")
      .populate("application", "status phone address experience createdAt")
      .populate("assessedBy",  "displayName email");

    if (!assessment) return res.status(404).json({ message: "Risk assessment not found" });

    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = assessment.applicant._id.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this assessment" });
    }

    res.status(200).json(assessment);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  createRiskAssessment,
  updateRiskAssessment,
  getAllRiskAssessments,
  getByApplication,
  getRiskAssessmentById,
};
