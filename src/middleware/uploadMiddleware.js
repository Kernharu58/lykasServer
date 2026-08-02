const multer = require("multer");

// Files under this limit AND on this allowlist are accepted; everything else
// is rejected by multer's fileFilter before the buffer is ever read into
// memory or streamed to Cloudinary. Previously this middleware validated
// size only — any file type (including .exe/.html) was accepted as long as
// it was under MAX_FILE_SIZE.
//
// Covers both real call sites of this shared middleware:
//   - userDocumentRoutes.js (government ID, proof of address/income, house
//     photo, signed agreement — images and PDFs)
//   - fileAssetRoutes.js (general admin file uploads: images, medical
//     records, adoption documents, etc.)
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

const getExtension = (filename = "") => {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
};

const fileFilter = (req, file, cb) => {
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.includes(getExtension(file.originalname));

  // Require both to agree — a file with a spoofed extension but a
  // browser-reported MIME type that doesn't match it (or vice versa) is
  // rejected rather than trusting either signal alone.
  if (!mimeOk || !extOk) {
    const err = new Error(
      `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
    err.status = 400;
    err.code = "UNSUPPORTED_FILE_TYPE";
    return cb(err);
  }

  cb(null, true);
};

// Memory storage: keeps the file as a Buffer (req.file.buffer)
// so the controller can stream it to Cloudinary itself
// (needed for handling both images and raw files like PDFs).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024), // 10MB default
  },
  fileFilter,
});

module.exports = upload;
