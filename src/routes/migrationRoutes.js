const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getMigrations, recordMigration } = require("../controllers/migrationController");

const superAdminOnly = [protect, restrictTo("super_admin")];

router.get("/", superAdminOnly, getMigrations);
router.post("/", superAdminOnly, recordMigration);

module.exports = router;
