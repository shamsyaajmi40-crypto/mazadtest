import api from "./api";
import type { LoginPayload, RegisterPayload, User } from "../types";

type AuthResponse = {
  user: User;
  token: string;
};
const session = localStorage.getItem("app_session");
const parsed = session ? JSON.parse(session) : {};
/* ======================
   Login
====================== */
export const login = async (
  payload: LoginPayload
): Promise<User> => {
  const res = await api.post<AuthResponse>("/auth/login", payload);

  const session = localStorage.getItem("app_session");
  const parsed = session ? JSON.parse(session) : {};

  localStorage.setItem(
    "app_session",
    JSON.stringify({
      ...parsed,
      user: res.data.user,   // ✅ التصحيح هنا
      token: res.data.token, // ✅ نثبت التوكن دائمًا
    })
  );

  return res.data.user;
};

/* ======================
   Register
====================== */
export const register = async (
  payload: RegisterPayload
): Promise<User> => {
  const res = await api.post<AuthResponse>("/auth/register", payload);

  const session = localStorage.getItem("app_session");
  const parsed = session ? JSON.parse(session) : {};

  localStorage.setItem(
    "app_session",
    JSON.stringify({
      ...parsed,
      user: res.data.user,
      token: res.data.token,
    })
  );

  return res.data.user;
};

/* ======================
   Logout (اختياري)
====================== */
export const logout = () => {
  localStorage.removeItem("app_session");
};
