import multer from "multer";

// استخدام الذاكرة بدل التخزين المحلي (مهم لـ Cloudflare R2)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB - Phone photos are large
});

export default upload;