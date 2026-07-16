const Application = require("../models/Application");
const AuditLog = require("../models/AuditLog");
const Interview = require("../models/Interview");
const HomeVisit = require("../models/HomeVisit");
const { Foster } = require("../models/Foster");
const { notify } = require("../utils/notificationHelper");

// ─── Helper ──────────────────────────────────────────────────────────────────
const logAction = async ({ actor, action, targetUser, metadata }) => {
  try {
    if (!actor) return;
    await AuditLog.create({ actor, action, targetUser, metadata });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};

// ─── Helper: free up a pet if no other pending applications hold it ─────────
const releasePetIfUnclaimed = async (pet, excludeApplicationId) => {
  const otherPending = await Application.countDocuments({
    pet: pet._id,
    _id: { $ne: excludeApplicationId },
    status: "pending",
  });
  if (otherPending === 0) {
    pet.status = "Available";
    pet.owner = null;
  }
};

// ─── Helper: has this application cleared the staged vetting workflow? ──────
// CRITICAL FIX: previously `updateApplicationStatus` could approve an
// application straight from "pending" with no interview or home visit on
// record at all, letting staff bypass the vetting pipeline entirely (there
// was also no admin UI for interviews/home visits, compounding the gap).
// This checks that the most recent interview AND most recent home visit for
// the application both completed with a "passed" result before an approval
// is allowed to go through.
const getVettingGateStatus = async (applicationId) => {
  const [latestInterview, latestHomeVisit] = await Promise.all([
    Interview.findOne({ application: applicationId }).sort({ createdAt: -1 }),
    HomeVisit.findOne({ application: applicationId }).sort({ createdAt: -1 }),
  ]);

  const interviewPassed =
    !!latestInterview && latestInterview.status === "completed" && latestInterview.result === "passed";
  const homeVisitPassed =
    !!latestHomeVisit && latestHomeVisit.status === "completed" && latestHomeVisit.result === "passed";

  const missing = [];
  if (!interviewPassed) missing.push("a passed interview");
  if (!homeVisitPassed) missing.push("a passed home visit");

  return { cleared: missing.length === 0, missing };
};

// ─── SHARED: Auto-reject an application (used by interview/home-visit fail) ──
// This is the single place that enforces "a failed interview or home visit
// rejects the application" — called from interviewController/homeVisitController
// so Application.status is never silently left out of sync with the real
// outcome of the vetting pipeline.
const autoRejectApplication = async ({ applicationId, actorId, reason }) => {
  const application = await Application.findById(applicationId)
    .populate("pet")
    .populate("applicant", "displayName email");

  if (!application) return null;
  if (application.status !== "pending") return application; // already decided, don't override

  const Pet = require("../models/Pet");
  const pet = application.pet ? await Pet.findById(application.pet._id) : null;

  application.status = "rejected";
  application.reviewedBy = actorId;
  application.reviewedAt = new Date();
  await application.save();

  if (pet) {
    if (pet.owner?.toString() === application.applicant._id.toString()) {
      await releasePetIfUnclaimed(pet, application._id);
    }
    await pet.save();
  }

  await logAction({
    actor: actorId,
    action: "APPLICATION_REJECTED",
    targetUser: application.applicant._id,
    metadata: { applicationId: application._id, petId: pet?._id, reason },
  });

  await notify({
    recipient: application.applicant._id,
    sender: actorId,
    type: "APPLICATION_REJECTED",
    title: "Application not approved",
    message: reason || "Your application was not approved after vetting.",
    refModel: "Application",
    refId: application._id,
  });

  return application;
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
      await releasePetIfUnclaimed(pet, application._id);
      await pet.save();
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
// This is the single source of truth for approve/reject (the old duplicate
// in petController has been removed — see petRoutes.js). It branches on
// application.type so a FOSTER approval creates a Foster placement and marks
// the pet "Foster" instead of permanently marking it "Adopted".
const updateApplicationStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
    }

    const application = await Application.findById(req.params.id)
      .populate("pet")
      .populate("applicant", "displayName email");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }
    if (application.status !== "pending") {
      return res.status(400).json({
        message: `This application is already ${application.status}`,
      });
    }

    if (status === "approved") {
      const { cleared, missing } = await getVettingGateStatus(application._id);
      if (!cleared) {
        return res.status(400).json({
          message: `Cannot approve yet — this application still needs ${missing.join(" and ")} before it can move forward.`,
        });
      }
    }

    const Pet = require("../models/Pet");
    const pet = await Pet.findById(application.pet._id);

    application.status = status;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();

    if (status === "approved") {
      if (application.type === "foster") {
        // ─── FOSTER approval: create the Foster placement, don't mark Adopted ───
        const existingActive = await Foster.findOne({ pet: pet._id, status: "active" });
        if (!existingActive) {
          let expectedEndDate = null;
          if (application.fosterPeriod) {
            const months =
              application.fosterPeriod === "1 month" ? 1 :
              application.fosterPeriod === "2 months" ? 2 : null; // "Flexible" → no end date
            if (months) {
              expectedEndDate = new Date();
              expectedEndDate.setMonth(expectedEndDate.getMonth() + months);
            }
          }

          await Foster.create({
            pet: pet._id,
            fosterer: application.applicant._id,
            application: application._id,
            startDate: new Date(),
            expectedEndDate,
            assignedBy: req.user._id,
          });
        }

        pet.status = "Foster";
        pet.owner = application.applicant._id;

        // Reject other pending FOSTER applications for this pet only
        await Application.updateMany(
          { pet: pet._id, _id: { $ne: application._id }, status: "pending", type: "foster" },
          { status: "rejected", reviewedBy: req.user._id, reviewedAt: new Date() }
        );
      } else {
        // ─── ADOPTION approval ──────────────────────────────────────────────
        pet.status = "Adopted";
        pet.owner = application.applicant._id;
        // Auto-reject all other pending applications for this pet (any type)
        await Application.updateMany(
          { pet: pet._id, _id: { $ne: application._id }, status: "pending" },
          { status: "rejected", reviewedBy: req.user._id, reviewedAt: new Date() }
        );
      }
    } else {
      // Rejected — only revert pet status if it was this applicant holding it,
      // and only if no other pending application still needs it.
      if (pet.owner?.toString() === application.applicant._id.toString()) {
        await releasePetIfUnclaimed(pet, application._id);
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
        type: application.type,
        reviewedBy: req.user.displayName,
      },
    });

    await notify({
      recipient: application.applicant._id,
      sender: req.user._id,
      type: status === "approved" ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
      title: status === "approved" ? "Application approved!" : "Application not approved",
      message:
        status === "approved"
          ? application.type === "foster"
            ? `Your foster application for ${pet.name} was approved.`
            : `Congratulations! Your adoption application for ${pet.name} was approved.`
          : remarks || `Your application for ${pet.name} was not approved.`,
      refModel: "Application",
      refId: application._id,
    });

    res.status(200).json({ message: `Application ${status}`, application });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


