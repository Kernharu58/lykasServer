const { Event, EventRegistration, EventAssignment } = require("../models/Event");
const AuditLog = require("../models/AuditLog");
const User     = require("../models/User");

const logAction = async ({ actor, action, metadata }) => {
  try { await AuditLog.create({ actor, action, metadata }); } catch (e) { /* silent */ }
};

// ═══════════════════════════════════════════════════════════
// EVENTS (ADMIN CRUD)
// ═══════════════════════════════════════════════════════════

// POST /api/events
const createEvent = async (req, res) => {
  try {
    const { title, description, category, date, endDate, location,
            isOnline, onlineLink, maxAttendees, imageUrl, notes } = req.body;

    const event = await Event.create({
      title, description, category, date, endDate, location,
      isOnline: isOnline || false,
      onlineLink, maxAttendees, imageUrl, notes,
      createdBy: req.user._id,
    });

    await logAction({
      actor: req.user._id, action: "EVENT_CREATED",
      metadata: { eventId: event._id, title, date },
    });

    res.status(201).json({ message: "Event created", event });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/events?status=upcoming&category=Adoption Drive&page=1&limit=20
const getAllEvents = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status   && ["upcoming","ongoing","completed","cancelled"].includes(status)) filter.status = status;
    if (category && ["Adoption Drive","Fundraiser","Training","Community","Volunteer","Other"].includes(category)) {
      filter.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate("createdBy", "displayName email")
        .sort({ date: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Event.countDocuments(filter),
    ]);

    res.status(200).json({
      events,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/events/:id
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "displayName email");
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// PUT /api/events/:id
const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.status === "completed" || event.status === "cancelled") {
      return res.status(400).json({ message: `Cannot edit a ${event.status} event` });
    }

    const fields = ["title","description","category","date","endDate","location",
                    "isOnline","onlineLink","maxAttendees","imageUrl","notes","status"];
    fields.forEach(f => { if (req.body[f] !== undefined) event[f] = req.body[f]; });

    await event.save();
    res.status(200).json({ message: "Event updated", event });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// DELETE /api/events/:id  (cancel only — no hard delete)
const cancelEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.status === "cancelled") {
      return res.status(400).json({ message: "Event is already cancelled" });
    }

    event.status = "cancelled";
    await event.save();

    await logAction({
      actor: req.user._id, action: "EVENT_CANCELLED",
      metadata: { eventId: event._id, title: event.title },
    });

    res.status(200).json({ message: "Event cancelled", event });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// REGISTRATIONS (USER)
// ═══════════════════════════════════════════════════════════

// POST /api/events/:id/register
const registerForEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.status === "cancelled" || event.status === "completed") {
      return res.status(400).json({ message: `Cannot register for a ${event.status} event` });
    }
    if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      return res.status(400).json({ message: "This event is fully booked" });
    }

    // Check existing registration
    const existing = await EventRegistration.findOne({ event: event._id, user: req.user._id });
    if (existing) {
      if (existing.status === "cancelled") {
        // Re-register
        existing.status = "registered";
        existing.registeredAt = new Date();
        await existing.save();
        event.currentAttendees += 1;
        await event.save();
        return res.status(200).json({ message: "Re-registered for event", registration: existing });
      }
      return res.status(400).json({ message: "You are already registered for this event" });
    }

    const registration = await EventRegistration.create({
      event: event._id,
      user:  req.user._id,
      notes: req.body.notes || "",
    });

    event.currentAttendees += 1;
    await event.save();

    res.status(201).json({ message: "Successfully registered for event", registration });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// DELETE /api/events/:id/register  (cancel own registration)
const cancelRegistration = async (req, res) => {
  try {
    const registration = await EventRegistration.findOne({
      event: req.params.id, user: req.user._id,
    });
    if (!registration || registration.status === "cancelled") {
      return res.status(404).json({ message: "Active registration not found" });
    }

    registration.status = "cancelled";
    await registration.save();

    await Event.findByIdAndUpdate(req.params.id, { $inc: { currentAttendees: -1 } });

    res.status(200).json({ message: "Registration cancelled" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/events/:id/registrations  (admin — see who registered)
const getEventRegistrations = async (req, res) => {
  try {
    const registrations = await EventRegistration.find({ event: req.params.id })
      .populate("user", "displayName email profilePicture")
      .sort({ registeredAt: 1 });
    res.status(200).json(registrations);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/events/my-registrations  (user — events I signed up for)
const getMyRegistrations = async (req, res) => {
  try {
    const registrations = await EventRegistration.find({
      user: req.user._id, status: { $ne: "cancelled" },
    }).populate("event").sort({ registeredAt: -1 });
    res.status(200).json(registrations);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ADMIN: Mark attendee as attended
// PUT /api/events/:id/registrations/:userId/attend
const markAttended = async (req, res) => {
  try {
    const registration = await EventRegistration.findOne({
      event: req.params.id, user: req.params.userId,
    });
    if (!registration) return res.status(404).json({ message: "Registration not found" });
    registration.status = "attended";
    await registration.save();
    res.status(200).json({ message: "Marked as attended", registration });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// VOLUNTEER ASSIGNMENTS
// ═══════════════════════════════════════════════════════════

// POST /api/events/:id/volunteers  { volunteerId, role }
const assignVolunteer = async (req, res) => {
  try {
    const { volunteerId, role } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const existing = await EventAssignment.findOne({ event: event._id, volunteer: volunteerId });
    if (existing && existing.status !== "cancelled") {
      return res.status(400).json({ message: "Volunteer already assigned to this event" });
    }

    const assignment = existing
      ? Object.assign(existing, { status: "assigned", role, assignedBy: req.user._id }) && await existing.save() && existing
      : await EventAssignment.create({ event: event._id, volunteer: volunteerId, role, assignedBy: req.user._id });

    await logAction({
      actor: req.user._id, action: "EVENT_VOLUNTEER_ASSIGNED",
      metadata: { eventId: event._id, volunteerId, role },
    });

    res.status(201).json({ message: "Volunteer assigned to event", assignment });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/events/:id/volunteers  (admin — see assigned volunteers)
const getEventVolunteers = async (req, res) => {
  try {
    const assignments = await EventAssignment.find({ event: req.params.id })
      .populate("volunteer",  "displayName email profilePicture")
      .populate("assignedBy", "displayName email")
      .sort({ createdAt: 1 });
    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// PUT /api/events/:id/volunteers/:assignmentId  { status, hoursLogged }
const updateVolunteerAssignment = async (req, res) => {
  try {
    const assignment = await EventAssignment.findById(req.params.assignmentId);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });

    const { status, hoursLogged, role } = req.body;
    if (status      !== undefined) assignment.status      = status;
    if (hoursLogged !== undefined) assignment.hoursLogged = hoursLogged;
    if (role        !== undefined) assignment.role        = role;

    await assignment.save();
    res.status(200).json({ message: "Assignment updated", assignment });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  createEvent, getAllEvents, getEventById, updateEvent, cancelEvent,
  registerForEvent, cancelRegistration, getEventRegistrations,
  getMyRegistrations, markAttended,
  assignVolunteer, getEventVolunteers, updateVolunteerAssignment,
};
