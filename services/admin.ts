import api from "./api";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

/* =========================
   Dashboard (Admin)
 ========================= */
// المزادات المعلقة
export const getPendingAuctions = async (
  page = 1,
  limit = 5
) => {
  const res = await api.get(
    `/admin/auctions/pending?page=${page}&limit=${limit}`
  );
  return res.data;
};

// الموافقة على مزاد
export const approveAuction = (id: string) => {
  return api.patch(`/admin/auctions/${id}/approve`);
};

// رفض مزاد
export const rejectAuction = (id: string, data?: { rejectionReasons?: string[], rejectionNote?: string }) =>
  api.patch(`/admin/auctions/${id}/reject`, data);

// إحصائيات
export const getStats = () => {
  return api.get("/admin/stats");
};

// قبول / رفض مزاد
export const updateAuctionStatus = (
  auctionId: string,
  status: "active" | "rejected"
) => {
  return api.patch(`/admin/auctions/${auctionId}/status`, { status });
};

// حذف مزاد
export const deleteAuctionApi = (id: string) =>
  api.delete(`/admin/${id}`);

/* =========================
   Archive (Completed)
 ========================= */
export const getMonthlyCompletedStats = async () => {
  const res = await api.get("/admin/stats/monthly-completed");
  return res.data;
};

// المزادات المنتهية
export const getCompletedAuctions = (
  filter: "all" | "withWinner" | "withoutWinner" = "all"
) =>
  api.get("/admin/archive", {
    params: filter === "all" ? {} : { result: filter },
  });

export const getAdminCounters = () => {
  return api.get("/admin/counters");
};

export const getDashboardStats = async () => {
  const res = await api.get("/admin/dashboard");
  return res.data;
};

export const getAdminUsers = async (
  page = 1,
  limit = 10,
  search = "",
  role = "",
  status = ""
) => {
  const params = new URLSearchParams();

  params.append("page", String(page));
  params.append("limit", String(limit));

  if (search) params.append("search", search);
  if (role) params.append("role", role);
  if (status) params.append("status", status);

  const res = await api.get(`/admin/users?${params.toString()}`);
  return res.data;
};

export const toggleUserBan = async (id: string) => {
  const res = await api.patch(`/admin/users/${id}/ban`);
  return res.data;
};

export const getAdminUserDetails = async (id: string) => {
  const res = await api.get(`/admin/users/${id}`);
  return res.data;
};

export const getPlatformBalanceSources = (params?: {
  from?: string;
  to?: string;
  groupBy?: "day" | "month";
  q?: string;
  page?: number;
  limit?: number;
  actions?: string;
}) => api.get("/admin/platform/balance/sources", { params });

export const getDepositPolicy = async () => {
  const res = await api.get("/admin/deposit-policy");
  return res.data;
};

export const updateDepositPolicy = async (policy: any) => {
  const res = await api.patch("/admin/deposit-policy", { policy });
  return res.data;
};

/* =========================
   Financial Reports
 ========================= */
export const getFinancialStats = () => api.get("/admin/financials/stats");

export const getFinancialLogs = (params: {
  page?: number;
  limit?: number;
  type?: "all" | "subscription" | "topup" | "penalty";
}) => api.get("/admin/financials/logs", { params });
