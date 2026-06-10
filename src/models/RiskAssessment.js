const mongoose = require("mongoose");

const riskAssessmentSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      index: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    assessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Scoring criteria (each 1–5, higher = lower risk) ──────────────────────
    scores: {
      housingStability:    { type: Number, min: 1, max: 5, required: true }, // owns/stable rental
      financialReadiness:  { type: Number, min: 1, max: 5, required: true }, // income / vet funds
      petExperience:       { type: Number, min: 1, max: 5, required: true }, // prior ownership
      lifestyleMatch:      { type: Number, min: 1, max: 5, required: true }, // activity level fit
      familyCommitment:    { type: Number, min: 1, max: 5, required: true }, // all members on board
      knowledgeOfPet:      { type: Number, min: 1, max: 5, required: true }, // species/breed needs
    },

    // Auto-computed on save
    totalScore:  { type: Number, default: 0 },   // sum of scores (6–30)
    riskLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "High",
    },

    // Qualitative
    notes:      { type: String, trim: true },
    redFlags:   [{ type: String, trim: true }],  // specific concerns flagged

    recommendation: {
      type: String,
      enum: ["Approve", "Reject", "Further Review"],
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-calculate totalScore and riskLevel before saving
riskAssessmentSchema.pre("save", function (next) {
  const s = this.scores;
  this.totalScore =
    (s.housingStability   || 0) +
    (s.financialReadiness || 0) +
    (s.petExperience      || 0) +
    (s.lifestyleMatch     || 0) +
    (s.familyCommitment   || 0) +
    (s.knowledgeOfPet     || 0);

  // 24–30 = Low risk, 15–23 = Medium, 6–14 = High
  if (this.totalScore >= 24)      this.riskLevel = "Low";
  else if (this.totalScore >= 15) this.riskLevel = "Medium";
  else                            this.riskLevel = "High";

  next();
});

module.exports = mongoose.model("RiskAssessment", riskAssessmentSchema);