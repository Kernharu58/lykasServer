const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { upload } = require("../config/cloudinary"); // 👉 1. Import Cloudinary middleware

const {
  getPets,
  getPetById,
  createPet,
  getMyPets,
  adoptPet,
  updatePet,
  deletePet,
  getPendingAdoptions
} = require("../controllers/petController");

// Basic Pet Operations
router.route("/")
  .get(getPets)
  // 👉 2. Add upload.single("image") to intercept the file before creating the pet
  .post(upload.single("image"), createPet); 

// User-Specific Pet Operations (Must be above /:id)
router.get("/my-pets", protect, getMyPets);
// Admin-Specific Operations
router.get("/pending-adoptions", getPendingAdoptions);

// Specific Pet Details & Actions
router.route("/:id")
  .get(getPetById)
  // 👉 3. Add upload.single("image") to intercept the file before updating the pet
  .put(upload.single("image"), updatePet)     
  .delete(deletePet); 
  
router.post("/:id/adopt", protect, adoptPet);

module.exports = router;