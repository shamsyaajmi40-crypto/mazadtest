import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const createImageUpload = ({ fileSize, files }) =>
  multer({
    storage,
    fileFilter,
    limits: {
      fileSize,
      files,
      // Bound multipart parsing work to reduce memory/CPU abuse.
      parts: files + 10,
      fields: 10,
    },
  });

// Safer defaults for single-image uploads (e.g., receipts).
export const receiptUpload = createImageUpload({
  fileSize: 4 * 1024 * 1024,
  files: 1,
});

// Auction images can still be multiple, but with tighter caps.
export const auctionImageUpload = createImageUpload({
  fileSize: 5 * 1024 * 1024,
  files: 6,
});

export default receiptUpload;
