import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,   // ⭐⭐⭐ مهم جداً مع Cloudflare R2
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

export const uploadToR2 = async (file) => {
  // 📁 توليد اسم ملف بصيغة webp
  const fileName = Date.now() + "-" + file.originalname.split(".")[0] + ".webp";

  // 🚀 معالجة الصورة باستخدام sharp
  const compressedBuffer = await sharp(file.buffer)
    .rotate() // تصحيح اتجاه الصورة تلقائياً (مهم لصور الهاتف)
    .resize(1200, null, { withoutEnlargement: true }) // العرض الأقصى 1200 مع الحفاظ على التناسب
    .webp({ quality: 75, effort: 6 }) // التحويل لـ webp بجودة 75 مع ضغط أعلى
    .toBuffer();

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: fileName,
    Body: compressedBuffer,
    ContentType: "image/webp",
  });

  await s3.send(command);

  return `${process.env.R2_PUBLIC_URL}/${fileName}`;
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

    await s3.send(command);
    console.log(`✅ Deleted from R2: ${key}`);
  } catch (error) {
    console.error(`❌ Failed to delete from R2: ${fileUrl}`, error);
  }
};