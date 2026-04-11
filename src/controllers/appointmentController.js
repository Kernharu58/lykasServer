const Appointment = require("../models/Appointment");

const getAppointments = async (req, res) => {
  try {
    // 👉 FIX: Added .populate() to pull in the user's actual name, email, and picture!
    const appointments = await Appointment.find()
      .populate("enrolledUsers.user", "displayName email profilePicture")
      .sort({ date: 1 });
      
    res.status(200).json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.create(req.body);
    res.status(201).json(appointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const enrollInAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: "Not found" });

    // 1. Grab the form data sent from your React Native screen
    const { phone, emergencyContact, notes } = req.body;

    // 2. Check if user is already enrolled (checking the nested .user field)
    const isEnrolled = appointment.enrolledUsers.some(
      (entry) => entry.user.toString() === req.user._id.toString(),
    );

    if (isEnrolled) {
      return res.status(400).json({ message: "Already signed up" });
    }

    if (appointment.enrolledUsers.length >= appointment.capacity) {
      appointment.status = "Full";
      await appointment.save();
      return res.status(400).json({ message: "Shift is full" });
    }

    // 3. Push the entire application object to the database!
    appointment.enrolledUsers.push({
      user: req.user._id,
      phone,
      emergencyContact,
      notes,
    });

    if (appointment.enrolledUsers.length === appointment.capacity) {
      appointment.status = "Full";
    }

    await appointment.save();
    res.status(200).json({ message: "Successfully enrolled!", appointment });
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
    
    res.status(200).json({ message: "Shift successfully deleted." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 👉 NEW: Update an existing shift
const updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true } // Return the updated document
    );
    if (!appointment) return res.status(404).json({ message: "Shift not found" });
    
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