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
    role: { 
      type: String, 
      enum: ["user", "admin"], 
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
  { timestamps: true } // This must be the second argument
);

module.exports = mongoose.model("User", userSchema);