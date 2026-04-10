const Pet = require("../models/Pet");

// @desc    Fetch all pets that are either Available OR Pending
const getPets = async (_req, res) => {
  try {
    // 👉 UPDATED: Fetch pets that are either Available OR Pending
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

// @desc    Add a new pet (Usually for shelter admins)
// @route   POST /api/pets
// @access  Private (We will protect this later, keeping it open for testing now)
const createPet = async (req, res) => {
  try {
    const {
      name,
      species,
      breed,
      age,
      gender,
      weight,
      healthStatus,
      description,
      imageUrl,
    } = req.body;

    const pet = await Pet.create({
      name,
      species,
      breed,
      age,
      gender,
      weight,
      healthStatus,
      description,
      imageUrl,
    });

    res.status(201).json(pet);
  } catch (error) {
    res
      .status(400)
      .json({ message: "Failed to create pet", error: error.message });
  }
};

// @desc    Get all pets owned/adopted by the logged-in user
// @route   GET /api/pets/my-pets
// @access  Private
const getMyPets = async (req, res) => {
  try {
    // req.user.id comes from your protect middleware
    const pets = await Pet.find({ owner: req.user.id });
    res.status(200).json(pets);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
// @desc    Adopt a pet
// @route   POST /api/pets/:id/adopt
// @access  Private

// ... existing functions (getPets, getPetById, createPet, getMyPets) ...

// @desc    Apply to adopt a pet
// @route   POST /api/pets/:id/adopt
const adoptPet = async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);

    if (!pet) return res.status(404).json({ message: "Pet not found" });
    if (pet.status === "Adopted" || pet.status === "Pending") {
      return res.status(400).json({ message: "Pet is no longer available" });
    }

    // 👉 1. Set status to Pending instead of Adopted
    pet.status = "Pending";
    // 👉 2. Temporarily assign the owner field to the applicant so they can track it
    pet.owner = req.user._id;

    // (Optional: You can also save req.body.phone and req.body.address here if you add those fields to your Pet or Application model later)

    await pet.save();

    res.status(200).json({ message: `Application submitted for ${pet.name}!` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a pet's details
// @route   PUT /api/pets/:id
const updatePet = async (req, res) => {
  try {
    // Find the pet by ID and update it with the new data from the form
    const pet = await Pet.findByIdAndUpdate(req.params.id, req.body, { 
      new: true // This tells MongoDB to return the updated pet, not the old one
    });
    
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a pet permanently
// @route   DELETE /api/pets/:id
const deletePet = async (req, res) => {
  try {
    const pet = await Pet.findByIdAndDelete(req.params.id);
    if (!pet) return res.status(404).json({ message: "Pet not found" });
    
    res.status(200).json({ message: "Pet successfully removed from shelter." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPets, getPetById, createPet, getMyPets, adoptPet,updatePet,deletePet };
