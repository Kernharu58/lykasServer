const express = require("express");
const router = express.Router();
const {
  getAppointments,
  createAppointment,
  enrollInAppointment,
  getMyAppointments,
  cancelEnrollment,
  createTestShift, // Import the generator
} = require("../controllers/appointmentController");
const { protect } = require("../middleware/authMiddleware");

// 👉 The route to generate our test shift
router.get("/seed", createTestShift);

router.route("/").get(getAppointments).post(createAppointment);
router.get("/my-appointments", protect, getMyAppointments);
router.post("/:id/enroll", protect, enrollInAppointment);
router.post("/:id/cancel", protect, cancelEnrollment);

module.exports = router;
