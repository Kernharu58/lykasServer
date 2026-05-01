const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { upload } = require("../config/cloudinary"); // 👉 1. Import Cloudinary middleware

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

const {
  getPets,
  getPetById,
  createPet,
  getMyPets,
  adoptPet,
  updatePet,
  deletePet,
  getPendingAdoptions,
  updateAdoptionApplicationStatus
} = require("../controllers/petController");

// Basic Pet Operations
router.route("/")
  .get(getPets)
  // 👉 2. Add upload.single("image") to intercept the file before creating the pet
  .post(adminOnly, upload.single("image"), createPet); 

// User-Specific Pet Operations (Must be above /:id)
router.get("/my-pets", protect, getMyPets);
// Admin-Specific Operations
router.get("/pending-adoptions", adminOnly, getPendingAdoptions);
router.put("/applications/:id/status", adminOnly, updateAdoptionApplicationStatus);

// Specific Pet Details & Actions
router.route("/:id")
  .get(getPetById)
  // 👉 3. Add upload.single("image") to intercept the file before updating the pet
  .put(adminOnly, upload.single("image"), updatePet)     
  .delete(adminOnly, deletePet); 
  
router.post("/:id/adopt", protect, adoptPet);

module.exports = router;
