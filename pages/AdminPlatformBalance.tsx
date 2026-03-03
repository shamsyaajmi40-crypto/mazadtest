import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  DollarSign,
  CreditCard,
  ShieldAlert,
  TrendingUp,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Search,
  Download,
  Eye,
  Trash2,
  Printer,
  X,
  Info
} from "lucide-react";
import api from "@/services/api";
import {
  getFinancialStats,
  getFinancialLogs,
  downloadFinancialsExcel
} from "../services/admin";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type FinancialLog = {
  _id: string;
  type: "SUBSCRIPTION" | "TOPUP" | "PENALTY" | "REFUND" | "DEPOSIT_REFUND" | "WALLET_WITHDRAWAL";
  status?: "SUCCESS" | "FAILED";
  amount: number;
  user?: { name: string; phone: string; _id: string };
  createdAt: string;
  orderId?: string;
  auction?: { title: string; _id: string };
  reason?: string;
  source?: "SELLER" | "BUYER" | "PLATFORM" | "OTHER";
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl text-white animate-in zoom-in-95 duration-200">
        <p className="text-[10px] uppercase tracking-wider font-black text-indigo-300 mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span className="text-xs font-bold text-slate-300">{entry.name}</span>
              </div>
              <span className="text-sm font-black">{(entry.value || 0).toLocaleString()} د.ع</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function AdminPlatformBalance() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<FinancialLog[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | "subscription" | "topup" | "penalty" | "refund">("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<FinancialLog | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, typeFilter, startDate, endDate]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const loadStats = async () => {
    try {
      const res = await getFinancialStats();
      setStats(res.data);
    } catch (e) {
      console.error("loadStats error:", e);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 10, type: typeFilter };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (search) params.search = search;

      const res = await getFinancialLogs(params);
      setLogs(res.data.logs);
      setPages(res.data.pagination.pages);
      setTotalLogs(res.data.pagination.total);
    } catch (e) {
      console.error("loadLogs error:", e);
    } finally {
      setLoading(false);
    }
  };
  const handleExport = async (period: "week" | "month") => {
    try {
      const params: any = { type: typeFilter, period };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (search) params.search = search;

      const res = await downloadFinancialsExcel(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial-report-${period}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Export error:", e);
      alert("فشل تحميل التقرير");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا السجل؟ هذه العملية لا يمكن التراجع عنها.")) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin/financials/logs/${id}`);
      loadLogs();
      loadStats();
    } catch (e) {
      console.error("Delete error:", e);
      alert("فشل حذف السجل");
    } finally {
      setDeletingId(null);
    }
  };

  const printRecord = () => {
    window.print();
  };

  const formatMoney = (n: number) => new Intl.NumberFormat("ar-IQ").format(n);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/dashboard"
            className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">المركز المالي</h1>
            <p className="text-slate-500 font-medium text-sm">نظرة شاملة على إيرادات وتدفقات المنصة</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <button
              onClick={() => handleExport("week")}
              className="px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 flex items-center gap-2 border-l border-slate-100"
            >
              <Download className="w-3.5 h-3.5" /> تقرير أسبوعي
            </button>
            <button
              onClick={() => handleExport("month")}
              className="px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" /> تقرير شهري
            </button>
          </div>

          {stats && (
            <div className="bg-indigo-600 px-6 py-3 rounded-2xl text-white shadow-xl shadow-indigo-600/20 flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-indigo-100">إجمالي الأرباح</p>
                <p className="text-xl font-black">{formatMoney(stats.totalPlatformRevenue)} <span className="text-xs">د.ع</span></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {stats && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">من الاشتراكات</p>
                  <p className="text-3xl font-black text-slate-900">{formatMoney(stats.subscriptionRevenue)} <span className="text-sm">د.ع</span></p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 bg-emerald-50 w-fit px-2.5 py-1 rounded-full">
                  <ArrowUpRight className="w-3 h-3" /> {stats.cashFlow?.subscription?.count || 0} اشتراك مدفوع
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">من المصادرات</p>
                  <p className="text-3xl font-black text-slate-900">{formatMoney(stats.penaltyRevenue)} <span className="text-sm">د.ع</span></p>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 bg-indigo-50 w-fit px-2 py-0.5 rounded-md border border-indigo-100/50">
                    بائع: {formatMoney(stats.penaltyBreakdown?.SELLER?.total || 0)} ({stats.penaltyBreakdown?.SELLER?.count || 0})
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-purple-600 bg-purple-50 w-fit px-2 py-0.5 rounded-md border border-purple-100/50">
                    مشتري: {formatMoney(stats.penaltyBreakdown?.BUYER?.total || 0)} ({stats.penaltyBreakdown?.BUYER?.count || 0})
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">إجمالي شحن المحفظة</p>
                  <p className="text-3xl font-black text-slate-900">{formatMoney(stats.cashFlow?.wallet_topup?.total || 0)} <span className="text-sm">د.ع</span></p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-black text-blue-600 bg-blue-50 w-fit px-2.5 py-1 rounded-full">
                  <ArrowUpRight className="w-3 h-3" /> {stats.cashFlow?.wallet_topup?.count || 0} عملية إيداع
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-white/70 backdrop-blur-xl border border-slate-200 p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-slate-900">تحليل الإيرادات</h3>
                  <p className="text-sm font-medium text-slate-500">مقارنة شهرية بين مصادر الدخل (آخر 12 شهر)</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest hidden md:flex">
                  <div className="flex items-center gap-2 text-indigo-500">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/40"></div> العمولات
                  </div>
                  <div className="flex items-center gap-2 text-emerald-500">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/40"></div> الاشتراكات
                  </div>
                </div>
              </div>

              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.monthlyChart}>
                    <defs>
                      <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPenalty" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      name="الاشتراكات"
                      type="monotone"
                      dataKey="subscriptions"
                      stroke="#10b981"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#colorSub)"
                    />
                    <Area
                      name="المصادرات"
                      type="monotone"
                      dataKey="penalties"
                      stroke="#6366f1"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#colorPenalty)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Unified Logs Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-end bg-white/50 backdrop-blur-md p-6 rounded-3xl border border-slate-200/60 shadow-sm transition-all hover:shadow-md">
          <div className="flex-1 w-full space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 mr-2 tracking-widest">البحث في السجلات</label>
            <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="بحث باسم المستخدم، الهاتف، رقم الطلب..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-12 pr-11 pl-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
          </div>

          <div className="w-full md:w-auto space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 mr-2 tracking-widest">من تاريخ</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="h-12 px-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
            />
          </div>

          <div className="w-full md:w-auto space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 mr-2 tracking-widest">إلى تاريخ</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="h-12 px-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
            />
          </div>

          <button
            onClick={() => { setStartDate(""); setEndDate(""); setSearch(""); setTypeFilter("all"); setPage(1); }}
            className="h-12 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Filter className="w-4 h-4" /> إعادة ضبط
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-500" /> سجل العمليات الموحد
          </h3>

          <div className="flex bg-white p-1 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <button
              onClick={() => { setTypeFilter("all"); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${typeFilter === 'all' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >الكل</button>
            <button
              onClick={() => { setTypeFilter("subscription"); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${typeFilter === 'subscription' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >الاشتراكات</button>
            <button
              onClick={() => { setTypeFilter("penalty"); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${typeFilter === 'penalty' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >المصادرات</button>
            <button
              onClick={() => { setTypeFilter("topup"); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${typeFilter === 'topup' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >الإيداع</button>
            <button
              onClick={() => { setTypeFilter("refund"); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${typeFilter === 'refund' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >إرجاع</button>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-slate-400">جاري جلب السجلات الموحدة...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="text-lg font-black text-slate-800">لا توجد سجلات</h4>
              <p className="text-sm font-medium text-slate-500">لا توجد عمليات تطابق البحث الخاص بك حالياً.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">نوع العملية</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">المستخدم</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">المرجع</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">المبلغ</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest text-center">التاريخ</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${log.type === 'SUBSCRIPTION' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            log.type === 'PENALTY' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                              log.type === 'DEPOSIT_REFUND' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                log.type === 'WALLET_WITHDRAWAL' ? (log.status === 'FAILED' ? 'bg-slate-100 text-slate-500 border border-slate-200' : 'bg-orange-50 text-orange-600 border border-orange-100') :
                                  'bg-blue-50 text-blue-600 border border-blue-100'
                            }`}>
                            {log.type === 'SUBSCRIPTION' ? 'اشتراك' :
                              log.type === 'PENALTY' ? 'مصادرة' :
                                log.type === 'DEPOSIT_REFUND' ? 'إرجاع عربون' :
                                  log.type === 'WALLET_WITHDRAWAL' ? (log.status === 'FAILED' ? 'فشل سحب' : 'سحب رصيد') : 'شحن رصيد'}
                          </span>
                          {log.source && log.source !== "OTHER" && (
                            <span className="text-[9px] font-black text-slate-400 px-2 py-0.5 bg-slate-100 w-fit rounded border border-slate-200">
                              {log.source === 'SELLER' ? 'عربون بائع' : 'عربون مشتري'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800">{log.user?.name || 'مستخدم غير متوفر'}</span>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">{log.user?.phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700 font-mono tracking-tighter">
                            {log.orderId || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            {log.type === 'PENALTY' || log.type === 'DEPOSIT_REFUND' || (log.type === 'WALLET_WITHDRAWAL' && log.status !== 'FAILED') ? (
                              <ArrowDownRight className={`w-3 h-3 ${log.type === 'PENALTY' ? 'text-rose-500' : (log.type === 'DEPOSIT_REFUND' ? 'text-amber-500' : 'text-orange-500')}`} />
                            ) : (
                              <ArrowUpRight className={`w-3 h-3 ${log.status === 'FAILED' ? 'text-slate-400' : 'text-emerald-500'}`} />
                            )}
                            <span className={`text-sm font-black ${log.type === 'PENALTY' ? 'text-rose-600' :
                              log.status === 'FAILED' ? 'text-slate-400 line-through opacity-70' :
                                log.type === 'DEPOSIT_REFUND' ? 'text-amber-600' :
                                  log.type === 'WALLET_WITHDRAWAL' ? 'text-orange-600' :
                                    'text-emerald-600'
                              }`}>
                              {formatMoney(log.amount)} د.ع
                            </span>
                          </div>
                          {log.status === 'FAILED' && (
                            <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded w-fit">فاشلة</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {log.type === 'PENALTY' ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-600 truncate">{log.reason}</span>
                            {log.auction && <span className="text-[10px] font-medium text-indigo-500">مزاد: {log.auction.title}</span>}
                          </div>
                        ) : (log.type === 'WALLET_WITHDRAWAL' || log.type === 'DEPOSIT_REFUND') ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-slate-600">{log.reason || (log.type === 'DEPOSIT_REFUND' ? 'إرجاع تلقائي' : 'سحب رصيد')}</span>
                            {log.status === 'FAILED' && (
                              <span className="text-[10px] font-black text-rose-600 bg-rose-50/50 p-1 rounded border border-rose-100 mt-1 italic">
                                سبب الرفض: {log.reason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-600">رقم الطلب: {log.orderId || '—'}</span>
                            <span className="text-[10px] font-medium text-slate-400 capitalize">بواسطة: {log.provider || 'نظام'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          {new Date(log.createdAt).toLocaleString("ar-IQ", { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="عرض التفاصيل"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {log.source === "منصة (يدوي)" && (
                            <button
                              onClick={() => handleDelete(log._id)}
                              disabled={deletingId === log._id}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-all"
                              title="حذف السجل"
                            >
                              <Trash2 className={`w-4 h-4 ${deletingId === log._id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="p-6 border-t border-slate-100 flex items-center justify-between">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
              >السابق</button>
              <div className="text-xs font-black text-slate-500">
                صفحة <span className="text-slate-900 mx-1">{page}</span> من <span className="text-slate-900 mx-1">{pages}</span>
              </div>
              <button
                disabled={page === pages}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
              >التالي</button>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">تفاصيل العملية</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedLog.orderId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content / Printable Area */}
            <div id="printable-record" className="p-8 space-y-8">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المستخدم</p>
                  <p className="text-lg font-black text-slate-900">{selectedLog.user?.name}</p>
                  <p className="text-sm font-bold text-slate-500 font-mono">{selectedLog.user?.phone}</p>
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المبلغ</p>
                  <p className={`text-2xl font-black ${selectedLog.type === 'PENALTY' ? 'text-rose-600' :
                      selectedLog.status === 'FAILED' ? 'text-slate-400' :
                        (selectedLog.type === 'DEPOSIT_REFUND' || selectedLog.type === 'WALLET_WITHDRAWAL') ? 'text-orange-600' :
                          'text-emerald-600'
                    }`}>{formatMoney(selectedLog.amount)} د.ع</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">نوع العملية</p>
                  <p className="font-black text-slate-800">
                    {selectedLog.type === 'SUBSCRIPTION' ? 'اشتراك باقة' :
                      selectedLog.type === 'PENALTY' ? 'مصادرة رصيد' :
                        selectedLog.type === 'DEPOSIT_REFUND' ? 'إرجاع عربون' :
                          selectedLog.type === 'WALLET_WITHDRAWAL' ? 'سحب رصيد' : 'شحن رصيد'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الحالة</p>
                  <p className={`font-black ${selectedLog.status === 'FAILED' ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {selectedLog.status === 'FAILED' ? 'فاشلة' : 'ناجحة'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">التاريخ</p>
                  <p className="font-bold text-slate-700">{new Date(selectedLog.createdAt).toLocaleString("ar-IQ", { dateStyle: 'full', timeStyle: 'short' })}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المصدر</p>
                  <p className="font-bold text-slate-700">{selectedLog.source || 'النظام'}</p>
                </div>
              </div>

              {(selectedLog as any).meta && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">بيانات إضافية</p>
                  <div className="space-y-3">
                    {Object.entries((selectedLog as any).meta).map(([key, value]) => {
                      if (!value || typeof value === 'object') return null;
                      return (
                        <div key={key} className="flex justify-between items-center gap-4">
                          <span className="text-xs font-bold text-slate-500 capitalize">{key}:</span>
                          <span className="text-xs font-black text-slate-800 text-left">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedLog.reason && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ملاحظات / أسباب</p>
                  <p className="text-sm font-bold text-slate-600 bg-amber-50/50 p-4 rounded-xl border border-amber-100 italic">
                    {selectedLog.reason}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
              <button
                onClick={printRecord}
                className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" /> طباعة الوصل
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-8 bg-white border border-slate-200 text-slate-600 font-black py-4 rounded-2xl hover:bg-slate-50 transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
