import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    ChevronRight,
    Star,
    TrendingUp,
    Search,
    Filter,
    Calendar,
    ExternalLink,
    Eye,
    X,
} from "lucide-react";
import api from "@/services/api";

type FeaturedLog = {
    _id: string;
    user?: { name: string; phone: string; _id: string };
    refId?: { title: string; _id: string };
    amountIQD: number;
    createdAt: string;
    meta?: {
        duration?: string;
        featuredUntil?: string;
        note?: string;
    };
};

const formatMoney = (n: number) => new Intl.NumberFormat("ar-IQ").format(n || 0);
const formatDate = (d: string) =>
    new Date(d).toLocaleString("ar-IQ", { dateStyle: "short", timeStyle: "short" });

const DURATION_LABELS: Record<string, string> = {
    "1d": "24 ساعة",
    "3d": "3 أيام",
    "7d": "7 أيام",
};

export default function AdminFeaturedAuctions() {
    const [logs, setLogs] = useState<FeaturedLog[]>([]);
    const [stats, setStats] = useState({ totalRevenue: 0, totalCount: 0 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selected, setSelected] = useState<FeaturedLog | null>(null);

    useEffect(() => {
        fetchLogs();
    }, [page, startDate, endDate]);

    useEffect(() => {
        const t = setTimeout(fetchLogs, 450);
        return () => clearTimeout(t);
    }, [search]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params: any = { page, limit: 15 };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (search) params.search = search;

            const res = await api.get("/admin/financials/featured-payments", { params });
            setLogs(res.data.logs || []);
            setStats(res.data.stats || { totalRevenue: 0, totalCount: 0 });
            setPages(res.data.pagination.pages);
            setTotal(res.data.pagination.total);
        } catch (e) {
            console.error("fetchLogs error:", e);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setSearch("");
        setStartDate("");
        setEndDate("");
        setPage(1);
    };

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
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Star className="w-7 h-7 text-amber-500 fill-amber-400" />
                            إيرادات التمييز
                        </h1>
                        <p className="text-slate-500 font-medium text-sm">سجل عمليات تمييز المزادات المدفوعة</p>
                    </div>
                </div>

                {/* Stats Card */}
                <div className="flex items-center gap-4">
                    <div className="bg-amber-500 px-6 py-3 rounded-2xl text-white shadow-xl shadow-amber-500/20 flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-black tracking-widest text-amber-100">
                                إجمالي الإيراد
                            </p>
                            <p className="text-xl font-black">
                                {formatMoney(stats.totalRevenue)}{" "}
                                <span className="text-xs">د.ع</span>
                            </p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            عمليات
                        </p>
                        <p className="text-xl font-black text-slate-900">{stats.totalCount}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 items-end bg-white/50 backdrop-blur-md p-5 rounded-3xl border border-slate-200/60 shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="بحث باسم المستخدم أو الهاتف..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-11 pr-11 pl-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                    />
                </div>

                <div className="flex gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">من</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            className="h-11 px-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-amber-500 transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">إلى</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            className="h-11 px-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-amber-500 transition-all"
                        />
                    </div>
                    <button
                        onClick={reset}
                        className="h-11 mt-auto px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black transition-all flex items-center gap-2"
                    >
                        <Filter className="w-4 h-4" /> إعادة ضبط
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-amber-500" /> سجل عمليات التمييز
                    </h3>
                    <span className="text-xs font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                        {total} عملية
                    </span>
                </div>

                {loading ? (
                    <div className="p-20 flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-slate-400">جاري التحميل...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-20 text-center">
                        <Star className="w-12 h-12 text-slate-200 mx-auto mb-4 fill-slate-100" />
                        <h4 className="text-lg font-black text-slate-700">لا توجد عمليات تمييز</h4>
                        <p className="text-sm text-slate-400 mt-1">لم يتم تمييز أي مزاد بعد أو لا يوجد ما يطابق الفلتر.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">المستخدم</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">المزاد</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">المدة</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">المبلغ</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">ينتهي</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest">التاريخ</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-black text-slate-500 tracking-widest text-left">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.map((log) => (
                                    <tr key={log._id} className="hover:bg-amber-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800">{log.user?.name || "—"}</span>
                                                <span className="text-[10px] font-bold text-slate-400 font-mono">{log.user?.phone || ""}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.refId ? (
                                                <Link
                                                    to={`/auction/${log.refId._id}`}
                                                    className="text-sm font-black text-indigo-600 hover:underline flex items-center gap-1 max-w-[200px] truncate"
                                                >
                                                    {log.refId.title}
                                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                                </Link>
                                            ) : (
                                                <span className="text-slate-400 text-sm">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                                                <Star className="w-3 h-3 fill-amber-500" />
                                                {DURATION_LABELS[log.meta?.duration || ""] || log.meta?.duration || "—"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-black text-emerald-600">{formatMoney(log.amountIQD)} د.ع</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-500">
                                                {log.meta?.featuredUntil ? formatDate(log.meta.featuredUntil) : "—"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-500">{formatDate(log.createdAt)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => setSelected(log)}
                                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                title="عرض التفاصيل"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pages > 1 && (
                    <div className="p-5 border-t border-slate-100 flex items-center justify-between">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
                        >
                            السابق
                        </button>
                        <span className="text-xs font-black text-slate-500">
                            صفحة <span className="text-slate-900 mx-1">{page}</span> من{" "}
                            <span className="text-slate-900 mx-1">{pages}</span>
                        </span>
                        <button
                            disabled={page === pages}
                            onClick={() => setPage((p) => p + 1)}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
                        >
                            التالي
                        </button>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selected && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() => setSelected(null)}
                >
                    <div
                        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                                    <Star className="w-5 h-5 fill-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900">تفاصيل عملية التمييز</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FEATURE_AUCTION_PAYMENT</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-white rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المستخدم</p>
                                    <p className="font-black text-slate-800">{selected.user?.name || "—"}</p>
                                    <p className="text-xs text-slate-400 font-mono">{selected.user?.phone || ""}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المبلغ المدفوع</p>
                                    <p className="text-2xl font-black text-emerald-600">{formatMoney(selected.amountIQD)} <span className="text-sm">د.ع</span></p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المزاد</p>
                                    {selected.refId ? (
                                        <Link to={`/auction/${selected.refId._id}`} className="font-black text-indigo-600 hover:underline text-sm flex items-center gap-1">
                                            {selected.refId.title} <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    ) : <p className="font-bold text-slate-600 text-sm">—</p>}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">مدة التمييز</p>
                                    <p className="font-black text-amber-600">{DURATION_LABELS[selected.meta?.duration || ""] || selected.meta?.duration || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">تاريخ الدفع</p>
                                    <p className="font-bold text-slate-700 text-sm">{formatDate(selected.createdAt)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ينتهي التمييز</p>
                                    <p className="font-bold text-slate-700 text-sm">{selected.meta?.featuredUntil ? formatDate(selected.meta.featuredUntil) : "—"}</p>
                                </div>
                            </div>

                            {selected.meta?.note && (
                                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">ملاحظة</p>
                                    <p className="text-sm font-bold text-slate-700">{selected.meta.note}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-5 bg-slate-50 border-t border-slate-100">
                            <button
                                onClick={() => setSelected(null)}
                                className="w-full py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all"
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
