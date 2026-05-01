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
const { protect, restrictTo } = require("../middleware/authMiddleware");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/seed", adminOnly, createTestShift);

router.route("/").get(protect, getAppointments).post(adminOnly, createAppointment);
router.get("/my-appointments", protect, getMyAppointments);
router.post("/:id/enroll", protect, enrollInAppointment);
router.post("/:id/cancel", protect, cancelEnrollment);

// 👉 NEW: Route to handle updating the shift
router.put("/:id", adminOnly, updateAppointment);

// Route to handle deleting the shift
router.delete("/:id", adminOnly, deleteAppointment);

module.exports = router;
