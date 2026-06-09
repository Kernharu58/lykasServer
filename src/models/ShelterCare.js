const mongoose = require("mongoose");

// ─── Health Check ─────────────────────────────────────────────────────────────
const healthCheckSchema = new mongoose.Schema(
  {
    pet:         { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    checkedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date:        { type: Date, required: true, default: Date.now },
    weight:      { type: String },                     // e.g. "4.2 kg"
    temperature: { type: String },                     // e.g. "38.5°C"
    condition: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Poor", "Critical"],
      required: true,
    },
    notes:       { type: String, trim: true },
    flagged:     { type: Boolean, default: false },    // needs vet attention
  },
  { timestamps: true }
);

// ─── Feeding Log ──────────────────────────────────────────────────────────────
const feedingLogSchema = new mongoose.Schema(
  {
    pet:       { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    loggedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date:      { type: Date, required: true, default: Date.now },
    meal:      { type: String, enum: ["Morning", "Afternoon", "Evening"], required: true },
    foodType:  { type: String, trim: true },           // e.g. "Dry kibble"
    amount:    { type: String, trim: true },           // e.g. "1 cup"
    eaten:     { type: String, enum: ["All", "Most", "Half", "Little", "None"], default: "All" },
    notes:     { type: String, trim: true },
  },
  { timestamps: true }
);

// ─── Behavioral Observation ───────────────────────────────────────────────────
const behavioralObsSchema = new mongoose.Schema(
  {
    pet:         { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true, index: true },
    observedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date:        { type: Date, required: true, default: Date.now },
    mood:        { type: String, enum: ["Happy", "Calm", "Anxious", "Aggressive", "Lethargic", "Playful"], required: true },
    sociability: { type: String, enum: ["Friendly", "Neutral", "Shy", "Aggressive"] },
    notes:       { type: String, trim: true },
    flagged:     { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ─── Cage / Housing Assignment ────────────────────────────────────────────────
const cageAssignmentSchema = new mongoose.Schema(
  {
    pet:          { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true },
    cageNumber:   { type: String, required: true, trim: true },  // e.g. "A-04"
    section:      { type: String, trim: true },                  // e.g. "Dog Wing"
    assignedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt:   { type: Date, default: Date.now },
    releasedAt:   { type: Date, default: null },
    isActive:     { type: Boolean, default: true, index: true },
    notes:        { type: String, trim: true },
  },
  { timestamps: true }
);

// ─── Quarantine Record ────────────────────────────────────────────────────────
const quarantineSchema = new mongoose.Schema(
  {
    pet:       { type: mongoose.Schema.Types.ObjectId, ref: "Pet", required: true },
    startDate: { type: Date, required: true },
    endDate:   { type: Date, default: null },
    reason:    { type: String, required: true, trim: true },
    isActive:  { type: Boolean, default: true, index: true },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    endedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes:     { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = {
  HealthCheck:         mongoose.model("HealthCheck", healthCheckSchema),
  FeedingLog:          mongoose.model("FeedingLog", feedingLogSchema),
  BehavioralObs:       mongoose.model("BehavioralObs", behavioralObsSchema),
  CageAssignment:      mongoose.model("CageAssignment", cageAssignmentSchema),
  Quarantine:          mongoose.model("Quarantine", quarantineSchema),
};
