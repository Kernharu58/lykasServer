const mongoose = require("mongoose");

const homeVisitSchema = new mongoose.Schema(
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
    scheduledDate: { type: Date, required: true },
    address:       { type: String, required: true, trim: true },

    // Who will conduct the visit
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",         // staff or approved volunteer
      default: null,
    },

    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "rescheduled", "no-show"],
      default: "scheduled",
      index: true,
    },

    // Filled in after the visit is completed
    report: {
      livingSpace:    { type: String, trim: true },   // description of home environment
      safetyCheck:    { type: String, enum: ["Pass", "Fail", "Needs Improvement"], default: null },
      yardOrOutdoor:  { type: String, trim: true },
      otherPets:      { type: String, trim: true },   // existing pets in home
      householdMembers: { type: String, trim: true },
      overallImpression: { type: String, trim: true },
      recommendation: {
        type: String,
        enum: ["Approve", "Reject", "Needs Follow-up"],
        default: null,
      },
      photos: [{ type: String }],                     // Cloudinary URLs
    },

    result: {
      type: String,
      enum: ["passed", "failed", "pending"],
      default: "pending",
    },

    notes:        { type: String, trim: true },
    cancelReason: { type: String, trim: true },
    completedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HomeVisit", homeVisitSchema);
