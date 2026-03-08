import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import fs from "fs/promises";

let s3Instance = null;
const getS3 = () => {
  if (s3Instance) return s3Instance;

  let rawEndpoint = (process.env.R2_ENDPOINT || "").trim();

  // 1. Remove all spaces
  let cleaned = rawEndpoint.replace(/\s+/g, "");

  // 2. Remove any pre-existing protocol
  cleaned = cleaned.replace(/^https?:\/\//i, "");

  // 3. Remove trailing slash if exists
  cleaned = cleaned.replace(/\/+$/, "");

  // 4. Critical check: If after cleaning we only have "http" or "https" or empty, it's invalid
  if (!cleaned || cleaned === "http" || cleaned === "https") {
    console.error("❌ R2_ENDPOINT is invalid! Current raw value:", rawEndpoint, "Cleaned:", cleaned);
    return null;
  }

  // 5. Construct final endpoint
  let endpoint = `https://${cleaned}`;

  console.log("🛠️ R2 Client Init - Final Sanitized Endpoint:", endpoint);

  s3Instance = new S3Client({
    region: "auto",
    endpoint: endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: (process.env.R2_ACCESS_KEY || "").trim(),
      secretAccessKey: (process.env.R2_SECRET_KEY || "").trim(),
    }
  });
  return s3Instance;
};

export const uploadToR2 = async (file) => {
  // 📁 توليد اسم ملف بصيغة webp
  const fileName = Date.now() + "-" + file.originalname.split(".")[0] + ".webp";

  try {
    // 🚀 معالجة الصورة باستخدام sharp (يدعم buffer أو path)
    const source = file.path || file.buffer;

    if (!source) {
      throw new Error("No file content or path provided for upload");
    }

    const compressedBuffer = await sharp(source)
      .rotate() // تصحيح اتجاه الصورة تلقائياً (مهم لصور الهاتف)
      .resize(1200, null, { withoutEnlargement: true }) // العرض الأقصى 1200 مع الحفاظ على التناسب
      .webp({ quality: 75, effort: 6 }) // التحويل لـ webp بجودة 75 مع ضغط أعلى
      .toBuffer();

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: fileName,
      Body: compressedBuffer,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    });

    const s3 = getS3();
    if (!s3) {
      throw new Error("S3 storage client is not initialized. Please check R2_ENDPOINT environment variable.");
    }
    await s3.send(command);

    return `${process.env.R2_PUBLIC_URL}/${fileName}`;
  } finally {
    // 🛠️ تنظيف الملف المؤقت من الخادم فوراً (إذا كان diskStorage)
    if (file.path) {
      fs.unlink(file.path).catch(err =>
        console.error(`⚠️ Failed to delete temp file ${file.path}:`, err)
      );
    }
  }
};


export const deleteFromR2 = async (fileUrl) => {
  try {
    if (!fileUrl) return;

    // استخراج اسم الملف من الرابط (الرابط ينتهي بـ /filename.webp)
    const urlParts = fileUrl.split("/");
    const key = urlParts[urlParts.length - 1];

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    });

    const s3 = getS3();
    if (!s3) {
      throw new Error("S3 storage client is not initialized for deletion.");
    }
    await s3.send(command);
    console.log(`✅ Deleted from R2: ${key}`);
  } catch (error) {
    console.error(`❌ Failed to delete from R2: ${fileUrl}`, error);
  }
};