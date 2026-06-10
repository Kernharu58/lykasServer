const express = require("express");
const router  = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  createCheckout, handleWebhook,
  getMyPayments, getMyPaymentById,
  getAllPayments, getPaymentById,
  getPaymentSummary, markRefunded,
} = require("../controllers/paymentController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

// ⚠ Webhook is PUBLIC — PayMongo calls this with no auth
router.post("/webhook", handleWebhook);

// User routes
router.post("/create-checkout",   protect,   createCheckout);
router.get("/my",                 protect,   getMyPayments);
router.get("/my/:id",             protect,   getMyPaymentById);

// Admin routes — specific before /:id
router.get("/summary",            adminOnly, getPaymentSummary);
router.get("/",                   adminOnly, getAllPayments);
router.get("/:id",                adminOnly, getPaymentById);
router.put("/:id/refund",         adminOnly, markRefunded);

module.exports = router;
