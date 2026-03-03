export const getImageUrl = (path?: string) => {
  if (!path || path.includes("undefined")) return "/placeholder.png";

  // ✅ إذا الرابط كامل (R2)
  if (path.startsWith("http")) {
    return path;
  }

  // ✅ الصور القديمة من السيرفر
  return `${import.meta.env.VITE_API_URL}${path}`;
};