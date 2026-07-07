const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getAllShelters, getShelterById, createShelter, updateShelter, deleteShelter, getSummary,
} = require("../controllers/shelterController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/summary", adminOnly, getSummary);
router.get("/", adminOnly, getAllShelters);
router.get("/:id", adminOnly, getShelterById);
router.post("/", [protect, restrictTo("admin", "super_admin")], createShelter);
router.put("/:id", adminOnly, updateShelter);
router.delete("/:id", [protect, restrictTo("admin", "super_admin")], deleteShelter);

module.exports = router;
