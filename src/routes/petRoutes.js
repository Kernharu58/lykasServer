const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getPets,
  getPetById,
  createPet,
  getMyPets,
  adoptPet,
  updatePet,
  deletePet
} = require("../controllers/petController");

// Basic Pet Operations
router.route("/").get(getPets).post(createPet);

// User-Specific Pet Operations (Must be above /:id)
router.get("/my-pets", protect, getMyPets);

// Specific Pet Details & Actions
router.route("/:id")
  .get(getPetById)
  .put(updatePet)     // 👈 ADDED: Listens for EditModal saves
  .delete(deletePet); // 👈 ADDED: Listens for Trash clicks
router.post("/:id/adopt", protect, adoptPet);

module.exports = router;
