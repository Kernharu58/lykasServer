const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

console.log("🔍 Checking Cloudinary Keys...");

console.log("API Key:", process.env.CLOUDINARY_API_KEY ? "Loaded ✅" : "Missing ❌");
// 1. Configure Cloudinary with your credentials (put these in your .env file!)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Set up the Multer storage engine to push files directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "carepaws_profiles", // The folder name in your Cloudinary dashboard
    allowed_formats: ["jpg", "png", "jpeg"],
    transformation: [{ width: 500, height: 500, crop: "limit" }], // Compress it a bit
  },
});

// 3. Create the upload middleware
const upload = multer({
  storage: storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 5 * 1024 * 1024),
  },
});

module.exports = { upload, cloudinary };
