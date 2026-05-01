const Pet = require("../models/Pet");
const AuditLog = require("../models/AuditLog");
const Application = require("../models/Application");

const createAuditLog = async ({ actor, action, targetUser, metadata }) => {
  try {
    if (!actor) return;
    await AuditLog.create({ actor, action, targetUser, metadata });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
};

// @desc    Fetch all pets that are either Available OR Pending
const getPets = async (_req, res) => {
  try {
    const pets = await Pet.find({ 
      status: { $in: ["Available", "Pending"] } 
    });
    res.status(200).json(pets);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Fetch a single pet by ID
const getPetById = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (pet) {
      res.status(200).json(pet);
    } else {
      res.status(404).json({ message: "Pet not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Add a new pet
// @route   POST /api/pets
const createPet = async (req, res) => {
  try {
    const petData = { ...req.body };

    // 👉 FIX: Map the frontend's 'type' field to the database's 'species' field
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
    // Log the exact error to your terminal so you can see what went wrong!
    console.error("🔴 Error creating pet:", error); 
    res.status(400).json({ message: "Failed to create pet", error: error.message });
  }
};

// @desc    Get all pets owned/adopted by the logged-in user
// @route   GET /api/pets/my-pets
const getMyPets = async (req, res) => {
  try {
    const pets = await Pet.find({ owner: req.user.id });
    res.status(200).json(pets);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Apply to adopt a pet
// @route   POST /api/pets/:id/adopt
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
// @route   PUT /api/pets/:id
const updatePet = async (req, res) => {
  try {
    const updateData = { ...req.body };
    const existingPet = await Pet.findById(req.params.id);

    if (!existingPet) return res.status(404).json({ message: "Pet not found" });

    // 👉 FIX: Map the frontend's 'type' field to the database's 'species' field
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
      metadata: {
        petId: pet._id,
        petName: pet.name,
        previousStatus,
        newStatus: pet.status,
      },
    });

    if (previousStatus === "Pending" && pet.status === "Adopted") {
      await createAuditLog({
        actor: req.user?._id,
        action: "ADOPTION_APPROVED",
        targetUser: pet.owner || previousOwner,
        metadata: { petId: pet._id, petName: pet.name },
      });
    }

    if (previousStatus === "Pending" && pet.status === "Available") {
      await createAuditLog({
        actor: req.user?._id,
        action: "ADOPTION_REJECTED",
        targetUser: previousOwner,
        metadata: { petId: pet._id, petName: pet.name },
      });
    }

    res.status(200).json(pet);
  } catch (error) {
    console.error("🔴 Error updating pet:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a pet permanently
// @route   DELETE /api/pets/:id
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

// 👉 NEW: Get all pending adoptions with user info
// @route   GET /api/pets/pending-adoptions
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
// @route   PUT /api/pets/applications/:id/status
const updateAdoptionApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected" });
    }

    const application = await Application.findById(req.params.id).populate("pet");
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (application.status !== "pending") {
      return res.status(400).json({ message: "This application has already been reviewed" });
    }

    const pet = await Pet.findById(application.pet._id);
    if (!pet) return res.status(404).json({ message: "Pet not found" });

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
      const otherPendingApplications = await Application.countDocuments({
        pet: pet._id,
        _id: { $ne: application._id },
        status: "pending",
      });

      if (otherPendingApplications === 0) {
        pet.status = "Available";
        pet.owner = null;
      }
    }

    await application.save();
    await pet.save();

    await createAuditLog({
      actor: req.user?._id,
      action: status === "approved" ? "ADOPTION_APPROVED" : "ADOPTION_REJECTED",
      targetUser: application.applicant,
      metadata: {
        applicationId: application._id,
        petId: pet._id,
        petName: pet.name,
        status,
      },
    });

    const updatedApplication = await Application.findById(application._id)
      .populate("applicant", "displayName email profilePicture")
      .populate("pet");

    res.status(200).json(updatedApplication);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ... keep existing functions ...

// 👉 Make sure to add it to exports!
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
