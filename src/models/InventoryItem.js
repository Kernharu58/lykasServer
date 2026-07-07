const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["food", "medical", "bedding", "cleaning", "equipment", "office", "other"],
      default: "other",
      index: true,
    },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, required: true, trim: true, default: "pcs" }, // kg, pcs, bottles, etc.
    minThreshold: { type: Number, default: 5, min: 0 }, // low-stock alert level
    location: { type: String, trim: true, default: "" }, // e.g. "Main storage, Shelf B"
    supplier: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    lastRestockedAt: { type: Date, default: null },
    lastRestockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Lightweight ledger of stock movements
    movements: [
      {
        type: { type: String, enum: ["restock", "usage", "adjustment"], required: true },
        quantity: { type: Number, required: true }, // positive = added, negative = used
        note: { type: String, trim: true, default: "" },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ name: 1, category: 1 });

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
