const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getAdopterProfile, getAllAdopterProfiles } = require("../controllers/adopterProfileController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/",        adminOnly, getAllAdopterProfiles);
router.get("/:userId", adminOnly, getAdopterProfile);

module.exports = router;