// ─── ADMIN: Add internal note to an application ───────────────────────────────
// POST /api/applications/:id/notes  { text: '...' }
const addInternalNote = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Note text is required' });
    }
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    application.internalNotes.push({ author: req.user._id, text: text.trim() });
    await application.save();
    await application.populate('internalNotes.author', 'displayName email');
    res.status(201).json({ message: 'Note added', notes: application.internalNotes });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// ─── ADMIN: Get internal notes ────────────────────────────────────────────────
// GET /api/applications/:id/notes
const getInternalNotes = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('internalNotes.author', 'displayName email');
    if (!application) return res.status(404).json({ message: 'Application not found' });
    res.status(200).json({ notes: application.internalNotes });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// ─── ADMIN: Get vetting stage status for an application ──────────────────────
// GET /api/applications/:id/vetting-status
// Lets the admin UI show/gate the Approve action without guessing.
const getVettingStatus = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    const [latestInterview, latestHomeVisit] = await Promise.all([
      Interview.findOne({ application: application._id }).sort({ createdAt: -1 }),
      HomeVisit.findOne({ application: application._id }).sort({ createdAt: -1 }),
    ]);
    const { cleared, missing } = await getVettingGateStatus(application._id);

    res.status(200).json({
      cleared,
      missing,
      interview: latestInterview
        ? { _id: latestInterview._id, status: latestInterview.status, result: latestInterview.result }
        : null,
      homeVisit: latestHomeVisit
        ? { _id: latestHomeVisit._id, status: latestHomeVisit.status, result: latestHomeVisit.result }
        : null,
    });
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
  autoRejectApplication,
  addInternalNote,
  getInternalNotes,
  getVettingStatus,
};
