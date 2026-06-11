const UserDocument = require("../models/UserDocument");
const AuditLog     = require("../models/AuditLog");
const { notify }   = require("../utils/notificationHelper");
const cloudinary   = require("../config/cloudinary");

const logAction = async ({ actor, action, targetUser, metadata }) => {
  try { await AuditLog.create({ actor, action, targetUser, metadata }); } catch (e) { /* silent */ }
};

// ─── USER: Upload a document ──────────────────────────────────────────────────
// POST /api/documents
// multipart/form-data: file + { type, label, applicationId }
const uploadDocument = async (req, res) => {
  try {
    const { type, label, applicationId } = req.body;

    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    if (!type)     return res.status(400).json({ message: "Document type is required" });

    // Upload to Cloudinary (raw for PDFs, auto for images)
    const resourceType = req.file.mimetype === "application/pdf" ? "raw" : "auto";
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `lykas/documents/${req.user._id}`, resource_type: resourceType },
        (err, result) => err ? reject(err) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    const doc = await UserDocument.create({
      user:        req.user._id,
      application: applicationId || null,
      type,
      label:       label || type.replace(/_/g, " "),
      fileUrl:     uploadResult.secure_url,
      fileType:    req.file.mimetype,
      fileSize:    req.file.size,
    });

    res.status(201).json({ message: "Document uploaded", document: doc });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get my documents ───────────────────────────────────────────────────
// GET /api/documents/my?type=government_id&applicationId=xxx
const getMyDocuments = async (req, res) => {
  try {
    const { type, applicationId } = req.query;
    const filter = { user: req.user._id };
    if (type)          filter.type        = type;
    if (applicationId) filter.application = applicationId;

    const documents = await UserDocument.find(filter)
      .populate("application", "status createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json(documents);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Delete own document (only if pending) ──────────────────────────────
// DELETE /api/documents/:id
const deleteDocument = async (req, res) => {
  try {
    const doc = await UserDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (doc.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (doc.status === "verified") {
      return res.status(400).json({ message: "Cannot delete a verified document" });
    }

    await doc.deleteOne();
    res.status(200).json({ message: "Document deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all documents (optionally by user or application) ─────────────
// GET /api/documents?userId=&applicationId=&status=pending&page=1&limit=20
const getAllDocuments = async (req, res) => {
  try {
    const { userId, applicationId, status, type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (userId)        filter.user        = userId;
    if (applicationId) filter.application = applicationId;
    if (status && ["pending","verified","rejected"].includes(status)) filter.status = status;
    if (type)          filter.type        = type;

    const skip = (Number(page) - 1) * Number(limit);
    const [documents, total] = await Promise.all([
      UserDocument.find(filter)
        .populate("user",        "displayName email profilePicture")
        .populate("application", "status createdAt")
        .populate("verifiedBy",  "displayName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      UserDocument.countDocuments(filter),
    ]);

    res.status(200).json({
      documents,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Verify or reject a document ──────────────────────────────────────
// PUT /api/documents/:id/verify  { status: "verified"|"rejected", rejectedReason }
const verifyDocument = async (req, res) => {
  try {
    const { status, rejectedReason } = req.body;
    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'verified' or 'rejected'" });
    }

    const doc = await UserDocument.findById(req.params.id)
      .populate("user", "displayName email");
    if (!doc) return res.status(404).json({ message: "Document not found" });

    doc.status         = status;
    doc.verifiedBy     = req.user._id;
    doc.verifiedAt     = new Date();
    if (rejectedReason) doc.rejectedReason = rejectedReason;
    await doc.save();

    await notify({
      recipient: doc.user._id,
      sender:    req.user._id,
      type:      "GENERAL",
      title:     status === "verified" ? "Document verified ✅" : "Document rejected",
      message:   status === "verified"
        ? `Your ${doc.label} has been verified successfully.`
        : `Your ${doc.label} was rejected. ${rejectedReason ? "Reason: " + rejectedReason : "Please re-upload."}`,
    });

    await logAction({
      actor: req.user._id, action: `DOCUMENT_${status.toUpperCase()}`,
      targetUser: doc.user._id,
      metadata: { documentId: doc._id, type: doc.type, rejectedReason },
    });

    res.status(200).json({ message: `Document ${status}`, document: doc });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { uploadDocument, getMyDocuments, deleteDocument, getAllDocuments, verifyDocument };
