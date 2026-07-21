const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getApiKeys, createApiKey, revokeApiKey } = require("../controllers/apiKeyController");

const superAdminOnly = [protect, restrictTo("super_admin")];

router.get("/", superAdminOnly, getApiKeys);
router.post("/", superAdminOnly, createApiKey);
router.delete("/:id", superAdminOnly, revokeApiKey);

module.exports = router;
