const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  assignVolunteer, getAllAssignments, getMyAssignments,
  updateAssignment, confirmAssignment, cancelAssignment,
} = require("../controllers/eventAssignmentController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/my",           protect,   getMyAssignments);
router.post("/",            adminOnly, assignVolunteer);
router.get("/",             adminOnly, getAllAssignments);
router.put("/:id",          adminOnly, updateAssignment);
router.put("/:id/confirm",  protect,   confirmAssignment);
router.delete("/:id",       adminOnly, cancelAssignment);

module.exports = router;
