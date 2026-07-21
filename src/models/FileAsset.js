const mongoose = require("mongoose");

const fileAssetSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, default: null }, // cloudinary public_id, for deletion
    category: {
      type: String,
      enum: ["adoption_document", "id_document", "medical_record", "image", "other"],
      default: "other",
      index: true,
    },
    relatedModel: { type: String, default: null }, // e.g. "Application", "Pet", "User"
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
    mimeType: { type: String, default: null },
    sizeBytes: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

fileAssetSchema.index({ relatedModel: 1, relatedId: 1 });

module.exports = mongoose.model("FileAsset", fileAssetSchema);
