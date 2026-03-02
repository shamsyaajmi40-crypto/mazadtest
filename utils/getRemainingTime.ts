export const getRemainingTime = (endTime?: string | Date) => {
  if (!endTime) return "—";

  const end = new Date(endTime).getTime();
  if (isNaN(end)) return "—";

  const diff = end - Date.now();
  if (diff <= 0) return "انتهى";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return `${hours} : ${minutes} : ${seconds}`;
};
