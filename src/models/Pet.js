const mongoose = require("mongoose");

const petSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    species: { type: String, enum: ["Dog", "Cat"], required: true },
    breed: { type: String, required: true },
    age: { type: String, required: true }, // e.g., "2 years", "4 months"
    gender: { type: String, enum: ["Male", "Female"], required: true },
    weight: { type: String },
    healthStatus: { type: String, required: true }, // e.g., "Vaccinated, Spayed"
    description: { type: String, required: true },
    imageUrl: { type: String, required: true }, // URL from Cloudinary
    status: {
      type: String,
      enum: ["Available", "Pending", "Adopted"],
      default: "Available",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null means the pet is still in the shelter
    },
    // Optional: Track which user has adopted the pet (if status is "Adopted")
  },

  { timestamps: true },
);

module.exports = mongoose.model("Pet", petSchema);
