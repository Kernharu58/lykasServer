const Volunteer = require("../models/Volunteer");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { logChange, getRecordHistory } = require("../utils/auditLogger");
const { buildListQuery, buildPagination } = require("../utils/queryBuilder");
const { sendCsv, sendExcel, sendPdf } = require("../utils/exportUtil");

// ─── Helper ──────────────────────────────────────────────────────────────────
const logAction = async ({ actor, action, targetUser, metadata }) => {
  try {
    if (!actor) return;
    await AuditLog.create({ actor, action, targetUser, metadata });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};

// ─── USER: Register as volunteer ─────────────────────────────────────────────
// POST /api/volunteers/register
const registerVolunteer = async (req, res) => {
  try {
    const existing = await Volunteer.findOne({ user: req.user._id });
    if (existing) {
      return res.status(400).json({
        message: `You already have a volunteer profile (status: ${existing.status})`,
      });
    }

    const { phone, address, motivation, availability, skills, emergencyContact } = req.body;

    const volunteer = await Volunteer.create({
      user: req.user._id,
      phone,
      address,
      motivation,
      availability: availability || [],
      skills: skills || [],
      emergencyContact,
    });

    await logAction({
      actor: req.user._id,
      action: "VOLUNTEER_REGISTERED",
      targetUser: req.user._id,
      metadata: { volunteerId: volunteer._id },
    });

    res.status(201).json({ message: "Volunteer application submitted!", volunteer });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get my volunteer profile ──────────────────────────────────────────
// GET /api/volunteers/me
const getMyVolunteerProfile = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOne({ user: req.user._id })
      .populate("user", "displayName email profilePicture volunteerHours")
      .populate("reviewedBy", "displayName email");

    if (!volunteer) {
      return res.status(404).json({ message: "No volunteer profile found. Please register first." });
    }

    res.status(200).json(volunteer);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Update my volunteer profile ───────────────────────────────────────
// PUT /api/volunteers/me
const updateMyVolunteerProfile = async (req, res) => {
  try {
    const volunteer = await Volunteer.findOne({ user: req.user._id });

    if (!volunteer) {
      return res.status(404).json({ message: "Volunteer profile not found" });
    }

    const { phone, address, motivation, availability, skills, emergencyContact } = req.body;

    if (phone !== undefined) volunteer.phone = phone;
    if (address !== undefined) volunteer.address = address;
    if (motivation !== undefined) volunteer.motivation = motivation;
    if (availability !== undefined) volunteer.availability = availability;
    if (skills !== undefined) volunteer.skills = skills;
    if (emergencyContact !== undefined) volunteer.emergencyContact = emergencyContact;

    await volunteer.save();
    res.status(200).json({ message: "Profile updated", volunteer });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all volunteers (search/sort/filter + pagination) ─────────────
// GET /api/volunteers?status=pending&q=juan&sortBy=createdAt&sortOrder=desc&page=1&limit=20
const getAllVolunteers = async (req, res) => {
  try {
    const { filter, sort, skip, limit, page } = buildListQuery(req.query, {
      filterFields: ["status"],
      softDelete: true,
    });

    const [volunteers, total] = await Promise.all([
      Volunteer.find(filter)
        .populate("user", "displayName email profilePicture volunteerHours createdAt")
        .populate("reviewedBy", "displayName email")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Volunteer.countDocuments(filter),
    ]);

    res.status(200).json({ volunteers, pagination: buildPagination(total, page, limit) });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get a single volunteer ───────────────────────────────────────────
// GET /api/volunteers/:id
const getVolunteerById = async (req, res) => {
  try {
    const volunteer = await Volunteer.findById(req.params.id)
      .populate("user", "displayName email profilePicture volunteerHours createdAt")
      .populate("reviewedBy", "displayName email");

    if (!volunteer) {
      return res.status(404).json({ message: "Volunteer not found" });
    }

    res.status(200).json(volunteer);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Approve or reject a volunteer ────────────────────────────────────
// PUT /api/volunteers/:id/status  { status: "approved" | "rejected" | "inactive", notes: "..." }
const updateVolunteerStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!["approved", "rejected", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved, rejected, or inactive" });
    }

    const volunteer = await Volunteer.findById(req.params.id).populate("user", "displayName email");
    if (!volunteer) {
      return res.status(404).json({ message: "Volunteer not found" });
    }

    volunteer.status = status;
    volunteer.reviewedBy = req.user._id;
    volunteer.reviewedAt = new Date();
    if (notes !== undefined) volunteer.notes = notes;

    await volunteer.save();

    await logAction({
      actor: req.user._id,
      action: `VOLUNTEER_${status.toUpperCase()}`,
      targetUser: volunteer.user._id,
      metadata: {
        volunteerId: volunteer._id,
        volunteerName: volunteer.user.displayName,
        notes,
      },
    });

    res.status(200).json({ message: `Volunteer ${status}`, volunteer });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Log volunteer hours ───────────────────────────────────────────────
// POST /api/volunteers/:id/hours  { hours: 3, note: "Morning dog walking" }
const logVolunteerHours = async (req, res) => {
  try {
    const { hours, note } = req.body;

    if (!hours || isNaN(hours) || Number(hours) <= 0) {
      return res.status(400).json({ message: "Please provide valid hours (must be > 0)" });
    }

    const volunteer = await Volunteer.findById(req.params.id).populate("user");
    if (!volunteer) {
      return res.status(404).json({ message: "Volunteer not found" });
    }

    if (volunteer.status !== "approved") {
      return res.status(400).json({ message: "Can only log hours for approved volunteers" });
    }

    // Update hours on both Volunteer and User models
    volunteer.totalHours += Number(hours);
    await volunteer.save();

    await User.findByIdAndUpdate(volunteer.user._id, {
      $inc: { volunteerHours: Number(hours) },
    });

    await logAction({
      actor: req.user._id,
      action: "VOLUNTEER_HOURS_LOGGED",
      targetUser: volunteer.user._id,
      metadata: {
        volunteerId: volunteer._id,
        hours: Number(hours),
        note,
        totalHours: volunteer.totalHours,
      },
    });

    res.status(200).json({
      message: `${hours} hour(s) logged successfully`,
      totalHours: volunteer.totalHours,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Soft-delete a volunteer profile ──────────────────────────────────
// DELETE /api/volunteers/:id
const deleteVolunteer = async (req, res) => {
  try {
    const volunteer = await Volunteer.findById(req.params.id);
    if (!volunteer) return res.status(404).json({ message: "Volunteer not found" });
    if (volunteer.isDeleted) return res.status(400).json({ message: "Already deleted" });

    volunteer.isDeleted = true;
    volunteer.deletedAt = new Date();
    volunteer.deletedBy = req.user._id;
    await volunteer.save();

    await logChange({
      actor: req.user._id,
      action: "VOLUNTEER_SOFT_DELETE",
      entityType: "Volunteer",
      entityId: volunteer._id,
      before: { isDeleted: false },
      after: { isDeleted: true },
      req,
      targetUser: volunteer.user,
    });

    res.status(200).json({ message: "Volunteer moved to Deleted (recoverable)." });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Restore a soft-deleted volunteer profile ─────────────────────────
// POST /api/volunteers/:id/restore
const restoreVolunteer = async (req, res) => {
  try {
    const volunteer = await Volunteer.findById(req.params.id);
    if (!volunteer) return res.status(404).json({ message: "Volunteer not found" });
    if (!volunteer.isDeleted) return res.status(400).json({ message: "Volunteer is not deleted" });

    volunteer.isDeleted = false;
    volunteer.deletedAt = null;
    volunteer.deletedBy = null;
    await volunteer.save();

    await logChange({
      actor: req.user._id,
      action: "VOLUNTEER_RESTORE",
      entityType: "Volunteer",
      entityId: volunteer._id,
      before: { isDeleted: true },
      after: { isDeleted: false },
      req,
    });

    res.status(200).json({ message: "Volunteer restored.", volunteer });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Bulk approve/reject/deactivate volunteers ────────────────────────
// POST /api/volunteers/bulk-status  { ids: [...], status: "approved"|"rejected"|"inactive" }
const bulkUpdateVolunteerStatus = async (req, res) => {
  try {
    const { ids, status, notes } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids must be a non-empty array" });
    }
    if (!["approved", "rejected", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved, rejected, or inactive" });
    }

    const result = await Volunteer.updateMany(
      { _id: { $in: ids } },
      { status, reviewedBy: req.user._id, reviewedAt: new Date(), ...(notes !== undefined ? { notes } : {}) },
    );

    await logChange({
      actor: req.user._id,
      action: "VOLUNTEER_BULK_STATUS",
      entityType: "Volunteer",
      entityId: null,
      after: { ids, status },
      req,
      metadata: { count: result.modifiedCount },
    });

    res.status(200).json({ message: `${result.modifiedCount} volunteer(s) updated to ${status}` });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Export volunteers as CSV/Excel/PDF ───────────────────────────────
// GET /api/volunteers/export?format=csv
const exportVolunteers = async (req, res) => {
  try {
    const { filter } = buildListQuery(req.query, { filterFields: ["status"], softDelete: true });
    const format = (req.query.format || "csv").toLowerCase();
    const volunteers = await Volunteer.find(filter).populate("user", "displayName email").sort("-createdAt");

    const rows = volunteers.map((v) => ({
      id: v._id.toString(),
      name: v.user?.displayName || "",
      email: v.user?.email || "",
      status: v.status,
      totalHours: v.totalHours,
      skills: (v.skills || []).join("; "),
      createdAt: v.createdAt?.toISOString(),
    }));

    if (format === "excel" || format === "xlsx") return sendExcel(res, "volunteers.xlsx", rows);
    if (format === "pdf") return sendPdf(res, "volunteers.pdf", "Volunteers Export", rows);
    return sendCsv(res, "volunteers.csv", rows);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Per-record audit history ─────────────────────────────────────────
// GET /api/volunteers/:id/history
const getVolunteerHistory = async (req, res) => {
  try {
    const history = await getRecordHistory("Volunteer", req.params.id, req.query);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  registerVolunteer,
  getMyVolunteerProfile,
  updateMyVolunteerProfile,
  getAllVolunteers,
  getVolunteerById,
  updateVolunteerStatus,
  logVolunteerHours,
  deleteVolunteer,
  restoreVolunteer,
  bulkUpdateVolunteerStatus,
  exportVolunteers,
  getVolunteerHistory,
};