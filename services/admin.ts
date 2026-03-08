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
// المزادات (المعلقة أو المرفوضة) للمراجعة
export const getPendingAuctions = async (
  page = 1,
  limit = 5,
  status = "pending"
) => {
  const res = await api.get(
    `/admin/auctions/pending?page=${page}&limit=${limit}&status=${status}`
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

// التراجع عن رفض المزاد
export const undoRejectAuction = (id: string) =>
  api.patch(`/admin/auctions/${id}/undo-reject`);

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
  type?: "all" | "subscription" | "topup" | "penalty" | "refund";
  startDate?: string;
  endDate?: string;
  search?: string;
}) => api.get("/admin/financials/logs", { params });

export const downloadFinancialsExcel = (params: {
  type?: string;
  period?: "week" | "month";
  startDate?: string;
  endDate?: string;
  search?: string;
}) => api.get("/admin/financials/export", { params, responseType: 'blob' });

/* =========================
   KYC (Verification)
   ========================= */
export const getPendingKYCRequests = async () => {
  const res = await api.get("/admin/kyc/pending");
  return res.data;
};

export const approveKYC = async (id: string) => {
  const res = await api.post(`/admin/kyc/${id}/approve`);
  return res.data;
};

export const rejectKYC = async (id: string, reason: string) => {
  const res = await api.post(`/admin/kyc/${id}/reject`, { reason });
  return res.data;
};
