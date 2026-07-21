const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  createDonation,
  getMyDonations,
  getAllDonations,
  updateStatus,
  deleteDonation,
  restoreDonation,
  bulkUpdateDonationStatus,
  exportDonations,
  getDonationHistory,
} = require("../controllers/inKindDonationController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.post("/",            protect,   createDonation);   // user: submit pledge
router.get("/my",           protect,   getMyDonations);   // user: my donations
router.get("/",             adminOnly, getAllDonations);   // admin: list all
router.get("/export",       adminOnly, exportDonations);
router.post("/bulk-status", adminOnly, bulkUpdateDonationStatus);
router.patch("/:id/status", adminOnly, updateStatus);     // admin: update status
router.delete("/:id",       adminOnly, deleteDonation);
router.post("/:id/restore", adminOnly, restoreDonation);
router.get("/:id/history",  adminOnly, getDonationHistory);

module.exports = router;