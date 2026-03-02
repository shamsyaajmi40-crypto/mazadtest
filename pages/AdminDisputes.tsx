import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Ban, CheckCircle, PackageX, UserX } from "lucide-react";
import api from "@/services/api";
import toast from "react-hot-toast";
import maskUsername from "@/utils/maskUsername";

type Dispute = {
    _id: string;
    title: string;
    currentPrice: number;
    owner: { _id: string; name: string; phone?: string };
    winner: { _id: string; name: string; phone?: string };
    deliveryPenaltyReason: string;
    disputeReason: string;
    deliveryOrder: {
        status: string;
        company: { name: string };
        deliveryFee: number;
    };
};

const AdminDisputes = () => {
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchDisputes = async () => {
        try {
            setLoading(true);
            const res = await api.get("/admin/disputes");
            setDisputes(res.data || []);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "فشل جلب قائمة النزاعات");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDisputes();
    }, []);

    const handleResolve = async (id: string, decision: "accept_courier" | "accept_user") => {
        if (!window.confirm("التأكيد على هذا القرار؟ الإجراء لا رجعة فيه.")) return;

        try {
            const toastId = toast.loading("جاري تنفيذ القرار...");
            const res = await api.post(`/admin/disputes/${id}/resolve`, { decision });
            toast.success(res.data.message, { id: toastId });
            setDisputes((prev) => prev.filter((d) => d._id !== id));
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "حدث خطأ أثناء معالجة النزاع");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin"></div>
                <p className="font-bold text-slate-500">جاري تحميل النزاعات المفتوحة...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8" dir="rtl">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate("/admin/dashboard")}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowRight className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-amber-500" />
                        إدارة النزاعات المفتوحة
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">مراجعة وتحديد المسؤولية في حالات فشل التوصيل</p>
                </div>
            </div>

            {disputes.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-12 text-center">
                    <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-emerald-800 mb-2">ممتاز! لا توجد نزاعات حالياً</h3>
                    <p className="text-emerald-600/80 font-medium">منصة خالية من المشاكل والمراجعات المعلقة.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {disputes.map((dispute) => (
                        <div key={dispute._id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6">
                                <div className="flex flex-col lg:flex-row gap-6">
                                    {/* معلومات المزاد */}
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <span className="text-xs font-bold text-slate-400">اسم المزاد</span>
                                            <h3 className="text-lg font-black text-slate-800 line-clamp-1">{dispute.title}</h3>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <span className="text-[10px] text-slate-500 block mb-1 font-bold">البائع</span>
                                                <div className="font-black text-sm text-slate-700">{dispute.owner?.name}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">{dispute.owner?.phone}</div>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <span className="text-[10px] text-slate-500 block mb-1 font-bold">المشتري (الفائز)</span>
                                                <div className="font-black text-sm text-slate-700">{dispute.winner?.name}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">{dispute.winner?.phone}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* تفاصيل التوصيل والنزاع */}
                                    <div className="flex-1 space-y-4 lg:border-r lg:border-slate-100 lg:pr-6">
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold ring-1 ring-inset ring-indigo-200 text-center">
                                                🚚 {dispute.deliveryOrder?.company?.name || "مندوب"}
                                            </span>
                                            <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-lg text-xs font-bold ring-1 ring-inset ring-rose-200">
                                                سبب الإخفاق المرفوع: {dispute.deliveryPenaltyReason}
                                            </span>
                                        </div>

                                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 relative">
                                            <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-400 rounded-r-xl"></div>
                                            <h4 className="text-xs font-black text-amber-800 mb-1 flex items-center justify-between">
                                                <span>نص الاعتراض (دفاع المستخدم):</span>
                                            </h4>
                                            <p className="text-sm font-medium text-amber-900 leading-relaxed max-w-2xl whitespace-pre-wrap truncate">
                                                {dispute.disputeReason}
                                            </p>
                                        </div>
                                    </div>

                                    {/* أزرار القرار */}
                                    <div className="flex flex-col gap-3 min-w-[200px] justify-center lg:border-r lg:border-slate-100 lg:pr-6">
                                        <button
                                            onClick={() => handleResolve(dispute._id, "accept_user")}
                                            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-50 hover:bg-emerald-500 hover:text-white text-emerald-700 border border-emerald-200 rounded-xl font-bold transition-all text-sm group"
                                        >
                                            <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                            <span>قبول الاعتراض (تبرئة)</span>
                                        </button>
                                        <button
                                            onClick={() => handleResolve(dispute._id, "accept_courier")}
                                            className="flex items-center justify-center gap-2 w-full py-3 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-700 border border-rose-200 rounded-xl font-bold transition-all text-sm group"
                                        >
                                            <Ban className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                            <span>رفض الاعتراض (معاقبة)</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminDisputes;
