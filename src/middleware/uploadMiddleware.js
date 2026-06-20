const multer = require("multer");

// Memory storage: keeps the file as a Buffer (req.file.buffer)
// so the controller can stream it to Cloudinary itself
// (needed for handling both images and raw files like PDFs).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024), // 10MB default
  },
});

module.exports = upload;
