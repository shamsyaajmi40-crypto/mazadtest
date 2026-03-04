export const getImageUrl = (path?: string) => {
  if (!path || path.includes("undefined")) return "https://placehold.co/600x400/f8fafc/64748b?text=MAZAD";

  // ✅ إذا الرابط كامل (R2)
  if (path.startsWith("http")) {
    return path;
  }

  // ✅ الصور القديمة من السيرفر
  return `${import.meta.env.VITE_API_URL}${path}`;
};