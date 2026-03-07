import api from "./api";

export const updateProfile = async (data: {
    name?: string;
    phone?: string;
    governorate?: string;
    address?: string;
}) => {
    const res = await api.put("/users/me/profile", data);
    return res.data;
};

export const toggleFavorite = async (auctionId: string) => {
    const res = await api.post("/users/me/favorites", { auctionId });
    return res.data;
};

export const getMyFavorites = async () => {
    const res = await api.get("/users/me/favorites");
    return res.data;
};
