import React, { useEffect, useState } from "react";
import { formatNumber } from "../utils/numberFormat";
import { Link } from "react-router-dom";
import api from "../services/api";
import {
    TrendingUp,
    Loader2,
    AlertCircle,
    FileText,
    DollarSign,
    ArrowRight,
    ShieldCheck,
    Star
} from "lucide-react";

export default function AdminFeaturedAuctions() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [totalRevenue, setTotalRevenue] = useState(0);

    const fetchFeaturedLogs = async () => {
        try {
            setLoading(true);
            setError("");

            // Instead of relying on a dedicated endpoint, we can use the existing platform-balance logs if structured properly.
            // Assuming a dedicated endpoint for finance logs might be better to filter by specific type.
            // Let's use the standard API call to get all transactions for the platform user or generic logs filter.
            // Since FinanceLog.create was added in featureAuction, we can query it if an endpoint exists, 
            // or build a quick dedicated endpoint if needed. For now, we will assume /admin/finance-logs?type=FEATURE_AUCTION_PAYMENT

            const { data } = await api.get("/admin/financials/featured-payments");
            setLogs(data.logs || []);

            setTotalRevenue(data.stats?.totalRevenue || 0);

        } catch (err: any) {
            console.error(err);
            setError(err?.response?.data?.message || "فشل تحميل سجلات المزادات المميزة");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeaturedLogs();
    }, []);

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in duration-500" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <Link
                        to="/admin/dashboard"
                        className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-primary hover:border-primary/30 transition-all shadow-sm"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                            <Star className="w-8 h-8 text-amber-500" /> إيرادات التمييز
                        </h1>
                        <p className="text-slate-500 font-medium">
                            سجل عمليات الدفع لتمييز المزادات ودعمها
                        </p>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -ml-16 -mt-16 group-hover:bg-amber-500/20 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center border border-amber-200 text-amber-600 shadow-sm">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-amber-800/70">إجمالي الأرباح من التمييز</p>
                            <h3 className="text-2xl font-black text-amber-900">{formatNumber(totalRevenue)} د.ع</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-500">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500">عدد العمليات الكلي</p>
                            <h3 className="text-2xl font-black text-slate-800">{formatNumber(logs.length)} عملية</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Log Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flexflex-row justify-between items-center">
                    <h2 className="text-lg font-black text-slate-800">سجل المعاملات</h2>
                </div>

                {loading ? (
                    <div className="p-20 text-center">
                        <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary mb-4" />
                        <p className="font-bold text-slate-500">جاري تحميل السجلات...</p>
                    </div>
                ) : error ? (
                    <div className="p-20 text-center">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-rose-500" />
                        </div>
                        <p className="font-bold text-rose-600 mb-2">{error}</p>
                        <button
                            onClick={fetchFeaturedLogs}
                            className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                        >
                            إعادة المعاولة
                        </button>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Star className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="font-bold text-slate-500">لا توجد عمليات تمييز للمزادات حتى الآن</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-wider">
                                    <th className="px-6 py-4 border-b border-slate-100">رقم الوصل</th>
                                    <th className="px-6 py-4 border-b border-slate-100">المبلغ</th>
                                    <th className="px-6 py-4 border-b border-slate-100">المستخدم</th>
                                    <th className="px-6 py-4 border-b border-slate-100">المزاد</th>
                                    <th className="px-6 py-4 border-b border-slate-100">التاريخ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {logs.map((log) => (
                                    <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4 text-blue-500" />
                                                <code className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded-lg text-slate-600 select-all">
                                                    {log.receiptId || log._id}
                                                </code>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-black text-emerald-600">
                                                +{formatNumber(log.amountIQD || log.amount)} د.ع
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.user ? (
                                                <div className="flex flex-col">
                                                    <Link
                                                        to={`/admin/users/${typeof log.user === 'object' ? log.user._id : log.user}`}
                                                        className="text-sm font-bold text-slate-800 hover:text-primary transition-colors"
                                                    >
                                                        {typeof log.user === 'object' ? log.user.name : "عرض المستخدم"}
                                                    </Link>
                                                    {typeof log.user === 'object' && log.user.phone && (
                                                        <span className="text-xs font-bold text-slate-400" dir="ltr">{log.user.phone}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-400">غير معروف</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.refModel === "Auction" && log.refId ? (
                                                <Link
                                                    to={`/auction/${typeof log.refId === 'object' ? log.refId._id : log.refId}`}
                                                    className="text-sm font-bold text-primary hover:underline"
                                                >
                                                    رابط المزاد
                                                </Link>
                                            ) : (
                                                <span className="text-xs text-slate-400">{log.meta?.note || "غير محدد"}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                            {new Date(log.createdAt).toLocaleString("ar-IQ")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
