import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Users, Gavel, CheckCircle, XCircle, DollarSign, Ban, RefreshCw, BarChart2, CheckSquare, Settings, ArrowLeft, ArrowRight
} from "lucide-react";

import {
  getDashboardStats,
  getPendingAuctions,
  approveAuction,
  rejectAuction,
  undoRejectAuction,
  getMonthlyCompletedStats,
  getAdminCounters
} from "../services/admin";
import api from "@/services/api";

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

type Auction = {
  _id: string;
  title: string;
  status: string;
  seller?: {
    _id?: string;
    name: string;
  };
  createdAt: string;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl text-white animate-in zoom-in-95 duration-200">
        <p className="text-[10px] uppercase tracking-wider font-black text-indigo-300 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
          <p className="text-xl font-black">{payload[0].value} <span className="text-xs font-bold text-slate-400">مزاد</span></p>
        </div>
      </div>
    );
  }
  return null;
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<"STATS" | "PENDING">("STATS");
  const [activeReviewSubTab, setActiveReviewSubTab] = useState<"pending" | "rejected">("pending");
  const [stats, setStats] = useState<any>(null);
  const [pendingAuctions, setPendingAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [platformBalance, setPlatformBalance] = useState<number>(0);
  const [platformUpdatedAt, setPlatformUpdatedAt] = useState<string>("");
  const [pendingDisputesCount, setPendingDisputesCount] = useState<number>(0);
  const [pendingRefundRequestsCount, setPendingRefundRequestsCount] = useState<number>(0);

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [auctionToReject, setAuctionToReject] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([]);
  const [rejectionNote, setRejectionNote] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const loadAdminData = async () => {
      setLoading(true);
      try {
        const [dashboardStats, pendingRes, monthly, countersRes] = await Promise.all([
          getDashboardStats(),
          getPendingAuctions(pendingPage, 5, activeReviewSubTab),
          getMonthlyCompletedStats(),
          getAdminCounters().catch(() => ({ data: { pendingDisputes: 0, pendingRefundRequests: 0 } })),
        ]);

        setStats({ ...dashboardStats, pendingAuctions: pendingRes.pagination.total || 0 });
        setPendingAuctions(pendingRes.auctions || []);
        setPendingTotalPages(pendingRes.pagination.totalPages || 1);
        setMonthlyStats(monthly);
        setPendingDisputesCount(countersRes.data?.pendingDisputes || 0);
        setPendingRefundRequestsCount(countersRes.data?.pendingRefundRequests || 0);
      } catch (err) {
        console.error("Admin dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();

    // ربط بالـ Socket.io لتحديث البيانات بمجرد ورود مزاد جديد
    let socket: any = null;
    let refreshHandler = () => loadAdminData();

    import("socket.io-client").then(({ io }) => {
      socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000");
      socket.emit("admin:join");
      socket.on("admin_refresh", refreshHandler);
    });

    return () => {
      if (socket) socket.off("admin_refresh", refreshHandler);
    };
  }, [pendingPage, activeReviewSubTab]);

  useEffect(() => {
    const loadPlatformBalance = async () => {
      try {
        const res = await api.get("/admin/financials/stats");
        setPlatformBalance(res.data.totalPlatformRevenue ?? 0);
        setPlatformUpdatedAt(new Date().toISOString());
      } catch (e: any) {
        console.log("platform balance error:", e?.response?.status, e?.response?.data || e?.message);
        setPlatformBalance(0);
        setPlatformUpdatedAt("");
      }
    };

    loadPlatformBalance();
  }, []);

  const handleApprove = async (id: string) => {
    await approveAuction(id);
    setPendingAuctions((prev) => prev.filter((a) => a._id !== id));
    setStats((prev: any) => prev ? { ...prev, pendingAuctions: Math.max(0, prev.pendingAuctions - 1) } : prev);
  };

  const handleUndoReject = async (id: string) => {
    try {
      await undoRejectAuction(id);
      setPendingAuctions((prev) => prev.filter((a) => a._id !== id));
      setStats((prev: any) => prev ? { ...prev, pendingAuctions: Math.max(0, prev.pendingAuctions - 1) } : prev);
      alert("تم التراجع عن الرفض بنجاح، المزاد الآن في انتظار المراجعة");
    } catch (err: any) {
      console.error("Undo Error:", err);
      alert(err.response?.data?.message || "فشل التراجع عن الرفض");
    }
  };

  const openRejectModal = (id: string) => {
    setAuctionToReject(id);
    setRejectionReasons([]);
    setRejectionNote("");
    setRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!auctionToReject) return;
    try {
      await rejectAuction(auctionToReject, {
        rejectionReasons,
        rejectionNote
      });
      setPendingAuctions((prev) => prev.filter((a) => a._id !== auctionToReject));
      setStats((prev: any) => prev ? { ...prev, pendingAuctions: Math.max(0, prev.pendingAuctions - 1) } : prev);
      setRejectModalOpen(false);
      setAuctionToReject(null);
    } catch (err) {
      console.error("Reject error:", err);
      alert("فشل رفض المزاد");
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
        <p className="font-bold text-slate-500">جاري تحميل لوحة التحكم...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">لوحة تحكم المشرف</h1>
          <p className="text-slate-500 mt-1 font-medium">نظرة عامة على أداء المنصة وإدارة المحتوى</p>
        </div>
      </div>

      {/* Primary Navigation & Tabs */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex bg-white/60 backdrop-blur-xl p-1.5 rounded-[1.5rem] border border-slate-200/60 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab("STATS")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-[1.2rem] font-black text-sm transition-all duration-300 ${activeTab === "STATS"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
          >
            <BarChart2 className="w-4 h-4" /> الإحصائيات
          </button>

          <button
            onClick={() => setActiveTab("PENDING")}
            className={`relative flex items-center gap-2 px-6 py-2.5 rounded-[1.2rem] font-black text-sm transition-all duration-300 ${activeTab === "PENDING"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
              }`}
          >
            <CheckSquare className="w-4 h-4" /> المراجعة
            {pendingAuctions.length > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === "PENDING" ? "bg-white/20 text-white" : "bg-primary text-white"}`}>
                {pendingAuctions.length}
              </span>
            )}
          </button>
        </div>

        {/* Quick Links */}
        <div className="flex gap-2 flex-wrap">
          <Link to="/admin/users" className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[1.2rem] text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary hover:border-primary/20 transition-all shadow-sm">
            <Users className="w-4 h-4" /> Users</Link>
          <Link to="/admin/refund-requests" className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[1.2rem] text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-rose-500 hover:border-rose-500/20 transition-all shadow-sm relative">
            <RefreshCw className="w-4 h-4" /> Refunds
            {pendingRefundRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                {pendingRefundRequestsCount}
              </span>
            )}
          </Link>
          <Link to="/admin/courier" className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[1.2rem] text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-500 hover:border-emerald-500/20 transition-all shadow-sm">
            <CheckCircle className="w-4 h-4" /> Courier</Link>

          <Link to="/admin/disputes" className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[1.2rem] text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-amber-500 hover:border-amber-500/20 transition-all shadow-sm relative">
            <XCircle className="w-4 h-4" /> Disputes
            {pendingDisputesCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
                {pendingDisputesCount}
              </span>
            )}
          </Link>

          <Link to="/admin/deposit-policy" className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[1.2rem] text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-500 hover:border-indigo-500/20 transition-all shadow-sm">
            <Settings className="w-4 h-4" /> Deposit Policy</Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Sidebar (Platform Balance & Revenue) */}
        <div className="lg:col-span-1 space-y-4">
          {/* رصيد المنصة (Hero Card) */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-800 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-400/30 transition-all duration-700"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl"></div>

            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/10">
                <DollarSign className="w-5 h-5 text-indigo-200" />
              </div>
              <div className="text-xs font-bold text-indigo-200/70 bg-indigo-900/50 px-2.5 py-1 rounded-full border border-indigo-500/20">
                رصيد المنصة
              </div>
            </div>

            <div className="relative z-10">
              <div className="text-3xl font-black mb-1 truncate">{platformBalance.toLocaleString()} <span className="text-sm text-indigo-300 font-bold">د.ع</span></div>
              <div className="text-xs text-indigo-300/60">آخر تحديث: {platformUpdatedAt ? new Date(platformUpdatedAt).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" }) : "غير متوفر"}</div>
            </div>

            <Link to="/admin/platform-balance" className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-white/10 hover:bg-white/20 transition-colors backdrop-blur rounded-[1rem] text-sm font-bold border border-white/5 relative z-10">
              تفاصيل الرصيد <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          {/* Quick Summary Card */}
          {stats && (
            <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-[2rem] p-6 shadow-sm">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> ملخص سريع
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-500">إجمالي الإيرادات</span>
                  <span className="font-black text-slate-900">{stats.totalRevenue.toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-500">المزادات المكتملة</span>
                  <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{stats.completedAuctions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500">المستخدمين المحظورين</span>
                  <span className="font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">{stats.bannedUsers}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Panel (Stats Grid / Pending List) */}
        <div className="lg:col-span-3">
          {activeTab === "STATS" && stats && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard title="المشتركين" value={stats.totalUsers} icon={<Users className="w-5 h-5 text-indigo-500" />} color="indigo" />
                <StatCard title="المزادات" value={stats.totalAuctions} icon={<Gavel className="w-5 h-5 text-primary" />} color="primary" />
                <StatCard title="الصفقات الجارية" value={stats.activeAuctions || 0} icon={<RefreshCw className="w-5 h-5 text-blue-500" />} color="primary" />
                <StatCard title="مكتملة" value={stats.completedAuctions} icon={<CheckCircle className="w-5 h-5 text-emerald-500" />} color="emerald" />
                <StatCard title="ملغية" value={stats.cancelledAuctions} icon={<Ban className="w-5 h-5 text-rose-500" />} color="rose" />
              </div>

              {/* Chart Section */}
              <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>

                <div className="flex items-center justify-between mb-8 relative z-10">
                  <h2 className="text-xl font-black text-slate-800">نشاط المزادات המكتملة</h2>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">خلال العام</span>
                </div>

                <div className="relative z-10 h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#E2E8F0" opacity={0.3} />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                        dy={15}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#6366F1"
                        strokeWidth={4}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                        animationDuration={1500}
                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#6366F1', shadow: '0 0 10px rgba(99,102,241,0.5)' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === "PENDING" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Sub-Tabs for Pending/Rejected */}
              <div className="flex gap-2 mb-4 bg-slate-100/50 p-1 rounded-xl border border-slate-200/50 w-fit">
                <button
                  onClick={() => { setActiveReviewSubTab("pending"); setPendingPage(1); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeReviewSubTab === "pending"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  قيد الانتظار
                </button>
                <button
                  onClick={() => { setActiveReviewSubTab("rejected"); setPendingPage(1); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeReviewSubTab === "rejected"
                    ? "bg-rose-500 text-white shadow-sm shadow-rose-500/20"
                    : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  المرفوضة
                </button>
              </div>

              {pendingAuctions.length === 0 ? (
                <div className="bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[2rem] p-12 text-center shadow-sm">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <CheckSquare className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2">القائمة فارغة</h3>
                  <p className="text-slate-500 font-medium">
                    {activeReviewSubTab === "pending"
                      ? "لا توجد مزادات جديدة بحاجة للمراجعة حالياً."
                      : "لا توجد سجلات للمزادات المرفوضة حالياً."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {pendingAuctions.map((auction) => (
                      <div key={auction._id} className="bg-white/80 backdrop-blur-xl p-5 md:p-6 rounded-[1.5rem] border border-slate-200/60 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-6 shadow-sm hover:shadow-md transition-shadow">

                        <div className="flex gap-4 items-center">
                          <div className={`w-12 h-12 ${activeReviewSubTab === "pending" ? "bg-amber-50 border-amber-100 text-amber-500" : "bg-rose-50 border-rose-100 text-rose-500"} rounded-xl flex items-center justify-center border flex-shrink-0`}>
                            <Gavel className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-black text-lg text-slate-900">{auction.title}</h4>
                              {activeReviewSubTab === "rejected" && (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-black rounded-md uppercase">مرفوض</span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" /> البائع: {auction.seller?.name ?? "غير متوفر"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Link
                                to={`/auction/${auction._id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                رابط المزاد
                              </Link>
                              {auction.seller?._id && (
                                <Link
                                  to={`/admin/users/${auction.seller._id}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                  رابط المستخدم
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex w-full md:w-auto gap-3">
                          {activeReviewSubTab === "pending" ? (
                            <>
                              <button
                                onClick={() => handleApprove(auction._id)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all font-black"
                              >
                                <CheckCircle className="w-4 h-4" /> قبول
                              </button>
                              <button
                                onClick={() => openRejectModal(auction._id)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white border-2 border-slate-200 hover:border-rose-500 hover:text-rose-600 hover:bg-rose-50 text-slate-600 rounded-xl active:scale-95 transition-all font-black"
                              >
                                <XCircle className="w-4 h-4" /> رفض
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleUndoReject(auction._id)}
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all font-black"
                            >
                              <RefreshCw className="w-4 h-4" /> تراجع عن الرفض
                            </button>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {pendingTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8 bg-white/50 backdrop-blur p-2 rounded-full w-fit mx-auto border border-slate-200/50 shadow-sm">
                      <button
                        disabled={pendingPage === 1}
                        onClick={() => setPendingPage((p) => p - 1)}
                        className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-slate-600"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <span className="text-sm font-bold text-slate-600 px-2 flex items-center gap-1.5">
                        صفحة <span className="bg-slate-900 text-white w-6 h-6 flex items-center justify-center rounded-md">{pendingPage}</span> من {pendingTotalPages}
                      </span>

                      <button
                        disabled={pendingPage === pendingTotalPages}
                        onClick={() => setPendingPage((p) => p + 1)}
                        className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm border border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-slate-600"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-8 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center border border-rose-100">
                  <XCircle className="w-6 h-6 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">تحديد أسباب الرفض</h3>
                  <p className="text-sm font-medium text-slate-500">سيتم إبلاغ البائع بهذه الأسباب</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {[
                  "المزاد لا يصلح للنشر",
                  "الصور غير واضحة أو غير كافية",
                  "تفاصيل المزاد غير كاملة",
                  "سعر المزاد غير منطقي",
                  "محتوى مخالف للشروط والأحكام"
                ].map((reason) => (
                  <label key={reason} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                      checked={rejectionReasons.includes(reason)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRejectionReasons([...rejectionReasons, reason]);
                        } else {
                          setRejectionReasons(rejectionReasons.filter(r => r !== reason));
                        }
                      }}
                    />
                    <span className="font-bold text-slate-700">{reason}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-2 mb-8">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">ملاحظة إضافية (اختياري)</label>
                <textarea
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 h-24 resize-none"
                  placeholder="اكتب ملاحظات إضافية للبائع هنا..."
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={confirmReject}
                  disabled={rejectionReasons.length === 0 && !rejectionNote.trim()}
                  className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black shadow-lg shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  تأكيد الرفض
                </button>
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

/* -------------------------------- */

const StatCard = ({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "primary" | "emerald" | "rose" | "indigo";
}) => {
  const colorStyles = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    rose: "bg-rose-50 border-rose-100 text-rose-600",
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-600",
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-[1.5rem] p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${colorStyles[color].split(" ")[0]} opacity-50`}></div>
      <div>
        <p className="text-xs font-bold text-slate-500 mb-1.5">{title}</p>
        <p className={`text-2xl font-black text-slate-800 tracking-tight group-hover:scale-105 transition-transform origin-right`}>{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center border ${colorStyles[color]}`}>
        {icon}
      </div>
    </div>
  );
};
