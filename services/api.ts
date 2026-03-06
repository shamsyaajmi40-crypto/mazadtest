import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (
        error.response?.data?.message?.includes("حظر") ||
        error.response?.status === 401
      ) {
        localStorage.removeItem("app_session");
        if (!window.location.hash.includes("/login")) {
          // React Router HashRouter typically uses #/login
          window.location.href = "#/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
