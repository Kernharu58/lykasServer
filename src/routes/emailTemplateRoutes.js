const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const { getTemplates, getTemplateByKey, updateTemplate, previewTemplate } = require("../controllers/emailTemplateController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/", adminOnly, getTemplates);
router.get("/:key", adminOnly, getTemplateByKey);
router.put("/:key", adminOnly, updateTemplate);
router.post("/:key/preview", adminOnly, previewTemplate);

module.exports = router;
