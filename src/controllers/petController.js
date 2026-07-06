const Pet = require("../models/Pet");
const AuditLog = require("../models/AuditLog");
const Application = require("../models/Application");

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
    let query = { status: { $in: ["Available", "Pending"] } };
    if (category && category !== 'All') query.species = category;
    if (size && size !== 'All') query.size = size;
    if (age && age !== 'All') query.age = { $regex: age, $options: 'i' };
    if (temperament && temperament !== 'All') query.temperament = temperament;
    if (energyLevel && energyLevel !== 'All') query.energyLevel = energyLevel;
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { breed: { $regex: search, $options: 'i' } }];
    const pets = await Pet.find(query);
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

// @desc    Delete a pet permanently
const deletePet = async (req, res) => {
  try {
    const pet = await Pet.findByIdAndDelete(req.params.id);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

    await createAuditLog({
      actor: req.user?._id,
      action: "PET_DELETE",
      targetUser: pet.owner,
      metadata: { petId: pet._id, petName: pet.name, status: pet.status },
    });
    
    res.status(200).json({ message: "Pet successfully removed from shelter." });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
};
