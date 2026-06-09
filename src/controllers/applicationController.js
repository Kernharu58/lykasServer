const Application = require("../models/Application");
const AuditLog = require("../models/AuditLog");

// ─── Helper ──────────────────────────────────────────────────────────────────
const logAction = async ({ actor, action, targetUser, metadata }) => {
  try {
    if (!actor) return;
    await AuditLog.create({ actor, action, targetUser, metadata });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};

// ─── USER: Get my applications ────────────────────────────────────────────────
// GET /api/applications/my
const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ applicant: req.user._id })
      .populate("pet", "name species breed imageUrl status")
      .sort({ createdAt: -1 });

    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get single application detail ─────────────────────────────────────
// GET /api/applications/:id
const getApplicationById = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate("pet", "name species breed imageUrl status age gender")
      .populate("applicant", "displayName email profilePicture")
      .populate("reviewedBy", "displayName email");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Users can only view their own applications; admins can view all
    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const isOwner = application.applicant._id.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this application" });
    }

    res.status(200).json(application);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Cancel / withdraw a pending application ───────────────────────────
// DELETE /api/applications/:id
const cancelApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).populate("pet");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.applicant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to cancel this application" });
    }

    if (application.status !== "pending") {
      return res.status(400).json({
        message: `Cannot cancel an application that is already ${application.status}`,
      });
    }

    // Reset pet back to Available if this was the only pending application
    const Pet = require("../models/Pet");
    const pet = await Pet.findById(application.pet._id);
    if (pet) {
      const otherPending = await Application.countDocuments({
        pet: pet._id,
        _id: { $ne: application._id },
        status: "pending",
      });
      if (otherPending === 0) {
        pet.status = "Available";
        pet.owner = null;
        await pet.save();
      }
    }

    await application.deleteOne();

    await logAction({
      actor: req.user._id,
      action: "APPLICATION_CANCELLED",
      targetUser: req.user._id,
      metadata: {
        applicationId: application._id,
        petId: application.pet._id,
        petName: application.pet?.name,
      },
    });

    res.status(200).json({ message: "Application cancelled successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all applications (with optional status filter) ────────────────
// GET /api/applications?status=pending&page=1&limit=20
const getAllApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate("applicant", "displayName email profilePicture")
        .populate("pet", "name species breed imageUrl status")
        .populate("reviewedBy", "displayName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Application.countDocuments(filter),
    ]);

    res.status(200).json({
      applications,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Update application status ────────────────────────────────────────
// PUT /api/applications/:id/status  { status: "approved" | "rejected" }
// NOTE: The pet-level approve/reject also lives in petController for backward
// compat with the admin panel. This endpoint does the same but lives under
// /api/applications so the mobile app can use it cleanly.
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
    }

    const application = await Application.findById(req.params.id)
      .populate("pet")
      .populate("applicant", "displayName email");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const Pet = require("../models/Pet");
    const pet = await Pet.findById(application.pet._id);

    application.status = status;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();

    if (status === "approved") {
      pet.status = "Adopted";
      pet.owner = application.applicant._id;
      // Auto-reject all other pending applications for this pet
      await Application.updateMany(
        { pet: pet._id, _id: { $ne: application._id }, status: "pending" },
        { status: "rejected", reviewedBy: req.user._id, reviewedAt: new Date() }
      );
    } else {
      // Only reset pet if no other pending applications remain
      const otherPending = await Application.countDocuments({
        pet: pet._id,
        _id: { $ne: application._id },
        status: "pending",
      });
      if (otherPending === 0) {
        pet.status = "Available";
        pet.owner = null;
      }
    }

    await application.save();
    await pet.save();

    await logAction({
      actor: req.user._id,
      action: status === "approved" ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
      targetUser: application.applicant._id,
      metadata: {
        applicationId: application._id,
        petId: pet._id,
        petName: pet.name,
        reviewedBy: req.user.displayName,
      },
    });

    res.status(200).json({ message: `Application ${status}`, application });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  getMyApplications,
  getApplicationById,
  cancelApplication,
  getAllApplications,
  updateApplicationStatus,
};