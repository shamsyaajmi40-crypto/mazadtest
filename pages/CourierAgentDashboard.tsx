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
  Siren,
} from "lucide-react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";

type DeliveryOrder = {
  _id: string;
  status: string;
  failureReason?: string | null;
  deliveryFee?: number;
  trackingCode?: string;
  auction?: {
    currentPrice?: number;
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
  READY_FOR_PICKUP: "بانتظار الاستلام من البائع",
  PICKED_UP: "تم الاستلام من البائع",
  OUT_FOR_DELIVERY: "قيد التوصيل",
  DELIVERED: "تم التسليم للمشتري",
  DELIVERY_FAILED: "فشل التوصيل",
  COD_PAID_TO_SELLER: "تم دفع COD للبائع",
  COMPLETED: "مكتمل",
};

const isFinal = (status: string) =>
  ["DELIVERED", "COD_PAID_TO_SELLER", "COMPLETED"].includes(status);

const totalDueWithDelivery = (order: DeliveryOrder) => {
  const gross = Number(order.auction?.currentPrice || 0);
  const fee = Number(order.deliveryFee || 0);
  return Math.max(0, gross + fee);
};

const formatRemaining = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
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
  const [showFailedArchive, setShowFailedArchive] = useState(false);
  const [showDoneArchive, setShowDoneArchive] = useState(false);
  const [expandedByOrder, setExpandedByOrder] = useState<Record<string, boolean>>({});
  const [showFailForm, setShowFailForm] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const active = orders.filter((o) => !isFinal(o.status) && o.status !== "DELIVERY_FAILED");
    const failed = orders.filter((o) => o.status === "DELIVERY_FAILED");
    const done = orders.filter((o) => isFinal(o.status));
    return { active, failed, done };
  }, [orders]);

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

  const onPickedUp = (orderId: string) =>
    runAction(orderId, async () => {
      await api.post(`/courier/orders/${orderId}/picked-up`);
    });

  const onDelivered = (orderId: string) =>
    runAction(orderId, async () => {
      const otp = (otpByOrder[orderId] || "").trim();
      if (!otp) throw new Error("أدخل OTP للمشتري");
      await api.post(`/courier/orders/${orderId}/delivered`, { otp });
      setOtpByOrder((p) => ({ ...p, [orderId]: "" }));
    });

  const onFailed = (orderId: string) =>
    runAction(orderId, async () => {
      const reason = (reasonByOrder[orderId] || "").trim();
      if (!reason) throw new Error("اختر سبب الفشل");
      await api.post(`/courier/orders/${orderId}/failed`, {
        reason,
        note: noteByOrder[orderId] || "",
      });
    });

  const onRevertFailed = (orderId: string) =>
    runAction(orderId, async () => {
      await api.post(`/courier/orders/${orderId}/failed/revert`, {
        note: noteByOrder[orderId] || "",
      });
    });

  if (authLoading) return <div className="p-10 text-center">جاري التحميل...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "courier_agent") return <Navigate to="/" replace />;

  const renderCard = (o: DeliveryOrder) => {
    const expanded = !!expandedByOrder[o._id];
    const isBusy = busyOrderId === o._id;
    const isDone = isFinal(o.status);
    const isFailed = o.status === "DELIVERY_FAILED";
    const canPickUp = ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(o.status);
    const canDeliver = ["PICKED_UP", "OUT_FOR_DELIVERY"].includes(o.status);
    const canFail = !isFinal(o.status);
    const deadlineMs = o.auction?.confirmationDeadline
      ? new Date(o.auction.confirmationDeadline).getTime()
      : 0;
    const reviewOpen = o.status === "DELIVERY_FAILED" && deadlineMs > nowMs;
    const canRevert = reviewOpen;

    const cardTone = isDone
      ? "border-emerald-200/60 bg-white"
      : isFailed
        ? "border-rose-200/60 bg-white"
        : "border-slate-200/60 bg-white";

    const badgeTone = isDone
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 shadow-emerald-100/50"
      : isFailed
        ? "bg-rose-50 text-rose-700 ring-rose-200 shadow-rose-100/50"
        : "bg-blue-50 text-blue-700 ring-blue-200 shadow-blue-100/50";

    const indicatorColor = isDone ? "bg-emerald-500" : isFailed ? "bg-rose-500" : "bg-blue-500";

    return (
      <div key={o._id} className={`group relative rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${cardTone}`}>
        <div className={`absolute top-0 right-0 w-1.5 h-full ${indicatorColor}`} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-2">
          <div>
            <div className="font-extrabold text-sm text-slate-900 tracking-tight">طلب #{o._id.slice(-6).toUpperCase()}</div>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset shadow-sm ${badgeTone}`}>
              {statusLabel[o.status] || o.status}
            </span>
            <button
              onClick={() => setExpandedByOrder((p) => ({ ...p, [o._id]: !expanded }))}
              className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors inline-flex items-center gap-1.5 shadow-sm"
            >
              {expanded ? (
                <>إخفاء <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>تفاصيل <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 pr-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-[11px] text-slate-500 mb-4 bg-slate-50 p-2 rounded-lg inline-flex items-center gap-2 border border-slate-100">
              <span className="font-bold text-slate-700">التتبع:</span> <span className="font-mono">{o.trackingCode || "غير متوفر"}</span>
            </div>

            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-emerald-400" />
              <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">المبلغ المراد جمعه من المشتري (COD)</div>
              <div className="text-2xl font-black text-emerald-900">{totalDueWithDelivery(o).toLocaleString()} د.ع</div>
              <div className="text-[10px] text-emerald-700/70 mt-1">يُسلّم كاش عند إعطاء البضاعة.</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm relative hover:border-amber-200 transition-colors">
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
                <div className="font-black text-slate-800 mb-3 text-xs pr-4">موقع الاستلام (البائع)</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">👤</span> <span className="font-bold text-slate-800 text-sm">{o.auction?.seller?.name || "-"}</span></div>
                  <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">📱</span> <span className="font-mono font-bold text-slate-800 text-sm tracking-wide">{o.auction?.seller?.phone || "-"}</span></div>
                  <div className="flex items-start gap-2"><span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs shrink-0 mt-0.5">📍</span> <span className="text-slate-600 text-sm leading-tight">{fullAddress(o.auction?.seller || null)}</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm relative hover:border-blue-200 transition-colors">
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse" />
                <div className="font-black text-slate-800 mb-3 text-xs pr-4">موقع التسليم (المشتري)</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">👤</span> <span className="font-bold text-slate-800 text-sm">{o.auction?.winner?.name || "-"}</span></div>
                  <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">📱</span> <span className="font-mono font-bold text-slate-800 text-sm tracking-wide">{o.auction?.winner?.phone || "-"}</span></div>
                  <div className="flex items-start gap-2"><span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs shrink-0 mt-0.5">📍</span> <span className="text-slate-600 text-sm leading-tight">{fullAddress(o.auction?.winner || null)}</span></div>
                </div>
              </div>
            </div>

            {o.status === "DELIVERY_FAILED" && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                <div className="text-sm font-bold text-rose-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  سبب الفشل: {failureReasonLabel[o.failureReason || ""] || o.failureReason || "-"}
                </div>
                <div className={`text-xs font-black mt-1 ${reviewOpen ? "text-rose-600" : "text-rose-900"}`}>
                  {reviewOpen
                    ? `المهلة المتبقية للتراجع عن الفشل: ${formatRemaining(deadlineMs - nowMs)}`
                    : "انتهت مهلة المراجعة، تم إغلاق الطلب."}
                </div>
              </div>
            )}

            <div className="space-y-3 bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4">
              <button
                onClick={() => onPickedUp(o._id)}
                disabled={!canPickUp || isBusy}
                className="w-full rounded-xl bg-slate-900 py-4 text-sm font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Truck className="w-5 h-5 text-emerald-400" /> تأكيد استلام البضاعة من البائع
              </button>

              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col sm:flex-row gap-2">
                <input
                  value={otpByOrder[o._id] || ""}
                  onChange={(e) => setOtpByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
                  className="flex-1 rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg tracking-widest font-black shadow-inner focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors outline-none"
                  placeholder="رمز OTP المشتري"
                  inputMode="numeric"
                />
                <button
                  onClick={() => onDelivered(o._id)}
                  disabled={!canDeliver || isBusy}
                  className="w-full sm:w-auto rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2 min-w-[140px]"
                >
                  <CheckCircle2 className="w-5 h-5" /> تسليم
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-transparent">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowFailForm((p) => ({ ...p, [o._id]: !p[o._id] }))}
                  disabled={!canFail || isBusy}
                  className={`w-full h-full rounded-xl border-2 py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2 ${showFailForm[o._id]
                      ? "border-rose-500 bg-rose-50 text-rose-800"
                      : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                    } disabled:opacity-50`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" /> الإبلاغ عن مشكلة / فشل التوصيل
                </button>

                {showFailForm[o._id] && (
                  <div className="bg-rose-50/50 border border-rose-200 shadow-inner rounded-xl p-4 w-full animate-in fade-in slide-in-from-top-2">
                    <div className="text-[11px] text-slate-500 uppercase font-black mb-3">تفاصيل المشكلة</div>
                    <select
                      value={reasonByOrder[o._id] || ""}
                      onChange={(e) => setReasonByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
                      className="w-full rounded-xl border-slate-200 text-xs font-bold mb-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white p-3 outline-none shadow-sm"
                    >
                      <option value="">ما هو سبب عدم التوصيل؟...</option>
                      {reasons.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <input
                      value={noteByOrder[o._id] || ""}
                      onChange={(e) => setNoteByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
                      className="w-full rounded-xl border-slate-200 text-xs mb-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white p-3 outline-none shadow-sm"
                      placeholder="ملاحظات توضيحية للإدارة..."
                    />
                    <button
                      onClick={() => onFailed(o._id)}
                      disabled={!canFail || isBusy || !reasonByOrder[o._id]}
                      className="w-full rounded-xl bg-rose-600 py-3 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      تأكيد المشكلة (يغلق الطلب)
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => onRevertFailed(o._id)}
                disabled={!canRevert || isBusy}
                className="w-full rounded-xl border border-slate-300 bg-white py-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-amber-500" /> تراجع عن قيد الفشل
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 relative pb-24 font-sans">
      <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-br from-slate-900 to-slate-800 -z-0 rounded-b-[40px]" />

      <div className="max-w-4xl mx-auto p-4 space-y-5 relative z-10">
        <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-lg p-5 shadow-xl text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-black tracking-tight">لوحة المندوب</div>
              <div className="text-sm text-slate-200 mt-1 font-medium">إدارة ومتابعة طلبات الاستلام والتوصيل في الميدان.</div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={loadOrders}
                className="flex-1 sm:flex-none rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 font-bold inline-flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                تحديث
              </button>
              <button
                onClick={logout}
                className="flex-1 sm:flex-none rounded-xl bg-rose-500/90 hover:bg-rose-500 px-4 py-2.5 font-bold inline-flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                خروج
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-3 sm:p-4 text-center shadow-sm">
            <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 sm:mb-2 line-clamp-1">طلبات فعالة</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{grouped.active.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-3 sm:p-4 text-center shadow-sm">
            <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 sm:mb-2 line-clamp-1">طلبات فاشلة</div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600">{grouped.failed.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-3 sm:p-4 text-center shadow-sm">
            <div className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 sm:mb-2 line-clamp-1">طلبات منتهية</div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">{grouped.done.length}</div>
          </div>
        </div>

        <div className="space-y-6 pt-2">
          <section className="rounded-3xl border border-slate-200/60 bg-white p-2.5 shadow-sm flex items-center justify-between px-5">
            <div className="text-sm font-black text-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              أرشيف الطلبات الفاشلة
            </div>
            <button
              onClick={() => setShowFailedArchive((v) => !v)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${showFailedArchive
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
            >
              {showFailedArchive ? "إخفاء" : `عرض (${grouped.failed.length})`}
            </button>
          </section>

          <section className="space-y-4 pt-4 relative">
            <div className="absolute -inset-2 rounded-3xl bg-blue-50/50 border border-blue-100/50 -z-10" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border-2 border-blue-500 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
              <div className="inline-flex items-center gap-3">
                <div className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500"></span>
                </div>
                <h2 className="text-xl font-black text-blue-900 tracking-tight">الطلبات الجارية (الأهم - قيد التنفيذ)</h2>
              </div>
              <span className="rounded-xl bg-blue-500 px-4 py-1.5 text-sm font-bold text-white shadow-sm flex items-center gap-2 w-max ring-4 ring-blue-50">
                <Truck className="w-4 h-4" />
                {grouped.active.length} طلبات
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grouped.active.length === 0 ? (
                <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
                  أنت الآن جاهز! لا توجد طلبات قيد التنفيذ.
                </div>
              ) : (
                grouped.active.map(renderCard)
              )}
            </div>
          </section>

          {showFailedArchive && (
            <section className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="inline-flex items-center gap-2 border-t border-slate-200 w-full pt-6">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                <h2 className="text-lg font-black text-slate-800">الطلبات الفاشلة (انتظار مراجعة الإدارة)</h2>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">{grouped.failed.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grouped.failed.length === 0 ? (
                  <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
                    لا توجد طلبات فاشلة.
                  </div>
                ) : (
                  grouped.failed.map(renderCard)
                )}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-slate-200/60 bg-white p-2.5 shadow-sm flex items-center justify-between px-5 mt-6">
            <div className="text-sm font-black text-slate-700 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              الطلبات المكتملة حديثاً
            </div>
            <button
              onClick={() => setShowDoneArchive((v) => !v)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${showDoneArchive
                ? "bg-slate-900 text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
            >
              {showDoneArchive ? "إخفاء" : `عرض (${grouped.done.length})`}
            </button>
          </section>

          {showDoneArchive && (
            <section className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-90 hover:opacity-100 transition-opacity">
                {grouped.done.length === 0 ? (
                  <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
                    لم تكمل أي طلبات حتى الآن.
                  </div>
                ) : (
                  grouped.done.map(renderCard)
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
