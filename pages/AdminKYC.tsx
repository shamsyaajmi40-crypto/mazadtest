import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    ArrowRight,
    CheckCircle,
    XCircle,
    User,
    Phone,
    Calendar,
    Image as ImageIcon,
    Loader2,
    Eye
} from "lucide-react";
import { getPendingKYCRequests, approveKYC, rejectKYC } from "../services/admin";
import toast from "react-hot-toast";

type KYCRequest = {
    _id: string;
    name: string;
    phone: string;
    email?: string;
    createdAt: string;
    verification: {
        images: string[];
        submittedAt: string;
    };
};

const AdminKYC = () => {
    const [requests, setRequests] = useState<KYCRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedImages, setSelectedImages] = useState<string[] | null>(null);
    const navigate = useNavigate();

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const data = await getPendingKYCRequests();
            setRequests(data);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "فشل جلب طلبات التوثيق");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (id: string) => {
        if (!window.confirm("هل أنت متأكد من الموافقة على توثيق هذا الحساب؟")) return;

        try {
            const toastId = toast.loading("جاري معالجة الطلب...");
            await approveKYC(id);
            toast.success("تم توثيق الحساب بنجاح", { id: toastId });
            setRequests(prev => prev.filter(req => req._id !== id));
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "فشل معالجة الطلب");
        }
    };

    const handleReject = async (id: string) => {
        const reason = window.prompt("يرجى إدخال سبب الرفض (اختياري):");
        if (reason === null) return; // Cancelled prompt

        try {
            const toastId = toast.loading("جاري رفض الطلب...");
            await rejectKYC(id, reason);
            toast.success("تم رفض الطلب بنجاح", { id: toastId });
            setRequests(prev => prev.filter(req => req._id !== id));
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "فشل معالجة الطلب");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="font-bold text-slate-500">جاري تحميل طلبات التوثيق...</p>
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
                        <ShieldCheck className="w-8 h-8 text-blue-600" />
                        طلبات توثيق الحسابات (KYC)
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">مراجعة وثائق الهوية المرفوعة من قبل المستخدمين</p>
                </div>
            </div>

            {requests.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-12 text-center">
                    <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-emerald-800 mb-2">لا توجد طلبات معلقة</h3>
                    <p className="text-emerald-600/80 font-medium">تمت معالجة جميع طلبات التوثيق بنجاح.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {requests.map((request) => (
                        <div key={request._id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden hover:border-blue-200 transition-colors">
                            <div className="p-8">
                                <div className="flex flex-col lg:flex-row gap-8">
                                    {/* User Info */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 font-black text-xl">
                                                {request.name[0]}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800">{request.name}</h3>
                                                <p className="text-slate-500 text-sm font-bold flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    تاريخ الطلب: {new Date(request.verification.submittedAt).toLocaleDateString("ar-EG")}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                <span className="text-[10px] text-slate-500 block mb-1 font-black uppercase tracking-wider">رقم الهاتف</span>
                                                <div className="font-black text-slate-700 flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-blue-500" />
                                                    {request.phone}
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                <span className="text-[10px] text-slate-500 block mb-1 font-black uppercase tracking-wider">البريد الإلكتروني</span>
                                                <div className="font-bold text-slate-700 truncate text-sm">
                                                    {request.email || "غير متوفر"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ID Images */}
                                    <div className="flex-1">
                                        <span className="text-xs font-black text-slate-400 block mb-4 uppercase tracking-widest">وثائق الهوية المرفقة ({request.verification.images.length})</span>
                                        <div className="flex flex-wrap gap-3">
                                            {request.verification.images.map((img, idx) => (
                                                <div
                                                    key={idx}
                                                    className="relative group w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer"
                                                    onClick={() => setSelectedImages(request.verification.images)}
                                                >
                                                    <img src={img} alt="ID" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Eye className="w-6 h-6 text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                            {request.verification.images.length === 0 && (
                                                <div className="flex flex-col items-center justify-center p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 w-full text-center">
                                                    <ImageIcon className="w-8 h-8 mb-2 opacity-30" />
                                                    <p className="text-xs font-bold">لم يتم رفع أي صور!</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-3 min-w-[200px] justify-center lg:border-r lg:border-slate-100 lg:pr-8">
                                        <button
                                            onClick={() => handleApprove(request._id)}
                                            className="flex items-center justify-center gap-2 w-full py-4 bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all hover:-translate-y-0.5"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            <span>تفعيل التوثيق</span>
                                        </button>
                                        <button
                                            onClick={() => handleReject(request._id)}
                                            className="flex items-center justify-center gap-2 w-full py-4 bg-white text-rose-500 border-2 border-rose-100 rounded-2xl font-black hover:bg-rose-50 transition-all"
                                        >
                                            <XCircle className="w-5 h-5" />
                                            <span>رفض الطلب</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Simple Image Modal */}
            {selectedImages && (
                <div
                    className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
                    onClick={() => setSelectedImages(null)}
                >
                    <div className="max-w-4xl w-full flex flex-col gap-4">
                        <div className="flex justify-end">
                            <button className="text-white text-4xl">&times;</button>
                        </div>
                        <div className="flex flex-wrap justify-center gap-6 overflow-auto max-h-[80vh]">
                            {selectedImages.map((img, idx) => (
                                <img key={idx} src={img} alt="Full size ID" className="max-w-full rounded-2xl shadow-2xl border-4 border-white/10" />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminKYC;
