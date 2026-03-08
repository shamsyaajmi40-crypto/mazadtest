import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "backend", "uploads", "tmp");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a secure, unique filename
    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_MIMETYPES = ["image/jpeg", "image/png", "image/webp"];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG and WEBP image files are allowed"), false);
  }
};

const createImageUpload = ({ fileSize, files }) =>
  multer({
    storage,
    fileFilter,
    limits: {
      fileSize,
      files,
      parts: files + 10,
      fields: 10,
    },
  });

// Safer defaults for single-image uploads (e.g., receipts).
export const receiptUpload = createImageUpload({
  fileSize: 4 * 1024 * 1024, // 4MB
  files: 1,
});

// Auction images can still be multiple, but with tighter caps.
export const auctionImageUpload = createImageUpload({
  fileSize: 5 * 1024 * 1024, // 5MB
  files: 6,
});


export default receiptUpload;
