const InventoryItem = require("../models/InventoryItem");
const AuditLog = require("../models/AuditLog");

const logAction = async ({ actor, action, metadata }) => {
  try {
    await AuditLog.create({ actor, action, metadata });
  } catch (e) {
    /* silent */
  }
};

// ─── Get all items (with optional category/low-stock filter) ─────────────────
// GET /api/inventory?category=food&lowStock=true&search=kibble
const getAllItems = async (req, res) => {
  try {
    const { category, lowStock, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (search) filter.name = { $regex: search, $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);
    let items = await InventoryItem.find(filter)
      .populate("lastRestockedBy", "displayName")
      .sort({ name: 1 })
      .skip(skip)
      .limit(Number(limit));

    if (lowStock === "true") {
      items = items.filter((i) => i.quantity <= i.minThreshold);
    }

    const total = await InventoryItem.countDocuments(filter);

    res.status(200).json({
      items,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Get single item ───────────────────────────────────────────────────────────
// GET /api/inventory/:id
const getItemById = async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id)
      .populate("lastRestockedBy", "displayName")
      .populate("movements.actor", "displayName");
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Create item ───────────────────────────────────────────────────────────────
// POST /api/inventory
const createItem = async (req, res) => {
  try {
    const { name, category, quantity, unit, minThreshold, location, supplier, notes } = req.body;
    if (!name || !unit) {
      return res.status(400).json({ message: "Name and unit are required" });
    }

    const item = await InventoryItem.create({
      name,
      category,
      quantity: quantity || 0,
      unit,
      minThreshold,
      location,
      supplier,
      notes,
      createdBy: req.user._id,
      lastRestockedAt: quantity > 0 ? new Date() : null,
      lastRestockedBy: quantity > 0 ? req.user._id : null,
      movements: quantity > 0 ? [{ type: "restock", quantity, note: "Initial stock", actor: req.user._id }] : [],
    });

    await logAction({ actor: req.user._id, action: "INVENTORY_ITEM_CREATED", metadata: { itemId: item._id, name } });
    res.status(201).json({ message: "Item created", item });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Update item details (not quantity — use adjustStock for that) ───────────
// PUT /api/inventory/:id
const updateItem = async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const { name, category, unit, minThreshold, location, supplier, notes } = req.body;
    if (name !== undefined) item.name = name;
    if (category !== undefined) item.category = category;
    if (unit !== undefined) item.unit = unit;
    if (minThreshold !== undefined) item.minThreshold = minThreshold;
    if (location !== undefined) item.location = location;
    if (supplier !== undefined) item.supplier = supplier;
    if (notes !== undefined) item.notes = notes;

    await item.save();
    await logAction({ actor: req.user._id, action: "INVENTORY_ITEM_UPDATED", metadata: { itemId: item._id } });
    res.status(200).json({ message: "Item updated", item });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Adjust stock (restock, usage, or manual correction) ─────────────────────
// POST /api/inventory/:id/adjust
// { type: 'restock' | 'usage' | 'adjustment', quantity, note }
const adjustStock = async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const { type, quantity, note } = req.body;
    if (!["restock", "usage", "adjustment"].includes(type)) {
      return res.status(400).json({ message: "Invalid movement type" });
    }
    const qty = Number(quantity);
    if (!qty) return res.status(400).json({ message: "Quantity is required" });

    const delta = type === "usage" ? -Math.abs(qty) : Math.abs(qty) * (type === "adjustment" && qty < 0 ? -1 : 1);
    const newQuantity = item.quantity + (type === "adjustment" ? qty : delta);
    if (newQuantity < 0) {
      return res.status(400).json({ message: "Resulting quantity cannot be negative" });
    }

    item.quantity = newQuantity;
    item.movements.push({ type, quantity: type === "adjustment" ? qty : delta, note: note || "", actor: req.user._id });
    if (type === "restock") {
      item.lastRestockedAt = new Date();
      item.lastRestockedBy = req.user._id;
    }

    await item.save();
    await logAction({
      actor: req.user._id,
      action: "INVENTORY_STOCK_ADJUSTED",
      metadata: { itemId: item._id, type, quantity: qty, newQuantity: item.quantity },
    });

    res.status(200).json({ message: "Stock updated", item });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Delete item ───────────────────────────────────────────────────────────────
// DELETE /api/inventory/:id
const deleteItem = async (req, res) => {
  try {
    const item = await InventoryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    await logAction({ actor: req.user._id, action: "INVENTORY_ITEM_DELETED", metadata: { itemId: item._id, name: item.name } });
    res.status(200).json({ message: "Item deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Summary stats for dashboard cards ────────────────────────────────────────
// GET /api/inventory/summary
const getSummary = async (req, res) => {
  try {
    const [totalItems, allItems] = await Promise.all([
      InventoryItem.countDocuments({}),
      InventoryItem.find({}, "quantity minThreshold category"),
    ]);

    const lowStockCount = allItems.filter((i) => i.quantity <= i.minThreshold).length;
    const outOfStockCount = allItems.filter((i) => i.quantity === 0).length;

    const byCategory = allItems.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({ totalItems, lowStockCount, outOfStockCount, byCategory });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  adjustStock,
  deleteItem,
  getSummary,
};
