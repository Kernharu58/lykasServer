const cloudinary = require("cloudinary").v2;
const FileAsset = require("../models/FileAsset");

// GET /api/files?category=&relatedModel=&relatedId=&search=&page=&limit=
const getFiles = async (req, res) => {
  try {
    const { category, relatedModel, relatedId, search, page = 1, limit = 20 } = req.query;
    const filter = { isDeleted: false };
    if (category) filter.category = category;
    if (relatedModel) filter.relatedModel = relatedModel;
    if (relatedId) filter.relatedId = relatedId;
    if (search) filter.fileName = { $regex: search, $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);
    const [files, total] = await Promise.all([
      FileAsset.find(filter).populate("uploadedBy", "displayName email").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      FileAsset.countDocuments(filter),
    ]);

    res.status(200).json({ files, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/files/storage-stats
const getStorageStats = async (_req, res) => {
  try {
    const byCategory = await FileAsset.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$category", count: { $sum: 1 }, totalBytes: { $sum: "$sizeBytes" } } },
      { $sort: { totalBytes: -1 } },
    ]);
    const totals = byCategory.reduce(
      (acc, c) => ({ count: acc.count + c.count, totalBytes: acc.totalBytes + c.totalBytes }),
      { count: 0, totalBytes: 0 },
    );
    res.status(200).json({ byCategory, totals });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/files  (multipart, field name "file") — register + upload a file to the central hub
const uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    const { category = "other", relatedModel = null, relatedId = null } = req.body;

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "lykas_file_hub", resource_type: "auto" },
        (error, result) => (error ? reject(error) : resolve(result)),
      );
      stream.end(req.file.buffer);
    });

    const asset = await FileAsset.create({
      fileName: req.file.originalname,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      category,
      relatedModel: relatedModel || null,
      relatedId: relatedId || null,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedBy: req.user._id,
    });

    res.status(201).json({ message: "File uploaded", file: asset });
  } catch (error) {
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
};

// DELETE /api/files/:id  (soft delete; keeps the Cloudinary asset unless ?hard=true)
const deleteFile = async (req, res) => {
  try {
    const file = await FileAsset.findById(req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });

    if (req.query.hard === "true") {
      if (file.publicId) {
        try {
          await cloudinary.uploader.destroy(file.publicId);
        } catch (e) {
          console.warn("Cloudinary destroy failed:", e.message);
        }
      }
      await file.deleteOne();
      return res.status(200).json({ message: "File permanently deleted" });
    }

    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();
    res.status(200).json({ message: "File moved to trash" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getFiles, getStorageStats, uploadFile, deleteFile };
