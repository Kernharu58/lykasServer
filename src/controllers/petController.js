const Pet = require("../models/Pet");

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
    const pet = await Pet.findById(req.params.id);

    if (!pet) return res.status(404).json({ message: "Pet not found" });
    if (pet.status === "Adopted" || pet.status === "Pending") {
      return res.status(400).json({ message: "Pet is no longer available" });
    }

    pet.status = "Pending";
    pet.owner = req.user._id;

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
    const updateData = { ...req.body };

    // 👉 FIX: Map the frontend's 'type' field to the database's 'species' field
    if (updateData.type) {
      updateData.species = updateData.type;
    }

    if (req.file && req.file.path) {
      updateData.imageUrl = req.file.path;
    }

    const pet = await Pet.findByIdAndUpdate(req.params.id, updateData, { 
      new: true 
    });
    
    if (!pet) return res.status(404).json({ message: "Pet not found" });
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
    
    res.status(200).json({ message: "Pet successfully removed from shelter." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPets, getPetById, createPet, getMyPets, adoptPet, updatePet, deletePet };