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
    // 1. Grab filters from the URL query[cite, 1]
    const { category, search } = req.query;

    // 2. Base query: Only show pets that are Available or Pending[cite, 1]
    let query = { 
      status: { $in: ["Available", "Pending"] } 
    };

    // 3. Filter by category (mapped to 'species' in DB)[cite, 1]
    if (category && category !== 'All') {
      query.species = category; 
    }

    // 4. Keyword search across 'name' and 'breed'[cite, 1]
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } }, // Case-insensitive[cite, 1]
        { breed: { $regex: search, $options: 'i' } }
      ];
    }

    // 5. Execute search[cite, 1]
    const pets = await Pet.find(query);
    res.status(200).json(pets);
  } catch (error) {
    console.error("Error fetching pets:", error);[cite, 1]
    res.status(500).json({ message: "Server Error", error: error.message });[cite, 1]
  }
};

// @desc    Fetch a single pet by ID
const getPetById = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);[cite, 1]
    if (pet) {
      res.status(200).json(pet);[cite, 1]
    } else {
      res.status(404).json({ message: "Pet not found" });[cite, 1]
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });[cite, 1]
  }
};

// @desc    Add a new pet
// @route   POST /api/pets
const createPet = async (req, res) => {
  try {
    const petData = { ...req.body };[cite, 1]

    // Map the frontend's 'type' field to the database's 'species' field[cite, 1]
    if (petData.type) {
      petData.species = petData.type;[cite, 1]
    }

    if (req.file && req.file.path) {
      petData.imageUrl = req.file.path;[cite, 1]
    }

    const pet = await Pet.create(petData);[cite, 1]

    await createAuditLog({
      actor: req.user?._id,
      action: "PET_CREATE",
      metadata: { petId: pet._id, petName: pet.name, status: pet.status },
    });[cite, 1]

    res.status(201).json(pet);[cite, 1]
  } catch (error) {
    console.error("Error creating pet:", error);[cite, 1]
    res.status(400).json({ message: "Failed to create pet", error: error.message });[cite, 1]
  }
};

// @desc    Get all pets owned/adopted by the logged-in user
const getMyPets = async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user.id });[cite, 1]
    res.status(200).json(pets);[cite, 1]
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });[cite, 1]
  }
};

// @desc    Apply to adopt a pet
const adoptPet = async (req, res) => {
  try {
    const { phone, address, experience } = req.body;[cite, 1]
    const pet = await Pet.findById(req.params.id);[cite, 1]

    if (!pet) return res.status(404).json({ message: "Pet not found" });[cite, 1]
    if (pet.status === "Adopted" || pet.status === "Pending") {
      return res.status(400).json({ message: "Pet is no longer available" });[cite, 1]
    }

    const existingApplication = await Application.findOne({
      pet: pet._id,
      applicant: req.user._id,
      status: "pending",
    });[cite, 1]

    if (existingApplication) {
      return res.status(400).json({ message: "You already have a pending application for this pet" });[cite, 1]
    }

    const application = await Application.create({
      pet: pet._id,
      applicant: req.user._id,
      phone,
      address,
      experience,
    });[cite, 1]

    pet.status = "Pending";[cite, 1]
    pet.owner = req.user._id;[cite, 1]
    await pet.save();[cite, 1]

    await createAuditLog({
      actor: req.user?._id,
      action: "ADOPTION_APPLICATION_SUBMITTED",
      targetUser: req.user._id,
      metadata: { applicationId: application._id, petId: pet._id, petName: pet.name },
    });[cite, 1]

    res.status(201).json({ message: `Application submitted for ${pet.name}!`, application });[cite, 1]
  } catch (error) {
    res.status(500).json({ message: error.message });[cite, 1]
  }
};

// @desc    Update a pet's details
const updatePet = async (req, res) => {
  try {
    const updateData = { ...req.body };[cite, 1]
    const existingPet = await Pet.findById(req.params.id);[cite, 1]

    if (!existingPet) return res.status(404).json({ message: "Pet not found" });[cite, 1]

    if (updateData.type) {
      updateData.species = updateData.type;[cite, 1]
    }

    if (req.file && req.file.path) {
      updateData.imageUrl = req.file.path;[cite, 1]
    }

    const previousStatus = existingPet.status;[cite, 1]
    const previousOwner = existingPet.owner;[cite, 1]
    Object.assign(existingPet, updateData);[cite, 1]
    const pet = await existingPet.save();[cite, 1]

    await createAuditLog({
      actor: req.user?._id,
      action: "PET_UPDATE",
      targetUser: pet.owner || previousOwner,
      metadata: { petId: pet._id, petName: pet.name, previousStatus, newStatus: pet.status },
    });[cite, 1]

    res.status(200).json(pet);[cite, 1]
  } catch (error) {
    res.status(500).json({ message: error.message });[cite, 1]
  }
};

// @desc    Delete a pet permanently
const deletePet = async (req, res) => {
  try {
    const pet = await Pet.findByIdAndDelete(req.params.id);[cite, 1]
    if (!pet) return res.status(404).json({ message: "Pet not found" });[cite, 1]

    await createAuditLog({
      actor: req.user?._id,
      action: "PET_DELETE",
      targetUser: pet.owner,
      metadata: { petId: pet._id, petName: pet.name, status: pet.status },
    });[cite, 1]
    
    res.status(200).json({ message: "Pet successfully removed from shelter." });[cite, 1]
  } catch (error) {
    res.status(500).json({ message: error.message });[cite, 1]
  }
};

// @desc    Get all pending adoptions
const getPendingAdoptions = async (req, res) => {
  try {
    const applications = await Application.find({ status: "pending" })
      .populate("applicant", "displayName email profilePicture")
      .populate("pet")
      .sort({ createdAt: -1 });[cite, 1]
      
    res.status(200).json(applications);[cite, 1]
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });[cite, 1]
  }
};

// @desc    Approve or reject an adoption application
const updateAdoptionApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;[cite, 1]

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected" });[cite, 1]
    }

    const application = await Application.findById(req.params.id).populate("pet");[cite, 1]
    if (!application) return res.status(404).json({ message: "Application not found" });[cite, 1]

    const pet = await Pet.findById(application.pet._id);[cite, 1]
    application.status = status;[cite, 1]
    application.reviewedBy = req.user._id;[cite, 1]
    application.reviewedAt = new Date();[cite, 1]

    if (status === "approved") {
      pet.status = "Adopted";[cite, 1]
      pet.owner = application.applicant;[cite, 1]
      await Application.updateMany(
        { pet: pet._id, _id: { $ne: application._id }, status: "pending" },
        { status: "rejected", reviewedBy: req.user._id, reviewedAt: new Date() },
      );[cite, 1]
    } else {
      pet.status = "Available";[cite, 1]
      pet.owner = null;[cite, 1]
    }

    await application.save();[cite, 1]
    await pet.save();[cite, 1]

    res.status(200).json(application);[cite, 1]
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });[cite, 1]
  }
};

module.exports = {
  getPets,
  getPetById,
  createPet,
  getMyPets,
  adoptPet,
  updatePet,
  deletePet,
  getPendingAdoptions,
  updateAdoptionApplicationStatus,
};