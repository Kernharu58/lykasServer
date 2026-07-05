const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  createDonation,
  getMyDonations,
  getAllDonations,
  updateStatus,
} = require("../controllers/inKindDonationController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.post("/",            protect,   createDonation);   // user: submit pledge
router.get("/my",           protect,   getMyDonations);   // user: my donations
router.get("/",             adminOnly, getAllDonations);   // admin: list all
router.patch("/:id/status", adminOnly, updateStatus);     // admin: update status

module.exports = router;