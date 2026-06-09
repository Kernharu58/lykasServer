const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  addVaccination, getVaccinations, getUpcomingVaccinations, updateVaccination, deleteVaccination,
  addVetVisit, getVetVisits, updateVetVisit, deleteVetVisit,
  addMedicalRecord, getMedicalRecords, updateMedicalRecord, deleteMedicalRecord,
  getPetMedicalSummary,
} = require("../controllers/medicalRecordController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// Summary
router.get("/summary/:petId",                 protect,   getPetMedicalSummary);

// Vaccinations
router.post("/vaccinations",                  adminOnly, addVaccination);
router.get("/vaccinations/upcoming",          protect,   getUpcomingVaccinations);  // before /:petId
router.get("/vaccinations/:petId",            protect,   getVaccinations);
router.put("/vaccinations/:id",               adminOnly, updateVaccination);
router.delete("/vaccinations/:id",            adminOnly, deleteVaccination);

// Vet Visits
router.post("/vet-visits",                    adminOnly, addVetVisit);
router.get("/vet-visits/:petId",              protect,   getVetVisits);
router.put("/vet-visits/:id",                 adminOnly, updateVetVisit);
router.delete("/vet-visits/:id",              adminOnly, deleteVetVisit);

// General Medical Records
router.post("/records",                       adminOnly, addMedicalRecord);
router.get("/records/:petId",                 protect,   getMedicalRecords);
router.put("/records/:id",                    adminOnly, updateMedicalRecord);
router.delete("/records/:id",                 adminOnly, deleteMedicalRecord);

module.exports = router;
