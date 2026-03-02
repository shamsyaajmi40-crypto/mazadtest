import api from "./api";

export const rateAuctionUser = (data: {
  auctionId: string;
  score: number;
  reasons: string[];
  comment?: string;
}) => {
  return api.post("/ratings", data);
};
export const getAuctionRatings = (auctionId: string) =>
  api.get(`/ratings/auction/${auctionId}`);

export const getPendingRatings = () => api.get("/ratings/pending");
