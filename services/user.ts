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
