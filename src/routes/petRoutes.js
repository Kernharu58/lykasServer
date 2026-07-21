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
  restorePet,
  permanentlyDeletePet,
  getAllPetsAdmin,
  exportPets,
  getPetHistory,
} = require("../controllers/petController");

// Basic Pet Operations
router.route("/")
  .get(getPets)
  // 👉 2. Add upload.single("image") to intercept the file before creating the pet
  .post(adminOnly, upload.single("image"), createPet); 

// Admin: search/sort/filter/pagination list (includes Adopted/Foster/deleted)
router.get("/admin", adminOnly, getAllPetsAdmin);

// Admin: export
router.get("/export", adminOnly, exportPets);

// User-Specific Pet Operations (Must be above /:id)
router.get("/my-pets", protect, getMyPets);
// NOTE: pending-adoptions / applications/:id/status used to live here as a
// second, divergent implementation of approve/reject (it didn't branch on
// application.type the same way applicationController's version did). Removed
// — use GET /api/applications?status=pending and
// PUT /api/applications/:id/status instead, which are now the single source
// of truth for the adoption/foster review workflow.

// Specific Pet Details & Actions
router.route("/:id")
  .get(getPetById)
  // 👉 3. Add upload.single("image") to intercept the file before updating the pet
  .put(adminOnly, upload.single("image"), updatePet)     
  .delete(adminOnly, deletePet); // soft delete — recoverable via /:id/restore

router.post("/:id/restore", adminOnly, restorePet);
router.delete("/:id/permanent", protect, restrictTo("super_admin"), permanentlyDeletePet);
router.get("/:id/history", adminOnly, getPetHistory);

router.post("/:id/adopt", protect, adoptPet);

module.exports = router;
