const Feedback = require("../models/Feedback");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { notify, notifyMany } = require("../utils/notificationHelper");

const logAction = async ({ actor, action, metadata }) => {
  try {
    await AuditLog.create({ actor, action, metadata });
  } catch (e) {
    /* silent */
  }
};

// ─── USER: Submit feedback/review ──────────────────────────────────────────────
// POST /api/feedback
// { type, rating, subject, message, relatedPet, isPublic }
const submitFeedback = async (req, res) => {
  try {
    const { type, rating, subject, message, relatedPet, isPublic } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ message: "Subject and message are required" });
    }

    const feedback = await Feedback.create({
      submittedBy: req.user._id,
      type: type || "general",
      rating: rating || null,
      subject,
      message,
      relatedPet: relatedPet || null,
      isPublic: !!isPublic,
    });

    const admins = await User.find({ role: { $in: ["admin", "staff", "super_admin"] } }, "_id");
    await notifyMany(admins.map((a) => a._id), {
      sender: req.user._id,
      type: "GENERAL",
      title: type === "complaint" ? "New complaint submitted" : "New feedback received",
      message: `${req.user.displayName} submitted: "${subject}"`,
    });

    await logAction({ actor: req.user._id, action: "FEEDBACK_SUBMITTED", metadata: { feedbackId: feedback._id, type } });
    res.status(201).json({ message: "Thank you for your feedback!", feedback });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get my submitted feedback ───────────────────────────────────────────
// GET /api/feedback/my
const getMyFeedback = async (req, res) => {
  try {
    const items = await Feedback.find({ submittedBy: req.user._id })
      .populate("relatedPet", "name imageUrl")
      .sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── PUBLIC: Get featured public reviews (e.g. success stories) ───────────────
// GET /api/feedback/public
const getPublicFeedback = async (req, res) => {
  try {
    const items = await Feedback.find({ isPublic: true, type: "review" })
      .populate("submittedBy", "displayName profilePicture")
      .populate("relatedPet", "name imageUrl")
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(50);
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all feedback ────────────────────────────────────────────────────
// GET /api/feedback?type=complaint&status=new&page=1&limit=20
const getAllFeedback = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Feedback.find(filter)
        .populate("submittedBy", "displayName email profilePicture")
        .populate("relatedPet", "name imageUrl")
        .populate("respondedBy", "displayName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Feedback.countDocuments(filter),
    ]);

    res.status(200).json({
      items,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get single feedback ─────────────────────────────────────────────────
// GET /api/feedback/:id
const getFeedbackById = async (req, res) => {
  try {
    const item = await Feedback.findById(req.params.id)
      .populate("submittedBy", "displayName email profilePicture")
      .populate("relatedPet", "name imageUrl")
      .populate("respondedBy", "displayName");
    if (!item) return res.status(404).json({ message: "Feedback not found" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Respond / update status / feature ──────────────────────────────────
// PUT /api/feedback/:id
// { status, adminResponse, isFeatured }
const updateFeedback = async (req, res) => {
  try {
    const item = await Feedback.findById(req.params.id).populate("submittedBy", "displayName");
    if (!item) return res.status(404).json({ message: "Feedback not found" });

    const { status, adminResponse, isFeatured } = req.body;
    if (status !== undefined) item.status = status;
    if (isFeatured !== undefined) item.isFeatured = isFeatured;

    if (adminResponse !== undefined && adminResponse.trim()) {
      item.adminResponse = adminResponse;
      item.respondedBy = req.user._id;
      item.respondedAt = new Date();
      if (item.status === "new") item.status = "responded";

      await notify({
        recipient: item.submittedBy._id,
        sender: req.user._id,
        type: "GENERAL",
        title: "Reply to your feedback",
        message: `The shelter responded to your feedback "${item.subject}".`,
      });
    }

    await item.save();
    await logAction({ actor: req.user._id, action: "FEEDBACK_UPDATED", metadata: { feedbackId: item._id, status } });
    res.status(200).json({ message: "Feedback updated", item });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Delete feedback ──────────────────────────────────────────────────────
// DELETE /api/feedback/:id
const deleteFeedback = async (req, res) => {
  try {
    const item = await Feedback.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Feedback not found" });

    await logAction({ actor: req.user._id, action: "FEEDBACK_DELETED", metadata: { feedbackId: item._id } });
    res.status(200).json({ message: "Feedback deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  submitFeedback,
  getMyFeedback,
  getPublicFeedback,
  getAllFeedback,
  getFeedbackById,
  updateFeedback,
  deleteFeedback,
};
