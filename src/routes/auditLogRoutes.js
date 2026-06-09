const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getAuditLogs, getAuditLogById, getAuditActions } = require("../controllers/auditLogController");

const superAdminOnly = [protect, restrictTo("super_admin")];

router.get("/actions", superAdminOnly, getAuditActions);   // must be BEFORE /:id
router.get("/",        superAdminOnly, getAuditLogs);
router.get("/:id",     superAdminOnly, getAuditLogById);

module.exports = router;
