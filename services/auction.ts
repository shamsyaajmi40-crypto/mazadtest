import api from "./api";



// New function to get user's bids
export const getMyBids = () => {
  return api.get("/auctions/bids");
};
// Function to get all auctions with pagination
export const getAuctions = (params?: any) => {
  return api.get("/auctions", { params });
};

// Function to get completed auctions with filter
export const getAuctionDetails = (id: string) => {
  return api.get(`/auctions/${id}`);
};

// Function to get completed auctions with filter
export const getWonAuctions = async () => {
  const res = await api.get("/auctions/won");
  console.log("WON AUCTIONS RESPONSE:", res.data);
  return res;
};

// Function to get completed auctions with filter
export const placeBid = (id: string, amount: number) => {
  return api.post(`/auctions/${id}/bid`, { amount });
};
// Function to get completed auctions with filter
export const getMyAuctions = () => {
  return api.get("/auctions/my");
};
// Function to get completed auctions with filter
export const createAuction = (data: FormData) =>
  api.post("/auctions", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const getUpcomingAuctions = async () => {
  const res = await api.get("/auctions/upcoming");
  return res.data;
};

export const featureAuction = (id: string, duration: string) => {
  return api.post(`/auctions/${id}/feature`, { duration });
};

export const getFeaturedAuctions = async () => {
  const res = await api.get("/auctions/featured");
  return res.data;
};

export const getMyOpenDeals = () => {
  return api.get("/auctions/deals/open");
};

export const getCreateAuctionDepositPreview = async (startPrice: number | string) => {
  const res = await api.get("/auctions/create/deposit-preview", {
    params: { startPrice },
  });
  return res.data;
};
