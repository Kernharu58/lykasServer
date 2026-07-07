const Shelter = require("../models/Shelter");
const AuditLog = require("../models/AuditLog");

const logAction = async ({ actor, action, metadata }) => {
  try {
    await AuditLog.create({ actor, action, metadata });
  } catch (e) {
    /* silent */
  }
};

// ─── Get all shelters/facilities ───────────────────────────────────────────────
// GET /api/shelters?status=active
const getAllShelters = async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const shelters = await Shelter.find(filter)
      .populate("manager", "displayName email")
      .sort({ name: 1 });

    res.status(200).json(shelters);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Get single shelter ─────────────────────────────────────────────────────────
// GET /api/shelters/:id
const getShelterById = async (req, res) => {
  try {
    const shelter = await Shelter.findById(req.params.id).populate("manager", "displayName email");
    if (!shelter) return res.status(404).json({ message: "Shelter not found" });
    res.status(200).json(shelter);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Create shelter ─────────────────────────────────────────────────────────────
// POST /api/shelters
const createShelter = async (req, res) => {
  try {
    const {
      name, address, coordinates, contactPerson, contactPhone, contactEmail,
      capacity, type, operatingHours, notes, manager,
    } = req.body;

    if (!name || !address || capacity === undefined) {
      return res.status(400).json({ message: "Name, address, and capacity are required" });
    }

    const shelter = await Shelter.create({
      name, address, coordinates, contactPerson, contactPhone, contactEmail,
      capacity, type, operatingHours, notes, manager: manager || null,
      createdBy: req.user._id,
    });

    await logAction({ actor: req.user._id, action: "SHELTER_CREATED", metadata: { shelterId: shelter._id, name } });
    res.status(201).json({ message: "Shelter created", shelter });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Update shelter ─────────────────────────────────────────────────────────────
// PUT /api/shelters/:id
const updateShelter = async (req, res) => {
  try {
    const shelter = await Shelter.findById(req.params.id);
    if (!shelter) return res.status(404).json({ message: "Shelter not found" });

    const fields = [
      "name", "address", "coordinates", "contactPerson", "contactPhone", "contactEmail",
      "capacity", "currentOccupancy", "type", "status", "operatingHours", "notes", "manager",
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) shelter[f] = req.body[f];
    });

    // Auto-flag at_capacity if occupancy reaches capacity
    if (shelter.status !== "under_maintenance" && shelter.status !== "inactive") {
      shelter.status = shelter.currentOccupancy >= shelter.capacity && shelter.capacity > 0 ? "at_capacity" : "active";
    }

    await shelter.save();
    await logAction({ actor: req.user._id, action: "SHELTER_UPDATED", metadata: { shelterId: shelter._id } });
    res.status(200).json({ message: "Shelter updated", shelter });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Delete shelter ─────────────────────────────────────────────────────────────
// DELETE /api/shelters/:id
const deleteShelter = async (req, res) => {
  try {
    const shelter = await Shelter.findByIdAndDelete(req.params.id);
    if (!shelter) return res.status(404).json({ message: "Shelter not found" });

    await logAction({ actor: req.user._id, action: "SHELTER_DELETED", metadata: { shelterId: shelter._id, name: shelter.name } });
    res.status(200).json({ message: "Shelter deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Summary stats for dashboard cards ────────────────────────────────────────
// GET /api/shelters/summary
const getSummary = async (req, res) => {
  try {
    const shelters = await Shelter.find({}, "capacity currentOccupancy status");
    const totalCapacity = shelters.reduce((sum, s) => sum + s.capacity, 0);
    const totalOccupancy = shelters.reduce((sum, s) => sum + s.currentOccupancy, 0);
    const atCapacity = shelters.filter((s) => s.status === "at_capacity").length;

    res.status(200).json({
      totalShelters: shelters.length,
      totalCapacity,
      totalOccupancy,
      utilizationRate: totalCapacity ? Math.round((totalOccupancy / totalCapacity) * 100) : 0,
      atCapacity,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  getAllShelters,
  getShelterById,
  createShelter,
  updateShelter,
  deleteShelter,
  getSummary,
};
