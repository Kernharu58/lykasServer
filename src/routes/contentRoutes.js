const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getPublicContent, getPublicBySlug, getAllContent, getContentById,
  createContent, updateContent, deleteContent,
} = require("../controllers/contentController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// Public/user-app routes (no auth required — FAQs/policies are meant to be readable pre-login)
router.get("/public", getPublicContent);
router.get("/public/slug/:slug", getPublicBySlug);

// Admin routes
router.get("/", adminOnly, getAllContent);
router.get("/:id", adminOnly, getContentById);
router.post("/", adminOnly, createContent);
router.put("/:id", adminOnly, updateContent);
router.delete("/:id", adminOnly, deleteContent);

module.exports = router;
