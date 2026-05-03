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
    // 1. Grab filters from the URL query
    const { category, search } = req.query;

    // 2. Base query: Only show pets that are Available or Pending
    let query = { 
      status: { $in: ["Available", "Pending"] } 
    };

    // 3. Filter by category (mapped to 'species' in DB)
    if (category && category !== 'All') {
      query.species = category; 
    }

    // 4. Keyword search across 'name' and 'breed'
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } }, // Case-insensitive
        { breed: { $regex: search, $options: 'i' } }
      ];
    }

    // 5. Execute search
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

// @desc    Apply to adopt a pet
const adoptPet = async (req, res) => {
  try {
    const { phone, address, experience } = req.body;
    const pet = await Pet.findById(req.params.id);

    if (!pet) return res.status(404).json({ message: "Pet not found" });
    if (pet.status === "Adopted" || pet.status === "Pending") {
      return res.status(400).json({ message: "Pet is no longer available" });
    }

    const existingApplication = await Application.findOne({
      pet: pet._id,
      applicant: req.user._id,
      status: "pending",
    });

    if (existingApplication) {
      return res.status(400).json({ message: "You already have a pending application for this pet" });
    }

    const application = await Application.create({
      pet: pet._id,
      applicant: req.user._id,
      phone,
      address,
      experience,
    });

    pet.status = "Pending";
    pet.owner = req.user._id;
    await pet.save();

    await createAuditLog({
      actor: req.user?._id,
      action: "ADOPTION_APPLICATION_SUBMITTED",
      targetUser: req.user._id,
      metadata: { applicationId: application._id, petId: pet._id, petName: pet.name },
    });

    res.status(201).json({ message: `Application submitted for ${pet.name}!`, application });
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

// @desc    Get all pending adoptions
const getPendingAdoptions = async (req, res) => {
  try {
    const applications = await Application.find({ status: "pending" })
      .populate("applicant", "displayName email profilePicture")
      .populate("pet")
      .sort({ createdAt: -1 });
      
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Approve or reject an adoption application
const updateAdoptionApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected" });
    }

    const application = await Application.findById(req.params.id).populate("pet");
    if (!application) return res.status(404).json({ message: "Application not found" });

    const pet = await Pet.findById(application.pet._id);
    application.status = status;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();

    if (status === "approved") {
      pet.status = "Adopted";
      pet.owner = application.applicant;
      await Application.updateMany(
        { pet: pet._id, _id: { $ne: application._id }, status: "pending" },
        { status: "rejected", reviewedBy: req.user._id, reviewedAt: new Date() },
      );
    } else {
      pet.status = "Available";
      pet.owner = null;
    }

    await application.save();
    await pet.save();

    res.status(200).json(application);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
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
