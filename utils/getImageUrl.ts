export const getImageUrl = (path?: string) => {
  if (!path) return "/placeholder.png";
  return `${import.meta.env.VITE_API_URL}${path}`;
};
