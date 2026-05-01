const Appointment = require("../models/Appointment");
const AuditLog = require("../models/AuditLog");

const createAuditLog = async ({ actor, action, targetUser, metadata }) => {
  try {
    if (!actor) return;
    await AuditLog.create({ actor, action, targetUser, metadata });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
};

const getAppointments = async (req, res) => {
  try {
    const isAdmin = ["admin", "staff", "super_admin"].includes(req.user.role);
    const query = Appointment.find().sort({ date: 1 });

    if (isAdmin) {
      query.populate("enrolledUsers.user", "displayName email profilePicture");
    } else {
      query.select("-enrolledUsers");
    }

    const appointments = await query;
      
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.create(req.body);

    await createAuditLog({
      actor: req.user?._id,
      action: "SHIFT_CREATE",
      metadata: {
        appointmentId: appointment._id,
        title: appointment.title,
        date: appointment.date,
        capacity: appointment.capacity,
      },
    });

    res.status(201).json(appointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const enrollInAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Not found" });
    if (appointment.status !== "Open") {
      return res.status(400).json({ message: "Shift is not open for enrollment" });
    }

    // 1. Grab the form data sent from your React Native screen
    const { phone, emergencyContact, notes } = req.body;

    const shiftStart = new Date(appointment.date);
    const shiftEnd = new Date(shiftStart.getTime() + appointment.durationHours * 60 * 60 * 1000);
    const userAppointments = await Appointment.find({
      "enrolledUsers.user": req.user._id,
      status: { $ne: "Completed" },
    });

    const hasOverlap = userAppointments.some((existingAppointment) => {
      const existingStart = new Date(existingAppointment.date);
      const existingEnd = new Date(
        existingStart.getTime() + existingAppointment.durationHours * 60 * 60 * 1000,
      );
      return existingStart < shiftEnd && existingEnd > shiftStart;
    });

    if (hasOverlap) {
      return res.status(400).json({ message: "You already have a shift during this time" });
    }

    const updatedAppointment = await Appointment.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "Open",
        "enrolledUsers.user": { $ne: req.user._id },
        $expr: { $lt: [{ $size: "$enrolledUsers" }, "$capacity"] },
      },
      {
        $push: {
          enrolledUsers: {
            user: req.user._id,
            phone,
            emergencyContact,
            notes,
          },
        },
      },
      { new: true },
    );

    if (!updatedAppointment) {
      return res.status(400).json({ message: "Shift is full or you are already signed up" });
    }

    if (updatedAppointment.enrolledUsers.length >= updatedAppointment.capacity) {
      updatedAppointment.status = "Full";
      await updatedAppointment.save();
    }

    res.status(200).json({ message: "Successfully enrolled!", appointment: updatedAppointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 👉 UPDATED: Looks for the nested user ID
const getMyAppointments = async (req, res) => {
  try {
    // We update the query to look inside the new object structure
    const appointments = await Appointment.find({
      "enrolledUsers.user": req.user._id,
    });
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 👉 UPDATED: Removes the correct object when cancelling
const cancelEnrollment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Not found" });

    // Filter out the object belonging to the user
    appointment.enrolledUsers = appointment.enrolledUsers.filter(
      (entry) => entry.user.toString() !== req.user._id.toString(),
    );

    if (
      appointment.status === "Full" &&
      appointment.enrolledUsers.length < appointment.capacity
    ) {
      appointment.status = "Open";
    }

    await appointment.save();
    res.status(200).json({ message: "You have dropped this shift." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 👉 TEMPORARY: A quick way to generate a test shift!
const createTestShift = async (req, res) => {
  try {
    const testShift = await Appointment.create({
      title: "Morning Dog Walking",
      date: new Date(Date.now() + 86400000), // Sets date to tomorrow
      durationHours: 2,
      capacity: 5,
      status: "Open",
    });
    res
      .status(201)
      .send(
        `<h1>Success!</h1><p>Test shift "${testShift.title}" created. Go check your app!</p>`,
      );
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// 👉 NEW: Delete a shift entirely
const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Shift not found" });

    await createAuditLog({
      actor: req.user?._id,
      action: "SHIFT_DELETE",
      metadata: {
        appointmentId: appointment._id,
        title: appointment.title,
        date: appointment.date,
        enrolledCount: appointment.enrolledUsers.length,
      },
    });
    
    res.status(200).json({ message: "Shift successfully deleted." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 👉 NEW: Update an existing shift
const updateAppointment = async (req, res) => {
  try {
    const existingAppointment = await Appointment.findById(req.params.id);
    if (!existingAppointment) return res.status(404).json({ message: "Shift not found" });

    const previousStatus = existingAppointment.status;
    Object.assign(existingAppointment, req.body);
    const appointment = await existingAppointment.save();

    await createAuditLog({
      actor: req.user?._id,
      action: "SHIFT_UPDATE",
      metadata: {
        appointmentId: appointment._id,
        title: appointment.title,
        previousStatus,
        newStatus: appointment.status,
        date: appointment.date,
        capacity: appointment.capacity,
      },
    });
    
    res.status(200).json(appointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 👉 UPDATE YOUR EXPORTS: Make sure updateAppointment is included at the very bottom!
module.exports = {
  getAppointments,
  createAppointment,
  enrollInAppointment,
  getMyAppointments,
  cancelEnrollment,
  createTestShift, 
  deleteAppointment,
  updateAppointment // <--- ADD IT HERE
};
