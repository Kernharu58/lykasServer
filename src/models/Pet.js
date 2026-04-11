const mongoose = require("mongoose");

const petSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // 👉 FIX: Added "Other" to the allowed species
    species: { type: String, enum: ["Dog", "Cat", "Other"], required: true }, 
    breed: { type: String, required: true },
    age: { type: String, required: true }, 
    gender: { type: String, enum: ["Male", "Female"], required: true },
    
    // 👉 FIX: Added the 'size' field to catch the frontend dropdown data
    size: { type: String, enum: ["Small", "Medium", "Large"] }, 
    weight: { type: String }, 
    
    // 👉 FIX: Removed 'required: true' so it doesn't crash if omitted, and gave it a fallback default
    healthStatus: { type: String, default: "See description for medical notes" }, 
    
    description: { type: String, required: true },
    imageUrl: { type: String, required: true }, 
    status: {
      type: String,
      enum: ["Available", "Pending", "Adopted"],
      default: "Available",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, 
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Pet", petSchema);