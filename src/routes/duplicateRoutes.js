const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getDuplicateUsers, getDuplicatePets } = require("../controllers/duplicateController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/users", adminOnly, getDuplicateUsers);
router.get("/pets", adminOnly, getDuplicatePets);

module.exports = router;
