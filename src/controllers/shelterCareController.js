const { HealthCheck, FeedingLog, BehavioralObs, CageAssignment, Quarantine } = require("../models/ShelterCare");
const AuditLog = require("../models/AuditLog");
const Pet = require("../models/Pet");

const logAction = async ({ actor, action, metadata }) => {
  try { await AuditLog.create({ actor, action, metadata }); } catch (e) { /* silent */ }
};

// ═══════════════════════════════════════════════════════════
// HEALTH CHECKS
// ═══════════════════════════════════════════════════════════

// POST /api/shelter-care/health-checks   { petId, weight, temperature, condition, notes, flagged }
const addHealthCheck = async (req, res) => {
  try {
    const { petId, weight, temperature, condition, notes, flagged, date } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    const check = await HealthCheck.create({
      pet: petId, checkedBy: req.user._id,
      date: date || new Date(), weight, temperature, condition, notes, flagged,
    });

    await logAction({ actor: req.user._id, action: "HEALTH_CHECK_ADDED",
      metadata: { petId, petName: pet.name, condition, flagged } });

    res.status(201).json({ message: "Health check recorded", check });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/shelter-care/health-checks/:petId?page=1&limit=20
const getHealthChecks = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [checks, total] = await Promise.all([
      HealthCheck.find({ pet: req.params.petId })
        .populate("checkedBy", "displayName email")
        .sort({ date: -1 }).skip(skip).limit(Number(limit)),
      HealthCheck.countDocuments({ pet: req.params.petId }),
    ]);
    res.status(200).json({ checks, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/shelter-care/health-checks/flagged  (all flagged, for admin dashboard)
const getFlaggedHealthChecks = async (req, res) => {
  try {
    const checks = await HealthCheck.find({ flagged: true })
      .populate("pet", "name species breed imageUrl")
      .populate("checkedBy", "displayName email")
      .sort({ date: -1 }).limit(50);
    res.status(200).json(checks);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// FEEDING LOGS
// ═══════════════════════════════════════════════════════════

// POST /api/shelter-care/feeding-logs  { petId, meal, foodType, amount, eaten, notes }
const addFeedingLog = async (req, res) => {
  try {
    const { petId, meal, foodType, amount, eaten, notes, date } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    const log = await FeedingLog.create({
      pet: petId, loggedBy: req.user._id,
      date: date || new Date(), meal, foodType, amount, eaten, notes,
    });

    res.status(201).json({ message: "Feeding logged", log });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/shelter-care/feeding-logs/:petId?page=1&limit=20
const getFeedingLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      FeedingLog.find({ pet: req.params.petId })
        .populate("loggedBy", "displayName email")
        .sort({ date: -1 }).skip(skip).limit(Number(limit)),
      FeedingLog.countDocuments({ pet: req.params.petId }),
    ]);
    res.status(200).json({ logs, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// BEHAVIORAL OBSERVATIONS
// ═══════════════════════════════════════════════════════════

// POST /api/shelter-care/behavioral-obs  { petId, mood, sociability, notes, flagged }
const addBehavioralObs = async (req, res) => {
  try {
    const { petId, mood, sociability, notes, flagged, date } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    const obs = await BehavioralObs.create({
      pet: petId, observedBy: req.user._id,
      date: date || new Date(), mood, sociability, notes, flagged,
    });

    res.status(201).json({ message: "Behavioral observation recorded", obs });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/shelter-care/behavioral-obs/:petId?page=1&limit=20
const getBehavioralObs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [observations, total] = await Promise.all([
      BehavioralObs.find({ pet: req.params.petId })
        .populate("observedBy", "displayName email")
        .sort({ date: -1 }).skip(skip).limit(Number(limit)),
      BehavioralObs.countDocuments({ pet: req.params.petId }),
    ]);
    res.status(200).json({ observations, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// CAGE ASSIGNMENTS
// ═══════════════════════════════════════════════════════════

// POST /api/shelter-care/cages  { petId, cageNumber, section, notes }
const assignCage = async (req, res) => {
  try {
    const { petId, cageNumber, section, notes } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    // Release any current active cage for this pet first
    await CageAssignment.updateMany(
      { pet: petId, isActive: true },
      { isActive: false, releasedAt: new Date() }
    );

    const assignment = await CageAssignment.create({
      pet: petId, cageNumber, section, assignedBy: req.user._id, notes,
    });

    await logAction({ actor: req.user._id, action: "CAGE_ASSIGNED",
      metadata: { petId, petName: pet.name, cageNumber } });

    res.status(201).json({ message: `${pet.name} assigned to cage ${cageNumber}`, assignment });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/shelter-care/cages/:petId  (history + current)
const getCageHistory = async (req, res) => {
  try {
    const assignments = await CageAssignment.find({ pet: req.params.petId })
      .populate("assignedBy", "displayName email")
      .sort({ assignedAt: -1 });
    res.status(200).json(assignments);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/shelter-care/cages  (all currently active assignments)
const getAllActiveCages = async (req, res) => {
  try {
    const assignments = await CageAssignment.find({ isActive: true })
      .populate("pet", "name species breed imageUrl status")
      .populate("assignedBy", "displayName email")
      .sort({ cageNumber: 1 });
    res.status(200).json(assignments);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// DELETE /api/shelter-care/cages/:assignmentId  (release / vacate cage)
const releaseCage = async (req, res) => {
  try {
    const assignment = await CageAssignment.findById(req.params.assignmentId);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    assignment.isActive   = false;
    assignment.releasedAt = new Date();
    await assignment.save();
    res.status(200).json({ message: "Cage released", assignment });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// QUARANTINE
// ═══════════════════════════════════════════════════════════

// POST /api/shelter-care/quarantine  { petId, startDate, reason, notes }
const startQuarantine = async (req, res) => {
  try {
    const { petId, startDate, reason, notes } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    const existing = await Quarantine.findOne({ pet: petId, isActive: true });
    if (existing) return res.status(400).json({ message: "Pet is already in quarantine" });

    const record = await Quarantine.create({
      pet: petId, startDate: startDate || new Date(), reason, notes, startedBy: req.user._id,
    });

    await logAction({ actor: req.user._id, action: "QUARANTINE_STARTED",
      metadata: { petId, petName: pet.name, reason } });

    res.status(201).json({ message: `${pet.name} placed in quarantine`, record });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// PUT /api/shelter-care/quarantine/:id/end  { notes }
const endQuarantine = async (req, res) => {
  try {
    const record = await Quarantine.findById(req.params.id).populate("pet", "name");
    if (!record) return res.status(404).json({ message: "Quarantine record not found" });
    if (!record.isActive) return res.status(400).json({ message: "Quarantine already ended" });

    record.isActive = false;
    record.endDate  = new Date();
    record.endedBy  = req.user._id;
    if (req.body.notes) record.notes = req.body.notes;
    await record.save();

    await logAction({ actor: req.user._id, action: "QUARANTINE_ENDED",
      metadata: { petId: record.pet._id, petName: record.pet.name } });

    res.status(200).json({ message: "Quarantine ended", record });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/shelter-care/quarantine/:petId  (history)
const getQuarantineHistory = async (req, res) => {
  try {
    const records = await Quarantine.find({ pet: req.params.petId })
      .populate("startedBy", "displayName email")
      .populate("endedBy",   "displayName email")
      .sort({ startDate: -1 });
    res.status(200).json(records);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/shelter-care/quarantine  (all currently active)
const getActiveQuarantines = async (req, res) => {
  try {
    const records = await Quarantine.find({ isActive: true })
      .populate("pet", "name species breed imageUrl")
      .populate("startedBy", "displayName email")
      .sort({ startDate: -1 });
    res.status(200).json(records);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// PET SUMMARY (all shelter care data in one call)
// ═══════════════════════════════════════════════════════════

// GET /api/shelter-care/summary/:petId
const getPetShelterSummary = async (req, res) => {
  try {
    const petId = req.params.petId;
    const [latestHealth, latestFeeding, latestBehavior, currentCage, activeQuarantine] = await Promise.all([
      HealthCheck.findOne({ pet: petId }).sort({ date: -1 }).populate("checkedBy", "displayName"),
      FeedingLog.findOne({ pet: petId }).sort({ date: -1 }).populate("loggedBy", "displayName"),
      BehavioralObs.findOne({ pet: petId }).sort({ date: -1 }).populate("observedBy", "displayName"),
      CageAssignment.findOne({ pet: petId, isActive: true }),
      Quarantine.findOne({ pet: petId, isActive: true }),
    ]);
    res.status(200).json({ latestHealth, latestFeeding, latestBehavior, currentCage, activeQuarantine });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

module.exports = {
  addHealthCheck, getHealthChecks, getFlaggedHealthChecks,
  addFeedingLog, getFeedingLogs,
  addBehavioralObs, getBehavioralObs,
  assignCage, getCageHistory, getAllActiveCages, releaseCage,
  startQuarantine, endQuarantine, getQuarantineHistory, getActiveQuarantines,
  getPetShelterSummary,
};
