import { useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  LogOut,
  RefreshCcw,
  RotateCcw,
  Truck,
  MapPin,
  User,
  Search,
  Building,
  Phone,
  MessageCircle,
} from "lucide-react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { calculateCommission } from "../utils/commission";
import "./CourierStaffDashboard.css"; // Uses the simplified flat CSS

type DeliveryOrder = {
  _id: string;
  status: string;
  failureReason?: string | null;
  deliveryFee?: number;
  trackingCode?: string;
  auction?: {
    currentPrice?: number;
    startingPrice?: number;
    confirmationDeadline?: string;
    winner?: {
      name?: string;
      phone?: string;
      governorate?: string;
      address?: string;
    } | null;
    seller?: {
      name?: string;
      phone?: string;
      governorate?: string;
      address?: string;
    } | null;
  } | null;
  destination?: {
    governorate?: string;
    address?: string;
    location?: { lat: number; lng: number } | null;
  } | null;
  createdAt?: string;
};

const reasons = [
  { value: "BUYER_NO_SHOW", label: "المشتري غير متواجد" },
  { value: "BUYER_REFUSED", label: "المشتري رفض الاستلام" },
  { value: "BUYER_DID_NOT_RECEIVE", label: "المشتري لم يستلم البضاعة" },
  { value: "BUYER_UNREACHABLE", label: "المشتري لا يرد" },
  { value: "WRONG_ADDRESS", label: "عنوان غير صحيح/غير واضح" },
  { value: "COURIER_ISSUE", label: "مشكلة لوجستية" },
  { value: "SELLER_NO_SHOW", label: "البائع غير متواجد" },
  { value: "SELLER_NOT_READY", label: "البائع غير جاهز" },
];

const failureReasonLabel: Record<string, string> = {
  BUYER_NO_SHOW: "المشتري غير متواجد",
  BUYER_REFUSED: "المشتري رفض الاستلام",
  BUYER_DID_NOT_RECEIVE: "المشتري لم يستلم البضاعة",
  BUYER_UNREACHABLE: "المشتري لا يرد",
  WRONG_ADDRESS: "عنوان غير صحيح/غير واضح",
  SELLER_NO_SHOW: "البائع غير متواجد",
  SELLER_NOT_READY: "البائع غير جاهز",
  COURIER_ISSUE: "مشكلة لوجستية",
};

const statusLabel: Record<string, string> = {
  READY_FOR_PICKUP: "بانتظار استلامك من البائع",
  PICKED_UP: "البضاعة بحوزتك الآن",
  OUT_FOR_DELIVERY: "قيد التوصيل",
  DELIVERED: "مُسلم للمشتري (بانتظار التسوية)",
  DELIVERY_FAILED: "توصيل متعثر",
  COD_PAID_TO_SELLER: "تم دفع COD للبائع",
  COMPLETED: "مكتمل نهائياً",
};

const isFinal = (status: string) =>
  ["DELIVERED", "COD_PAID_TO_SELLER", "COMPLETED"].includes(status);

const totalDueWithDelivery = (order: DeliveryOrder) => {
  const gross = Number(order.auction?.currentPrice || 0);
  const fee = Number(order.deliveryFee || 0);
  return Math.max(0, gross + fee);
};

const getCommission = (order: DeliveryOrder) => calculateCommission(order.auction?.currentPrice || 0, order.auction?.startingPrice || 0);
const sellerPayout = (order: DeliveryOrder) => Math.max(0, Number(order.auction?.currentPrice || 0) - getCommission(order));

const formatRemaining = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const fullAddress = (u?: { governorate?: string; address?: string } | null) => {
  if (!u) return "-";
  return [u.governorate, u.address].filter(Boolean).join(" - ") || "-";
};

