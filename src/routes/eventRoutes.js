const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  createEvent, getAllEvents, getEventById, updateEvent, cancelEvent,
  registerForEvent, cancelRegistration, getEventRegistrations,
  getMyRegistrations, markAttended,
  assignVolunteer, getEventVolunteers, updateVolunteerAssignment,
} = require("../controllers/eventController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// Must be before /:id
router.get("/my-registrations",   protect,   getMyRegistrations);

// Event CRUD
router.post("/",                  adminOnly, createEvent);
router.get("/",                   protect,   getAllEvents);
router.get("/:id",                protect,   getEventById);
router.put("/:id",                adminOnly, updateEvent);
router.delete("/:id",             adminOnly, cancelEvent);

// Registrations
router.post("/:id/register",          protect,   registerForEvent);
router.delete("/:id/register",        protect,   cancelRegistration);
router.get("/:id/registrations",      adminOnly, getEventRegistrations);
router.put("/:id/registrations/:userId/attend", adminOnly, markAttended);

// Volunteer assignments
router.post("/:id/volunteers",                        adminOnly, assignVolunteer);
router.get("/:id/volunteers",                         adminOnly, getEventVolunteers);
router.put("/:id/volunteers/:assignmentId",           adminOnly, updateVolunteerAssignment);

module.exports = router;
