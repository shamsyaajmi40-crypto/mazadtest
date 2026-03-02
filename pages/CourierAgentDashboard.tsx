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
  const [expandedByOrder, setExpandedByOrder] = useState<Record<string, boolean>>({});

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
      ? "border-emerald-200 bg-emerald-50/30"
      : isFailed
      ? "border-amber-200 bg-amber-50/30"
      : "border-blue-200 bg-blue-50/20";

    const badgeTone = isDone
      ? "bg-emerald-100 text-emerald-700"
      : isFailed
      ? "bg-amber-100 text-amber-700"
      : "bg-blue-100 text-blue-700";

    return (
      <div key={o._id} className={`rounded-xl border p-3 shadow-sm ${cardTone}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-black text-sm text-slate-900">طلب #{o._id.slice(-6)}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeTone}`}>
              {statusLabel[o.status] || o.status}
            </span>
            <button
              onClick={() => setExpandedByOrder((p) => ({ ...p, [o._id]: !expanded }))}
              className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1"
            >
              {expanded ? (
                <>
                  إخفاء
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  إظهار
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {expanded && (
          <>
            <div className="text-[11px] text-slate-500 mt-1">
              {o.trackingCode ? `Tracking: ${o.trackingCode}` : "بدون Tracking"}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-500">مستحقات الدفع (مع التوصيل)</div>
            <div className="font-black text-slate-800">{totalDueWithDelivery(o).toLocaleString()} د.ع</div>
          </div>
        </div>

            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="font-black text-slate-800 mb-1">بيانات الزبون</div>
                <div className="text-slate-600">الاسم: {o.auction?.winner?.name || "-"}</div>
                <div className="text-slate-600">الهاتف: {o.auction?.winner?.phone || "-"}</div>
                <div className="text-slate-600">العنوان: {fullAddress(o.auction?.winner || null)}</div>
              </div>
            </div>

        {o.status === "DELIVERY_FAILED" && (
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs font-bold text-amber-800">
              سبب الفشل: {failureReasonLabel[o.failureReason || ""] || o.failureReason || "-"}
            </div>
            <div
              className={`rounded-xl p-2 text-xs font-black ${
                reviewOpen
                  ? "border border-blue-200 bg-blue-50 text-blue-800"
                  : "border border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {reviewOpen
                ? `المهلة المتبقية للتراجع: ${formatRemaining(deadlineMs - nowMs)}`
                : "انتهت مهلة المراجعة، سيتم/تم تطبيق العقوبة."}
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          <button
            onClick={() => onPickedUp(o._id)}
            disabled={!canPickUp || isBusy}
            className="w-full rounded-lg bg-slate-900 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <span className="inline-flex items-center gap-2">
              <Truck className="w-4 h-4" />
              تأكيد الاستلام من البائع
            </span>
          </button>

          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="text-[11px] text-slate-500 mb-1.5">تأكيد التسليم (OTP المشتري)</div>
            <input
              value={otpByOrder[o._id] || ""}
              onChange={(e) => setOtpByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
              className="w-full rounded-lg border px-2.5 py-1.5 text-center text-sm tracking-widest font-black"
              placeholder="أدخل OTP"
            />
            <button
              onClick={() => onDelivered(o._id)}
              disabled={!canDeliver || isBusy}
              className="mt-1.5 w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                تأكيد التسليم
              </span>
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="text-[11px] text-slate-500 mb-1.5">تسجيل فشل التوصيل</div>
            <select
              value={reasonByOrder[o._id] || ""}
              onChange={(e) => setReasonByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
              className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-bold"
            >
              <option value="">اختر السبب</option>
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <input
              value={noteByOrder[o._id] || ""}
              onChange={(e) => setNoteByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border px-2.5 py-1.5 text-xs"
              placeholder="ملاحظة (اختياري)"
            />
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onFailed(o._id)}
                disabled={!canFail || isBusy}
                className="rounded-lg bg-rose-600 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  تسجيل فشل
                </span>
              </button>
              <button
                onClick={() => onRevertFailed(o._id)}
                disabled={!canRevert || isBusy}
                className="rounded-lg border border-slate-300 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  التراجع عن الفشل
                </span>
              </button>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-black text-slate-900">لوحة المندوب</div>
            <div className="text-sm text-slate-600 mt-1">إدارة طلبات الاستلام والتسليم.</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadOrders}
              className="rounded-xl border px-3 py-2 font-bold inline-flex items-center gap-2"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
            <button
              onClick={logout}
              className="rounded-xl border px-3 py-2 font-bold inline-flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              خروج
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="rounded-2xl border bg-white p-3 text-center">
          <div className="text-xs text-slate-500">طلبات فعالة</div>
          <div className="text-2xl font-black text-slate-900">{grouped.active.length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-3 text-center">
          <div className="text-xs text-slate-500">طلبات فاشلة (مخفية)</div>
          <div className="text-2xl font-black text-amber-700">{grouped.failed.length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-3 text-center">
          <div className="text-xs text-slate-500">طلبات منتهية</div>
          <div className="text-2xl font-black text-emerald-700">{grouped.done.length}</div>
        </div>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black text-slate-700">أرشيف الطلبات الفاشلة</div>
            <button
              onClick={() => setShowFailedArchive((v) => !v)}
              className="rounded-xl border px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              {showFailedArchive ? "إخفاء الأرشيف" : `عرض الأرشيف (${grouped.failed.length})`}
            </button>
          </div>
        </section>

        <section>
          <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 inline-flex items-center gap-2">
            <Siren className="w-4 h-4 text-rose-600" />
            <span className="text-sm font-black text-rose-700">طلبات قيد التنفيذ - تحتاج انتباه</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {grouped.active.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">
                لا توجد طلبات قيد التنفيذ.
              </div>
            ) : (
              grouped.active.map(renderCard)
            )}
          </div>
        </section>

        {showFailedArchive && (
          <section>
            <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 inline-flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-black text-amber-700">أرشيف الطلبات الفاشلة - للمراجعة</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {grouped.failed.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">
                  لا توجد طلبات فاشلة حالياً.
                </div>
              ) : (
                grouped.failed.map(renderCard)
              )}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-black text-emerald-700">طلبات منتهية - لا تتطلب إجراء</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 opacity-90">
            {grouped.done.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">
                لا توجد طلبات منتهية.
              </div>
            ) : (
              grouped.done.map(renderCard)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
