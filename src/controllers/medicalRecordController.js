const { Vaccination, VetVisit, MedicalRecord } = require("../models/MedicalRecord");
const AuditLog = require("../models/AuditLog");
const Pet = require("../models/Pet");

const logAction = async ({ actor, action, metadata }) => {
  try { await AuditLog.create({ actor, action, metadata }); } catch (e) { /* silent */ }
};

// ═══════════════════════════════════════════════════════════
// VACCINATIONS
// ═══════════════════════════════════════════════════════════

// POST /api/medical/vaccinations  { petId, vaccineName, dateGiven, nextDueDate, administeredBy, batchNumber, notes }
const addVaccination = async (req, res) => {
  try {
    const { petId, vaccineName, dateGiven, nextDueDate, administeredBy, batchNumber, notes } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    const vaccination = await Vaccination.create({
      pet: petId, vaccineName, dateGiven, nextDueDate, administeredBy, batchNumber, notes,
      recordedBy: req.user._id,
    });

    await logAction({ actor: req.user._id, action: "VACCINATION_ADDED",
      metadata: { petId, petName: pet.name, vaccineName } });

    res.status(201).json({ message: "Vaccination recorded", vaccination });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/medical/vaccinations/:petId
const getVaccinations = async (req, res) => {
  try {
    const vaccinations = await Vaccination.find({ pet: req.params.petId })
      .populate("recordedBy", "displayName email")
      .sort({ dateGiven: -1 });
    res.status(200).json(vaccinations);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/medical/vaccinations/upcoming  (due within next 30 days)
const getUpcomingVaccinations = async (req, res) => {
  try {
    const today = new Date();
    const in30  = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const vaccinations = await Vaccination.find({ nextDueDate: { $gte: today, $lte: in30 } })
      .populate("pet", "name species breed imageUrl")
      .populate("recordedBy", "displayName email")
      .sort({ nextDueDate: 1 });
    res.status(200).json(vaccinations);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// PUT /api/medical/vaccinations/:id
const updateVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!vaccination) return res.status(404).json({ message: "Vaccination not found" });
    res.status(200).json({ message: "Vaccination updated", vaccination });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// DELETE /api/medical/vaccinations/:id
const deleteVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findByIdAndDelete(req.params.id);
    if (!vaccination) return res.status(404).json({ message: "Vaccination not found" });
    res.status(200).json({ message: "Vaccination record deleted" });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// VET VISITS
// ═══════════════════════════════════════════════════════════

// POST /api/medical/vet-visits  { petId, visitDate, reason, vetName, clinic, diagnosis, treatment, prescription, followUpDate, cost, notes }
const addVetVisit = async (req, res) => {
  try {
    const { petId, visitDate, reason, vetName, clinic, diagnosis, treatment, prescription, followUpDate, cost, notes } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    const visit = await VetVisit.create({
      pet: petId, visitDate, reason, vetName, clinic, diagnosis,
      treatment, prescription, followUpDate, cost, notes,
      recordedBy: req.user._id,
    });

    await logAction({ actor: req.user._id, action: "VET_VISIT_ADDED",
      metadata: { petId, petName: pet.name, reason } });

    res.status(201).json({ message: "Vet visit recorded", visit });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/medical/vet-visits/:petId
const getVetVisits = async (req, res) => {
  try {
    const visits = await VetVisit.find({ pet: req.params.petId })
      .populate("recordedBy", "displayName email")
      .sort({ visitDate: -1 });
    res.status(200).json(visits);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// PUT /api/medical/vet-visits/:id
const updateVetVisit = async (req, res) => {
  try {
    const visit = await VetVisit.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!visit) return res.status(404).json({ message: "Vet visit not found" });
    res.status(200).json({ message: "Vet visit updated", visit });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// DELETE /api/medical/vet-visits/:id
const deleteVetVisit = async (req, res) => {
  try {
    const visit = await VetVisit.findByIdAndDelete(req.params.id);
    if (!visit) return res.status(404).json({ message: "Vet visit not found" });
    res.status(200).json({ message: "Vet visit deleted" });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// GENERAL MEDICAL RECORDS
// ═══════════════════════════════════════════════════════════

// POST /api/medical/records  { petId, type, date, description, performedBy, outcome, followUpRequired, followUpDate, cost, notes }
const addMedicalRecord = async (req, res) => {
  try {
    const { petId, type, date, description, performedBy, outcome, followUpRequired, followUpDate, cost, notes } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    const record = await MedicalRecord.create({
      pet: petId, type, date, description, performedBy,
      outcome, followUpRequired, followUpDate, cost, notes,
      recordedBy: req.user._id,
    });

    await logAction({ actor: req.user._id, action: "MEDICAL_RECORD_ADDED",
      metadata: { petId, petName: pet.name, type } });

    res.status(201).json({ message: "Medical record added", record });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// GET /api/medical/records/:petId
const getMedicalRecords = async (req, res) => {
  try {
    const records = await MedicalRecord.find({ pet: req.params.petId })
      .populate("recordedBy", "displayName email")
      .sort({ date: -1 });
    res.status(200).json(records);
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// PUT /api/medical/records/:id
const updateMedicalRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ message: "Medical record not found" });
    res.status(200).json({ message: "Medical record updated", record });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// DELETE /api/medical/records/:id
const deleteMedicalRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: "Medical record not found" });
    res.status(200).json({ message: "Medical record deleted" });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

// ═══════════════════════════════════════════════════════════
// FULL PET MEDICAL SUMMARY (all in one call)
// ═══════════════════════════════════════════════════════════

// GET /api/medical/summary/:petId
const getPetMedicalSummary = async (req, res) => {
  try {
    const petId = req.params.petId;
    const [vaccinations, vetVisits, medicalRecords] = await Promise.all([
      Vaccination.find({ pet: petId }).sort({ dateGiven: -1 }),
      VetVisit.find({ pet: petId }).sort({ visitDate: -1 }),
      MedicalRecord.find({ pet: petId }).sort({ date: -1 }),
    ]);
    res.status(200).json({ vaccinations, vetVisits, medicalRecords });
  } catch (error) { res.status(500).json({ message: "Server Error", error: error.message }); }
};

module.exports = {
  addVaccination, getVaccinations, getUpcomingVaccinations, updateVaccination, deleteVaccination,
  addVetVisit, getVetVisits, updateVetVisit, deleteVetVisit,
  addMedicalRecord, getMedicalRecords, updateMedicalRecord, deleteMedicalRecord,
  getPetMedicalSummary,
};
