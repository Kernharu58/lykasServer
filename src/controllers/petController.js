const Pet = require("../models/Pet");
const AuditLog = require("../models/AuditLog");
const Application = require("../models/Application");
const { logChange, getRecordHistory } = require("../utils/auditLogger");
const { buildListQuery, buildPagination } = require("../utils/queryBuilder");
const { sendCsv, sendExcel, sendPdf } = require("../utils/exportUtil");
const { cacheGet, cacheSet, cacheDeleteByPrefix } = require("../utils/cache");

const PETS_LIST_CACHE_PREFIX = "pets:list:";
const PETS_LIST_CACHE_TTL_SECONDS = 60; // short TTL: a just-adopted pet showing as
  // "Available" for up to a minute is an acceptable trade-off for cutting DB load
  // on the public catalog; every write path below also actively invalidates.

// Every write to a Pet (create/update/delete/restore/permanent-delete/adopt)
// can change what the public catalog should show, and we cache one entry per
// distinct query-string combination — so instead of guessing which cached
// combinations are now stale, just clear the whole "pets:list:" family.
const invalidatePetsListCache = () => cacheDeleteByPrefix(PETS_LIST_CACHE_PREFIX);

// Helper for internal logging
const createAuditLog = async ({ actor, action, targetUser, metadata }) => {
  try {
    if (!actor) return;
    await AuditLog.create({ actor, action, targetUser, metadata });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
};

// @desc    Fetch all pets that are Available or Pending (with optional filters)
// @route   GET /api/pets
const getPets = async (req, res) => {
  try {
    const { category, search, size, age, temperament, energyLevel } = req.query;
    const cacheKey = `${PETS_LIST_CACHE_PREFIX}${JSON.stringify(req.query)}`;

    const cached = await cacheGet(cacheKey);
    if (cached) return res.status(200).json(cached);

    let query = { status: { $in: ["Available", "Pending"] }, isDeleted: { $ne: true } };
    if (category && category !== 'All') query.species = category;
    if (size && size !== 'All') query.size = size;
    if (age && age !== 'All') query.age = { $regex: age, $options: 'i' };
    if (temperament && temperament !== 'All') query.temperament = temperament;
    if (energyLevel && energyLevel !== 'All') query.energyLevel = energyLevel;
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { breed: { $regex: search, $options: 'i' } }];
    const pets = await Pet.find(query);

    await cacheSet(cacheKey, pets, PETS_LIST_CACHE_TTL_SECONDS);
    res.status(200).json(pets);
  } catch (error) {
    console.error("Error fetching pets:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Fetch a single pet by ID
const getPetById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid pet ID format" });
    }
    
    const pet = await Pet.findById(id);
    if (pet) {
      res.status(200).json(pet);
    } else {
      res.status(404).json({ message: "Pet not found" });
    }
  } catch (error) {
    console.error("Error fetching pet by ID:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Add a new pet
// @route   POST /api/pets
const createPet = async (req, res) => {
  try {
    const petData = { ...req.body };

    // Map the frontend's 'type' field to the database's 'species' field
    if (petData.type) {
      petData.species = petData.type;
    }

    if (req.file && req.file.path) {
      petData.imageUrl = req.file.path;
    }

    const pet = await Pet.create(petData);
    await invalidatePetsListCache();

    await createAuditLog({
      actor: req.user?._id,
      action: "PET_CREATE",
      metadata: { petId: pet._id, petName: pet.name, status: pet.status },
    });

    res.status(201).json(pet);
  } catch (error) {
    console.error("Error creating pet:", error);
    res.status(400).json({ message: "Failed to create pet", error: error.message });
  }
};

// @desc    Get all pets owned/adopted by the logged-in user
const getMyPets = async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user.id });
    res.status(200).json(pets);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Apply to adopt OR foster a pet
// @route   POST /api/pets/:id/adopt
// Body: { phone, address, experience, type?, fosterPeriod? }
const adoptPet = async (req, res) => {
  try {
    const { phone, address, experience, type = "adoption", fosterPeriod, householdSize, isRenting, landlordApproval } = req.body;
    const pet = await Pet.findById(req.params.id);

    if (!pet) return res.status(404).json({ message: "Pet not found" });
    if (pet.status === "Adopted") {
      return res.status(400).json({ message: "Pet has already been adopted" });
    }
    // Foster applications are allowed even when pet is Pending adoption
    if (type === "adoption" && pet.status === "Pending") {
      return res.status(400).json({ message: "Pet already has a pending adoption application" });
    }

    // Adoption applications require a verified identity first (see User Verification
    // workflow). Fostering is intentionally exempt — it has its own lighter-weight vetting.
    if (type === "adoption" && req.user.identityVerificationStatus !== "verified") {
      return res.status(403).json({
        message: "Please complete identity verification before applying to adopt.",
        code: "IDENTITY_NOT_VERIFIED",
      });
    }

    // Prevent duplicate applications of the same type by the same user
    const existingApplication = await Application.findOne({
      pet: pet._id,
      applicant: req.user._id,
      type,
      status: "pending",
    });

    if (existingApplication) {
      return res.status(400).json({ message: `You already have a pending ${type} application for this pet` });
    }

    const application = await Application.create({
      pet: pet._id,
      applicant: req.user._id,
      phone,
      address,
      experience,
      householdSize: householdSize ? parseInt(householdSize) : null,
      isRenting: Boolean(isRenting),
      landlordApproval: Boolean(landlordApproval),
      type,
      fosterPeriod: type === "foster" ? (fosterPeriod || null) : null,
    });

    // Only mark Pending for adoption-type applications
    if (type === "adoption") {
      pet.status = "Pending";
      pet.owner = req.user._id;
      await pet.save();
      await invalidatePetsListCache();
    }

    await createAuditLog({
      actor: req.user?._id,
      action: type === "foster" ? "FOSTER_APPLICATION_SUBMITTED" : "ADOPTION_APPLICATION_SUBMITTED",
      targetUser: req.user._id,
      metadata: { applicationId: application._id, petId: pet._id, petName: pet.name, type },
    });

    res.status(201).json({
      message: `${type === "foster" ? "Foster" : "Adoption"} application submitted for ${pet.name}!`,
      application,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a pet's details
const updatePet = async (req, res) => {
  try {
    const updateData = { ...req.body };
    const existingPet = await Pet.findById(req.params.id);

    if (!existingPet) return res.status(404).json({ message: "Pet not found" });

    if (updateData.type) {
      updateData.species = updateData.type;
    }

    if (req.file && req.file.path) {
      updateData.imageUrl = req.file.path;
    }

    const previousStatus = existingPet.status;
    const previousOwner = existingPet.owner;
    Object.assign(existingPet, updateData);
    const pet = await existingPet.save();
    await invalidatePetsListCache();

    await createAuditLog({
      actor: req.user?._id,
      action: "PET_UPDATE",
      targetUser: pet.owner || previousOwner,
      metadata: { petId: pet._id, petName: pet.name, previousStatus, newStatus: pet.status },
    });

    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Soft-delete a pet (recoverable). Use /permanent for a hard delete.
const deletePet = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    if (pet.isDeleted) return res.status(400).json({ message: "Pet is already deleted" });

    pet.isDeleted = true;
    pet.deletedAt = new Date();
    pet.deletedBy = req.user?._id || null;
    await pet.save();
    await invalidatePetsListCache();

    await logChange({
      actor: req.user?._id,
      action: "PET_SOFT_DELETE",
      entityType: "Pet",
      entityId: pet._id,
      before: { isDeleted: false },
      after: { isDeleted: true },
      req,
      targetUser: pet.owner,
      metadata: { petId: pet._id, petName: pet.name },
    });

    res.status(200).json({ message: "Pet moved to Deleted (recoverable from Archive)." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Restore a soft-deleted pet
// @route   POST /api/pets/:id/restore
const restorePet = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    if (!pet.isDeleted) return res.status(400).json({ message: "Pet is not deleted" });

    pet.isDeleted = false;
    pet.deletedAt = null;
    pet.deletedBy = null;
    await pet.save();
    await invalidatePetsListCache();

    await logChange({
      actor: req.user?._id,
      action: "PET_RESTORE",
      entityType: "Pet",
      entityId: pet._id,
      before: { isDeleted: true },
      after: { isDeleted: false },
      req,
      metadata: { petId: pet._id, petName: pet.name },
    });

    res.status(200).json({ message: "Pet restored.", pet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Permanently delete a pet (irreversible) — super_admin only, gated in routes
// @route   DELETE /api/pets/:id/permanent
const permanentlyDeletePet = async (req, res) => {
  try {
    const pet = await Pet.findByIdAndDelete(req.params.id);
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    await invalidatePetsListCache();

    await logChange({
      actor: req.user?._id,
      action: "PET_PERMANENT_DELETE",
      entityType: "Pet",
      entityId: pet._id,
      before: { name: pet.name, status: pet.status },
      after: null,
      req,
      metadata: { petId: pet._id, petName: pet.name },
    });

    res.status(200).json({ message: "Pet permanently deleted." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin list — search/sort/filter/pagination, includes Adopted/Foster/
//          deleted (with ?includeDeleted=true) unlike the public getPets above.
// @route   GET /api/pets/admin?q=&species=&status=&sortBy=&sortOrder=&page=&limit=&includeDeleted=
const getAllPetsAdmin = async (req, res) => {
  try {
    const { filter, sort, skip, limit, page } = buildListQuery(req.query, {
      searchFields: ["name", "breed", "description"],
      filterFields: ["species", "status", "gender", "size"],
      softDelete: true,
    });

    const [pets, total] = await Promise.all([
      Pet.find(filter).populate("owner", "displayName email").sort(sort).skip(skip).limit(limit),
      Pet.countDocuments(filter),
    ]);

    res.status(200).json({ pets, pagination: buildPagination(total, page, limit) });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Export pets as CSV/Excel/PDF
// @route   GET /api/pets/export?format=csv
const exportPets = async (req, res) => {
  try {
    const { filter } = buildListQuery(req.query, {
      searchFields: ["name", "breed"],
      filterFields: ["species", "status"],
      softDelete: true,
    });
    const format = (req.query.format || "csv").toLowerCase();
    const pets = await Pet.find(filter).populate("owner", "displayName email").sort("-createdAt");

    const rows = pets.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      species: p.species,
      breed: p.breed,
      age: p.age,
      gender: p.gender,
      status: p.status,
      owner: p.owner?.displayName || "",
      createdAt: p.createdAt?.toISOString(),
    }));

    if (format === "excel" || format === "xlsx") return sendExcel(res, "pets.xlsx", rows);
    if (format === "pdf") return sendPdf(res, "pets.pdf", "Pets Export", rows);
    return sendCsv(res, "pets.csv", rows);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Per-record audit history for a pet
// @route   GET /api/pets/:id/history
const getPetHistory = async (req, res) => {
  try {
    const history = await getRecordHistory("Pet", req.params.id, req.query);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// NOTE: getPendingAdoptions / updateAdoptionApplicationStatus used to live
// here as a second, divergent implementation of approve/reject. They were
// dead code (the admin panel and mobile app only ever called the
// /api/applications/:id/status endpoint in applicationController), but their
// presence meant two different functions could disagree about how to handle
// foster vs. adoption applications. Removed in favor of a single source of
// truth: applicationController.updateApplicationStatus (which now handles
// both types correctly). See routes/applicationRoutes.js and
// routes/petRoutes.js.

module.exports = {
  getPets,
  getPetById,
  createPet,
  getMyPets,
  adoptPet,
  updatePet,
  deletePet,
  restorePet,
  permanentlyDeletePet,
  getAllPetsAdmin,
  exportPets,
  getPetHistory,
};
