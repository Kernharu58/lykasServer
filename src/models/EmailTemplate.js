const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, uppercase: true },
    label: { type: String, required: true },
    subject: { type: String, required: true },
    bodyHtml: { type: String, required: true },
    // Documents which {{placeholders}} the template supports, e.g. ["displayName","petName"]
    variables: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
