const mongoose = require("mongoose");

const userDocumentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "government_id",
        "proof_of_address",
        "proof_of_income",
        "house_photo",
        "pet_owner_agreement",
        "other",
      ],
      required: true,
    },
    label:      { type: String, trim: true },       // e.g. "Passport", "Utility Bill"
    fileUrl:    { type: String, required: true },   // Cloudinary URL
    fileType:   { type: String, trim: true },       // "image/jpeg", "application/pdf"
    fileSize:   { type: Number, default: 0 },       // bytes
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    // Optional — only meaningful for ID-type documents (passport, gov't ID)
    // that carry their own expiry. Used by the "expired documents" reminder job.
    expiresAt: { type: Date, default: null },
    rejectedReason: { type: String, trim: true, default: "" },
    notes:      { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserDocument", userDocumentSchema);
