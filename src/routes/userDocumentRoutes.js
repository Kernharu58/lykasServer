const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const upload  = require("../middleware/uploadMiddleware");
const {
  uploadDocument, getMyDocuments, deleteDocument,
  getAllDocuments, verifyDocument,
} = require("../controllers/userDocumentController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/my",           protect,   getMyDocuments);
router.post("/",            protect,   upload.single("file"), uploadDocument);
router.delete("/:id",       protect,   deleteDocument);
router.get("/",             adminOnly, getAllDocuments);
router.put("/:id/verify",   adminOnly, verifyDocument);

module.exports = router;
