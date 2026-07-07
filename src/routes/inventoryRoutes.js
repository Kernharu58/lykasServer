const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getAllItems, getItemById, createItem, updateItem, adjustStock, deleteItem, getSummary,
} = require("../controllers/inventoryController");

const adminOnly = [protect, restrictTo("admin", "staff", "super_admin")];

router.get("/summary", adminOnly, getSummary);
router.get("/", adminOnly, getAllItems);
router.get("/:id", adminOnly, getItemById);
router.post("/", adminOnly, createItem);
router.put("/:id", adminOnly, updateItem);
router.post("/:id/adjust", adminOnly, adjustStock);
router.delete("/:id", [protect, restrictTo("admin", "super_admin")], deleteItem);

module.exports = router;
