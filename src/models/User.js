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
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    role: { 
      type: String, 
      enum: ["user", "staff", "admin", "super_admin"], 
      default: "user" 
    },
    status: {
      type: String,
      enum: ["active", "suspended", "locked"],
      default: "active"
    },
    lockedUntil: { 
      type: Date, 
      default: null 
    },
    // Tracks consecutive bad-password attempts so we can auto-lock the
    // account for 30 minutes after 5 in a row (Shichi Auth spec §3).
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    notificationsEnabled: {
      type: Boolean,
      default: false,
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
    // ── User Verification (identity/contact/address) ─────────────────────────
    // Required before an adoption application can be submitted (see
    // petController.adoptPet). Distinct from emailVerified, which only
    // confirms the email address.
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    addressConfirmed: {
      type: Boolean,
      default: false,
    },
    identityVerificationStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },
    identityVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    identityVerifiedAt: {
      type: Date,
      default: null,
    },
    identityVerificationNotes: {
      type: String,
      trim: true,
      default: "",
    },
    // ── Soft delete ─────────────────────────────────────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
