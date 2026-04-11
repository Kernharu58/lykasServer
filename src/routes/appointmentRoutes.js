const express = require("express");
const router = express.Router();
const {
  getAppointments,
  createAppointment,
  enrollInAppointment,
  getMyAppointments,
  cancelEnrollment,
  createTestShift, 
  deleteAppointment,
  updateAppointment // 👉 Import the new function
} = require("../controllers/appointmentController");
const { protect } = require("../middleware/authMiddleware");

router.get("/seed", createTestShift);

router.route("/").get(getAppointments).post(createAppointment);
router.get("/my-appointments", protect, getMyAppointments);
router.post("/:id/enroll", protect, enrollInAppointment);
router.post("/:id/cancel", protect, cancelEnrollment);

// 👉 NEW: Route to handle updating the shift
router.put("/:id", updateAppointment);

// Route to handle deleting the shift
router.delete("/:id", deleteAppointment);

module.exports = router;