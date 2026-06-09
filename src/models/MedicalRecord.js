const mongoose = require("mongoose");

// ─── Vaccination ──────────────────────────────────────────────────────────────
const vaccinationSchema = new mongoose.Schema(
  {
    pet:          { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    vaccineName:  { type: String, required: true, trim: true },   // e.g. "Rabies"
    dateGiven:    { type: Date, required: true },
    nextDueDate:  { type: Date, default: null },
    administeredBy: { type: String, trim: true },                 // vet name / clinic
    batchNumber:  { type: String, trim: true },
    notes:        { type: String, trim: true },
    recordedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// ─── Vet Visit ────────────────────────────────────────────────────────────────
const vetVisitSchema = new mongoose.Schema(
  {
    pet:        { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    visitDate:  { type: Date, required: true },
    reason:     { type: String, required: true, trim: true },     // e.g. "Annual check-up"
    vetName:    { type: String, trim: true },
    clinic:     { type: String, trim: true },
    diagnosis:  { type: String, trim: true },
    treatment:  { type: String, trim: true },
    prescription: { type: String, trim: true },
    followUpDate: { type: Date, default: null },
    cost:       { type: Number, default: 0 },
    notes:      { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// ─── General Medical Record (procedures, surgeries, deworming, etc.) ──────────
const medicalRecordSchema = new mongoose.Schema(
  {
    pet:        { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    type: {
      type: String,
      enum: ["Surgery", "Deworming", "Flea Treatment", "Dental", "Spay/Neuter", "Injury", "Illness", "Other"],
      required: true,
    },
    date:       { type: Date, required: true },
    description:{ type: String, required: true, trim: true },
    performedBy:{ type: String, trim: true },                     // vet/staff name
    outcome:    { type: String, trim: true },
    followUpRequired: { type: Boolean, default: false },
    followUpDate:     { type: Date, default: null },
    cost:       { type: Number, default: 0 },
    notes:      { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

module.exports = {
  Vaccination:   mongoose.model("Vaccination",   vaccinationSchema),
  VetVisit:      mongoose.model("VetVisit",      vetVisitSchema),
  MedicalRecord: mongoose.model("MedicalRecord", medicalRecordSchema),
};
