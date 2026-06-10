const { EventAssignment, Event } = require("../models/Event");
const Volunteer  = require("../models/Volunteer");
const AuditLog   = require("../models/AuditLog");
const { notify } = require("../utils/notificationHelper");

const logAction = async ({ actor, action, metadata }) => {
  try { await AuditLog.create({ actor, action, metadata }); } catch (e) { /* silent */ }
};

// ─── ADMIN: Assign volunteer to an event ─────────────────────────────────────
// POST /api/event-assignments
// { eventId, volunteerId, role, notes }
const assignVolunteer = async (req, res) => {
  try {
    const { eventId, volunteerId, role, notes } = req.body;

    const [event, volunteer] = await Promise.all([
      Event.findById(eventId),
      Volunteer.findOne({ user: volunteerId, status: "approved" }).populate("user", "displayName email"),
    ]);

    if (!event)     return res.status(404).json({ message: "Event not found" });
    if (!volunteer) return res.status(404).json({ message: "Approved volunteer not found for this user" });

    if (["completed", "cancelled"].includes(event.status)) {
      return res.status(400).json({ message: `Cannot assign volunteers to a ${event.status} event` });
    }

    // Prevent duplicate assignment
    const existing = await EventAssignment.findOne({ event: eventId, volunteer: volunteerId });
    if (existing && existing.status !== "cancelled") {
      return res.status(400).json({ message: "Volunteer is already assigned to this event" });
    }

    let assignment;
    if (existing) {
      // Re-assign if previously cancelled
      existing.status     = "assigned";
      existing.role       = role || existing.role;
      existing.assignedBy = req.user._id;
      existing.notes      = notes || "";
      await existing.save();
      assignment = existing;
    } else {
      assignment = await EventAssignment.create({
        event:      eventId,
        volunteer:  volunteerId,
        role:       role || "",
        assignedBy: req.user._id,
        notes:      notes || "",
      });
    }

    // Notify volunteer
    await notify({
      recipient: volunteerId,
      sender:    req.user._id,
      type:      "EVENT_CREATED",
      title:     "You've been assigned to an event!",
      message:   `You have been assigned as "${role || "Volunteer"}" for the event "${event.title}" on ${new Date(event.date).toLocaleDateString()}.`,
      refModel:  "Event",
      refId:     event._id,
    });

    await logAction({
      actor: req.user._id, action: "EVENT_VOLUNTEER_ASSIGNED",
      metadata: { eventId, volunteerId, role, eventTitle: event.title },
    });

    res.status(201).json({ message: "Volunteer assigned", assignment });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all assignments (optionally filtered by event) ────────────────
// GET /api/event-assignments?eventId=&status=assigned&page=1&limit=20
const getAllAssignments = async (req, res) => {
  try {
    const { eventId, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (eventId) filter.event = eventId;
    if (status && ["assigned","confirmed","completed","cancelled"].includes(status)) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [assignments, total] = await Promise.all([
      EventAssignment.find(filter)
        .populate("event",      "title date status")
        .populate("volunteer",  "displayName email profilePicture")
        .populate("assignedBy", "displayName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      EventAssignment.countDocuments(filter),
    ]);

    res.status(200).json({
      assignments,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Get my event assignments ──────────────────────────────────────────
// GET /api/event-assignments/my
const getMyAssignments = async (req, res) => {
  try {
    const assignments = await EventAssignment.find({ volunteer: req.user._id })
      .populate("event", "title date location status imageUrl")
      .sort({ createdAt: -1 });
    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Update assignment status / hours ──────────────────────────────────
// PUT /api/event-assignments/:id
// { status, hoursLogged, role, notes }
const updateAssignment = async (req, res) => {
  try {
    const assignment = await EventAssignment.findById(req.params.id)
      .populate("volunteer", "displayName email");
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    const { status, hoursLogged, role, notes } = req.body;
    if (status      !== undefined) assignment.status      = status;
    if (hoursLogged !== undefined) assignment.hoursLogged = hoursLogged;
    if (role        !== undefined) assignment.role        = role;
    if (notes       !== undefined) assignment.notes       = notes;

    await assignment.save();

    // If completed, update total volunteer hours
    if (status === "completed" && hoursLogged > 0) {
      const Volunteer = require("../models/Volunteer");
      const User      = require("../models/User");
      await Promise.all([
        Volunteer.findOneAndUpdate({ user: assignment.volunteer._id }, { $inc: { totalHours: hoursLogged } }),
        User.findByIdAndUpdate(assignment.volunteer._id,               { $inc: { volunteerHours: hoursLogged } }),
      ]);

      await notify({
        recipient: assignment.volunteer._id,
        type:      "GENERAL",
        title:     "Event hours logged!",
        message:   `${hoursLogged} volunteer hour(s) have been added to your record for your event contribution.`,
      });
    }

    res.status(200).json({ message: "Assignment updated", assignment });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── USER: Confirm assignment (volunteer acknowledges) ────────────────────────
// PUT /api/event-assignments/:id/confirm
const confirmAssignment = async (req, res) => {
  try {
    const assignment = await EventAssignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    if (assignment.volunteer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (assignment.status !== "assigned") {
      return res.status(400).json({ message: "Only pending assignments can be confirmed" });
    }

    assignment.status = "confirmed";
    await assignment.save();
    res.status(200).json({ message: "Assignment confirmed", assignment });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Cancel an assignment ─────────────────────────────────────────────
// DELETE /api/event-assignments/:id
const cancelAssignment = async (req, res) => {
  try {
    const assignment = await EventAssignment.findById(req.params.id)
      .populate("event",     "title")
      .populate("volunteer", "displayName email");
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    if (assignment.status === "completed") {
      return res.status(400).json({ message: "Cannot cancel a completed assignment" });
    }

    assignment.status = "cancelled";
    await assignment.save();

    await notify({
      recipient: assignment.volunteer._id,
      sender:    req.user._id,
      type:      "EVENT_CANCELLED",
      title:     "Event assignment cancelled",
      message:   `Your assignment for "${assignment.event.title}" has been cancelled.`,
      refModel:  "Event",
      refId:     assignment.event._id,
    });

    await logAction({
      actor: req.user._id, action: "EVENT_ASSIGNMENT_CANCELLED",
      metadata: { assignmentId: assignment._id, eventId: assignment.event._id },
    });

    res.status(200).json({ message: "Assignment cancelled" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  assignVolunteer,
  getAllAssignments,
  getMyAssignments,
  updateAssignment,
  confirmAssignment,
  cancelAssignment,
};
