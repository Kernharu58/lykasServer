const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getPets,
  getPetById,
  createPet,
  getMyPets,
  adoptPet,
} = require("../controllers/petController");

// Basic Pet Operations
router.route("/").get(getPets).post(createPet);

// User-Specific Pet Operations (Must be above /:id)
router.get("/my-pets", protect, getMyPets);

// Specific Pet Details & Actions
router.route("/:id").get(getPetById);
router.post("/:id/adopt", protect, adoptPet);

module.exports = router;