export default function CourierAgentDashboard() {
  const { user, loading: authLoading, logout } = useContext(AuthContext);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [otpByOrder, setOtpByOrder] = useState<Record<string, string>>({});
  const [reasonByOrder, setReasonByOrder] = useState<Record<string, string>>({});
  const [noteByOrder, setNoteByOrder] = useState<Record<string, string>>({});
  
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [expandedByOrder, setExpandedByOrder] = useState<Record<string, boolean>>({});
  const [showFailForm, setShowFailForm] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  
  // 2 Tabs instead of 3
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/courier/agent/orders");
      setOrders(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "فشل جلب الطلبات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? orders.filter(o => o._id.toLowerCase().includes(q) || (o.trackingCode || "").toLowerCase().includes(q)) : orders;
    
    // Active Tab = Anything not finalized, plus delivery failed (needs revert/review)
    const active = list.filter(o => !isFinal(o.status));
    
    // Archive Tab = Delivered, COD Paid, Completed
    const archive = list.filter(o => isFinal(o.status));
    
    return { active, archive };
  }, [orders, search]);

  const runAction = async (orderId: string, fn: () => Promise<void>) => {
    setBusyOrderId(orderId);
    setError(null);
    try {
      await fn();
      await loadOrders();
    } catch (e: any) {
      setError(e?.response?.data?.message || "فشل تنفيذ العملية");
    } finally {
      setBusyOrderId(null);
    }
  };

  const onPickedUp = (orderId: string) => runAction(orderId, async () => {
    await api.post(`/courier/orders/${orderId}/picked-up`);
  });

  const onDelivered = (orderId: string) => runAction(orderId, async () => {
    const otp = (otpByOrder[orderId] || "").trim();
    if (!otp) throw new Error("أدخل OTP المُستلم");
    await api.post(`/courier/orders/${orderId}/delivered`, { otp });
    setOtpByOrder((p) => ({ ...p, [orderId]: "" }));
  });

  const onFailed = (orderId: string) => runAction(orderId, async () => {
    const reason = (reasonByOrder[orderId] || "").trim();
    if (!reason) throw new Error("اختر سبب الإخفاق");
    await api.post(`/courier/orders/${orderId}/failed`, { reason, note: noteByOrder[orderId] || "" });
  });

  const onRevertFailed = (orderId: string) => runAction(orderId, async () => {
    await api.post(`/courier/orders/${orderId}/failed/revert`, { note: noteByOrder[orderId] || "" });
  });

  if (authLoading) return <div className="p-10 text-center text-slate-500 min-h-screen bg-slate-50">جاري التحميل...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "courier_agent") return <Navigate to="/" replace />;

  const renderContextualOrderCard = (o: DeliveryOrder) => {
    const expanded = !!expandedByOrder[o._id];
    const isBusy = busyOrderId === o._id;
    const isDone = isFinal(o.status);
    const isFailed = o.status === "DELIVERY_FAILED";
    const deadlineMs = o.auction?.confirmationDeadline ? new Date(o.auction.confirmationDeadline).getTime() : 0;
    const reviewOpen = isFailed && deadlineMs > nowMs;
    const canRevert = reviewOpen;

    const canPickUp = ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(o.status);
    const canDeliver = ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(o.status); // Allowing delivery straight from OUT_FOR_DELIVERY if needed
    const canFail = !isFinal(o.status);

    return (
      <div key={o._id} className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-shadow ${isFailed ? 'border-rose-200' : 'border-slate-200 hover:shadow-md'}`}>
        {/* Status Indicator Bar */}
        <div className={`h-1.5 w-full ${isDone ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-blue-600'}`} />

        <div className="p-4 sm:p-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-slate-800 tracking-tight">#{o._id.slice(-6).toUpperCase()}</span>
                <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md uppercase tracking-wide border ${isDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isFailed ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {statusLabel[o.status] || o.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2 font-bold tracking-wide flex items-center gap-2">
                <Truck className="w-3.5 h-3.5" /> تتبع رقم: {o.trackingCode || "N/A"}
              </div>
            </div>
            <button 
              onClick={() => setExpandedByOrder(p => ({ ...p, [o._id]: !expanded }))} 
              className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors w-fit"
            >
              {expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'} {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {!expanded && (
             <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <div className="font-bold text-slate-700">التحصيل (COD): <span className="font-black text-indigo-700">{totalDueWithDelivery(o).toLocaleString()} د.ع</span></div>
             </div>
          )}

          {expanded && (
            <div className="pt-4 border-t border-slate-100 space-y-5 animate-in fade-in duration-200">
              
              {/* Financial Summary */}
              <div className="flex flex-wrap gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">استحصال نقدي (COD) عند التسليم</div>
                    <div className="text-xl font-black text-emerald-600">{totalDueWithDelivery(o).toLocaleString()} د.ع</div>
                  </div>
                  <div className="border-l border-slate-200 mx-2 hidden sm:block" />
                  <div className="flex-1">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">صافي يدوياً للبائع</div>
                    <div className="text-xl font-black text-indigo-600">{sellerPayout(o).toLocaleString()} د.ع</div>
                  </div>
               </div>

              {/* Clean Data Grid */}
              <div className="grid grid-cols-1 gap-4">
                 <div className="bg-white border text-right border-blue-200 p-4 rounded-lg relative overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.05)]">
                    <div className="absolute top-0 right-0 h-full w-1 bg-blue-500" />
                    <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-3">بيانات وجهة التوصيل (المشتري)</div>
                    <div className="font-black text-slate-900 mb-1 flex items-center gap-2"><User className="w-4 h-4 text-blue-400" /> {o.auction?.winner?.name || "-"}</div>
                    <div className="text-sm font-mono font-bold text-slate-700 mb-3 mr-6 flex items-center justify-between" dir="ltr">
                      <span>{o.auction?.winner?.phone || "-"}</span>
                      {o.auction?.winner?.phone && (
                        <div className="flex gap-2">
                           <a 
                             href={`tel:${o.auction.winner.phone}`} 
                             className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                             title="اتصال هاتفي"
                           >
                             <Phone className="w-4 h-4" />
                           </a>
                           <a 
                             href={`https://wa.me/${o.auction.winner.phone.replace(/\D/g, '')}`} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200"
                             title="مراسلة واتساب"
                           >
                             <MessageCircle className="w-4 h-4" />
                           </a>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mr-6 leading-relaxed flex items-start flex-col gap-2">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" /> 
                        {fullAddress(o.destination || o.auction?.winner || null)}
                      </div>
                      
                      {o.destination?.location && (
                         <a 
                           href={`https://www.google.com/maps/dir/?api=1&destination=${o.destination.location.lat},${o.destination.location.lng}`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors mt-1 border border-blue-200"
                           title="فتح في خرائط جوجل للملاحة"
                         >
                           <MapPin className="w-3 h-3" /> الملاحة إلى الموقع
                         </a>
                      )}
                    </div>
                 </div>
              </div>

               {/* Failure Banner */}
               {isFailed && (
                 <div className="bg-rose-50 p-4 border border-rose-200 rounded-lg flex items-start gap-3">
                   <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                   <div>
                     <div className="font-bold text-rose-800">بيانات التوصيل المتعثر</div>
                     <div className="text-sm text-rose-700 mt-1">السبب المسجل: {failureReasonLabel[o.failureReason || ""] || o.failureReason || "-"}</div>
                     <div className="text-xs text-rose-600 mt-2 font-medium">
                       {reviewOpen ? `⚠️ يمكنك التراجع عن الإغلاق خلال: ${formatRemaining(deadlineMs - nowMs)}` : "تم إغلاق الطلب ولم يعد قابلاً للتراجع الميداني."}
                     </div>
                   </div>
                 </div>
               )}

              {/* Contextual Action Area (Field Actions) */}
              <div className="pt-2">
                 
                 {/* STATE: Waiting for pick up */}
                 {canPickUp && (
                    <button onClick={() => onPickedUp(o._id)} disabled={isBusy} className="w-full bg-slate-900 text-white hover:bg-slate-800 px-4 py-4 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                      <Truck className="w-5 h-5 text-emerald-400" /> تأكيد استلام الشحنة من البائع
                    </button>
                 )}

                 {/* STATE: Picked up, needs delivery */}
                 {canDeliver && (
                    <div className="mt-4 p-4 border-2 border-dashed border-emerald-200 bg-emerald-50 rounded-xl">
                      <label className="block text-sm font-bold text-emerald-800 mb-3 text-center">أدخل رمز الـ OTP لإتمام إجراء التسليم (للمشتري)</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input value={otpByOrder[o._id] || ""} onChange={e => setOtpByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="flex-1 bg-white border border-emerald-300 rounded-lg px-4 py-3 text-center text-xl font-black tracking-widest outline-none focus:ring-2 focus:ring-emerald-500" placeholder="OTP العميل" inputMode="numeric" />
                        <button onClick={() => onDelivered(o._id)} disabled={isBusy} className="bg-emerald-600 text-white px-8 py-3 rounded-lg text-sm font-bold hover:bg-emerald-700 shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap shrink-0">
                          <CheckCircle2 className="w-5 h-5" /> تسليم
                        </button>
                      </div>
                    </div>
                 )}

                 {/* Shared actions for active orders */}
                 {canFail && !isFailed && (
                   <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                     <button onClick={() => setShowFailForm(p => ({ ...p, [o._id]: !p[o._id] }))} disabled={isBusy} className="w-full bg-white text-rose-600 border border-slate-300 hover:bg-rose-50 px-4 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                       <AlertTriangle className="w-4 h-4" /> بلاغ إخفاق / مشكلة توصيل
                     </button>
                   </div>
                 )}

                 {/* Revert Action */}
                 {isFailed && canRevert && (
                   <div className="mt-4 border-t border-slate-100 pt-4">
                     <button onClick={() => onRevertFailed(o._id)} disabled={isBusy} className="w-full bg-white border-2 border-dashed text-amber-600 border-amber-300 hover:bg-amber-50 px-4 py-4 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                       <RotateCcw className="w-5 h-5" /> التراجع وإعادة فتح الطلب للتوصيل
                     </button>
                   </div>
                 )}

                 {/* Inline Failure Form */}
                 {showFailForm[o._id] && !isFailed && (
                   <div className="mt-4 p-5 border border-rose-200 bg-rose-50 rounded-xl shadow-sm animate-in slide-in-from-top-2">
                      <div className="text-sm font-black text-rose-800 mb-4 text-center">بوابة الإبلاغ عن تعثر התوصيل</div>
                      <div className="space-y-4">
                        <select value={reasonByOrder[o._id] || ""} onChange={e => setReasonByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="w-full bg-white border border-rose-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500">
                          <option value="">ما هو سبب عدم نجاح العمل؟...</option>
                          {reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <input value={noteByOrder[o._id] || ""} onChange={e => setNoteByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="w-full bg-white border border-rose-200 rounded-lg px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-rose-500" placeholder="اكتب ملاحظات الإخفاق للإدارة..." />
                        <button onClick={() => onFailed(o._id)} disabled={isBusy || !reasonByOrder[o._id]} className="w-full bg-rose-600 text-white px-6 py-4 rounded-lg text-sm font-black hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-md shadow-rose-600/20 uppercase tracking-widest">
                          تأكيد حفظ التعثر وإغلاق الطلب
                        </button>
                      </div>
                   </div>
                 )}

              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Field App Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-5 border-b border-white/10">
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">التطبيق الميداني للمندوب</h1>
              <div className="text-[11px] text-slate-400 font-medium tracking-wide mt-1">تحديث آني للعمليات اللوجستية</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadOrders} className="w-10 h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                <RefreshCcw className={`w-4 h-4 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={logout} className="w-10 h-10 rounded-full border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center transition-colors">
                <LogOut className="w-4 h-4 text-rose-400" />
              </button>
            </div>
          </div>
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-white/10 py-3">
             <div className="text-center px-1">
               <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">مهامك النشطة</div>
               <div className="text-xl font-black text-blue-400">{filteredOrders.active.filter(o => o.status !== "DELIVERY_FAILED").length}</div>
             </div>
             <div className="text-center px-1">
               <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">تعثر مراجع</div>
               <div className="text-xl font-black text-rose-400">{filteredOrders.active.filter(o => o.status === "DELIVERY_FAILED").length}</div>
             </div>
             <div className="text-center px-1">
               <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">منجزك اليوم</div>
               <div className="text-xl font-black text-emerald-400">{filteredOrders.archive.length}</div>
             </div>
          </div>

          {/* Solid 2-Tab Navigation */}
          <div className="flex mt-2">
            <button 
              onClick={() => setActiveTab('active')} 
              className={`flex-1 py-3 text-sm font-black transition-colors rounded-t-xl border-b-4 ${activeTab === 'active' ? 'bg-white text-slate-900 border-blue-600' : 'bg-transparent text-slate-400 border-transparent hover:text-white'}`}
            >
              ساحة العمل الجارية ({filteredOrders.active.length})
            </button>
            <button 
              onClick={() => setActiveTab('archive')} 
              className={`flex-1 py-3 text-sm font-black transition-colors rounded-t-xl border-b-4 ${activeTab === 'archive' ? 'bg-white text-slate-900 border-emerald-500' : 'bg-transparent text-slate-400 border-transparent hover:text-white'}`}
            >
              أرشيف المنجزات
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800 font-bold shadow-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}
        
        {/* Universal Search Tool */}
        <div className="relative">
           <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
           <input 
             value={search} 
             onChange={e => setSearch(e.target.value)} 
             className="w-full bg-white border-2 border-slate-200 rounded-xl py-3 pr-12 pl-4 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm placeholder:text-slate-400" 
             placeholder="ابحث برقم المعرف أو رقم التتبع..." 
             inputMode="search"
           />
        </div>

        {/* TAB 1: ACTIVE (Pending/Actionable/Failed Needs Review) */}
        {activeTab === 'active' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <h2 className="text-lg font-black text-slate-800 border-b border-slate-200 pb-2">سجل المهام الميدانية الجارية</h2>
             
             {filteredOrders.active.length === 0 ? (
               <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center text-slate-500 font-bold shadow-sm">
                 <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                 صندوق المهام اليدوية فارغ! أنت بطل هذا اليوم.
               </div>
             ) : (
               <div className="grid grid-cols-1 gap-6">
                 {filteredOrders.active.map(renderContextualOrderCard)}
               </div>
             )}
          </div>
        )}

        {/* TAB 2: ARCHIVE (Completed/Settlement Pending but Field Task Done) */}
        {activeTab === 'archive' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <h2 className="text-lg font-black text-emerald-800 border-b border-slate-200 pb-2 flex items-center gap-2 text-emerald-700"><CheckCircle2 className="w-5 h-5" /> أرشيف التسليمات الناجحة</h2>
             
             {filteredOrders.archive.length === 0 ? (
               <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500 font-bold shadow-sm">
                 <CheckCircle2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                 لا يوجد تاريخ مكتمل حديثاً.
               </div>
             ) : (
               <div className="grid grid-cols-1 gap-4 opacity-80 hover:opacity-100 transition-opacity">
                 {filteredOrders.archive.map(renderContextualOrderCard)}
               </div>
             )}
          </div>
        )}

      </main>
    </div>
  );
}
