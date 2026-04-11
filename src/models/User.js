const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    displayName: { 
      type: String, 
      required: [true, "Display name is required"], 
      trim: true 
    },
    email: { 
      type: String, 
      required: [true, "Email is required"], 
      unique: true, 
      lowercase: true 
    },
    password: { 
      type: String, 
      required: [true, "Password is required"], 
      minlength: [8, "Password must be at least 8 characters"] 
    },
    // 👉 FIX: Added "staff" to the allowed roles
    role: { 
      type: String, 
      enum: ["user", "staff", "admin"], 
      default: "user" 
    },
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pet",
      },
    ],
    volunteerHours: { 
      type: Number, 
      default: 0 
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);