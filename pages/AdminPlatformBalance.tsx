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
  Search
} from "lucide-react";
import {
  getFinancialStats,
  getFinancialLogs
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
  type: "SUBSCRIPTION" | "TOPUP" | "PENALTY";
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
  const [typeFilter, setTypeFilter] = useState<"all" | "subscription" | "topup" | "penalty">("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, typeFilter]);

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
      const res = await getFinancialLogs({ page, limit: 10, type: typeFilter });
      setLogs(res.data.logs);
      setPages(res.data.pagination.pages);
      setTotalLogs(res.data.pagination.total);
    } catch (e) {
      console.error("loadLogs error:", e);
    } finally {
      setLoading(false);
    }
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
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">المبلغ</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">التفاصيل</th>
                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest text-left">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black ${log.type === 'SUBSCRIPTION' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            log.type === 'PENALTY' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                              'bg-blue-50 text-blue-600 border border-blue-100'
                            }`}>
                            {log.type === 'SUBSCRIPTION' ? 'اشتراك' :
                              log.type === 'PENALTY' ? 'مصادرة' : 'شحن رصيد'}
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
                        <div className="flex items-center gap-1">
                          {log.type === 'PENALTY' ? <ArrowDownRight className="w-3 h-3 text-rose-500" /> : <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                          <span className={`text-sm font-black ${log.type === 'PENALTY' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatMoney(log.amount)} د.ع
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {log.type === 'PENALTY' ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-600 truncate">{log.reason}</span>
                            {log.auction && <span className="text-[10px] font-medium text-indigo-500">مزاد: {log.auction.title}</span>}
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-600">رقم الطلب: {log.orderId || '—'}</span>
                            <span className="text-[10px] font-medium text-slate-400 capitalize">بواسطة: {log.provider || 'نظام'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-left">
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          {new Date(log.createdAt).toLocaleString("ar-IQ", { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
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
    </div>
  );
}
