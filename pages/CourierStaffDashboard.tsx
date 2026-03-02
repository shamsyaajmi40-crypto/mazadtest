import { useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Siren,
  LogOut,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Truck,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";

type DeliveryOrder = {
  _id: string;
  status: string;
  failureReason?: string | null;
  deliveryFee?: number;
  trackingCode?: string;
  agentUser?: { _id: string; name?: string; phone?: string } | string | null;
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

type Agent = {
  _id: string;
  name: string;
  phone: string;
  isCourierActive?: boolean;
};

const failureReasons = [
  { value: "SELLER_NO_SHOW", label: "البائع غير متواجد" },
  { value: "SELLER_NOT_READY", label: "البائع غير جاهز" },
  { value: "COURIER_ISSUE", label: "مشكلة لوجستية" },
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
  ["COD_PAID_TO_SELLER", "COMPLETED"].includes(status);

const sellerPayout = (order: DeliveryOrder) => Number(order.auction?.currentPrice || 0);

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

const agentName = (agent: DeliveryOrder["agentUser"]) => {
  if (!agent) return "غير معيّن";
  if (typeof agent === "string") return `#${agent.slice(-6)}`;
  return agent.name || `#${agent._id?.slice(-6) || "---"}`;
};

export default function CourierStaffDashboard() {
  const { user, loading: authLoading, logout } = useContext(AuthContext);

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showAgentModal, setShowAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentPhone, setNewAgentPhone] = useState("");
  const [newAgentPassword, setNewAgentPassword] = useState("");

  const [assignAgentByOrder, setAssignAgentByOrder] = useState<Record<string, string>>({});
  const [otpByOrder, setOtpByOrder] = useState<Record<string, string>>({});
  const [receiptByOrder, setReceiptByOrder] = useState<Record<string, string>>({});
  const [reasonByOrder, setReasonByOrder] = useState<Record<string, string>>({});
  const [noteByOrder, setNoteByOrder] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(Date.now());
  const [showFailedArchive, setShowFailedArchive] = useState(false);
  const [expandedByOrder, setExpandedByOrder] = useState<Record<string, boolean>>({});

  const loadOrders = async () => {
    setLoadingOrders(true);
    setError(null);
    try {
      const { data } = await api.get("/courier/staff/orders");
      setOrders(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "فشل جلب الطلبات");
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadAgents = async () => {
    setLoadingAgents(true);
    setError(null);
    try {
      const { data } = await api.get("/courier/staff/agents");
      setAgents(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "فشل جلب المندوبين");
    } finally {
      setLoadingAgents(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadAgents();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? orders.filter((o) =>
          o._id.toLowerCase().includes(q) || (o.trackingCode || "").toLowerCase().includes(q)
        )
      : orders;

    return {
      active: list.filter((o) => !isFinal(o.status) && o.status !== "DELIVERY_FAILED"),
      failed: list.filter((o) => o.status === "DELIVERY_FAILED"),
      done: list.filter((o) => isFinal(o.status)),
    };
  }, [orders, search]);

  const runOrderAction = async (orderId: string, fn: () => Promise<void>) => {
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

  const onAssignAgent = (orderId: string) =>
    runOrderAction(orderId, async () => {
      const agentUserId = assignAgentByOrder[orderId];
      if (!agentUserId) throw new Error("اختر مندوباً أولاً");
      await api.post(`/courier/orders/${orderId}/assign-agent`, { agentUserId });
    });

  const onPickedUp = (orderId: string) =>
    runOrderAction(orderId, async () => {
      await api.post(`/courier/orders/${orderId}/picked-up`);
    });

  const onCodPaid = (orderId: string) =>
    runOrderAction(orderId, async () => {
      const otp = (otpByOrder[orderId] || "").trim();
      if (!otp) throw new Error("أدخل OTP البائع");
      await api.post(`/courier/orders/${orderId}/cod-paid`, {
        otp,
        receiptNo: receiptByOrder[orderId] || "",
      });
      setOtpByOrder((p) => ({ ...p, [orderId]: "" }));
      setReceiptByOrder((p) => ({ ...p, [orderId]: "" }));
    });

  const onFailed = (orderId: string) =>
    runOrderAction(orderId, async () => {
      const reason = (reasonByOrder[orderId] || "").trim();
      if (!reason) throw new Error("اختر سبب الفشل");
      await api.post(`/courier/orders/${orderId}/failed`, {
        reason,
        note: noteByOrder[orderId] || "",
      });
    });

  const onRevertFailed = (orderId: string) =>
    runOrderAction(orderId, async () => {
      await api.post(`/courier/orders/${orderId}/failed/revert`, {
        note: noteByOrder[orderId] || "",
      });
    });

  const onCreateAgent = async () => {
    setError(null);
    if (!newAgentName || !newAgentPhone || !newAgentPassword) {
      setError("الاسم والهاتف وكلمة المرور مطلوبة");
      return;
    }
    try {
      await api.post("/courier/staff/agents", {
        name: newAgentName,
        phone: newAgentPhone,
        password: newAgentPassword,
      });
      setNewAgentName("");
      setNewAgentPhone("");
      setNewAgentPassword("");
      setShowAgentModal(false);
      await loadAgents();
    } catch (e: any) {
      setError(e?.response?.data?.message || "فشل إضافة المندوب");
    }
  };

  const onToggleAgent = async (agentId: string) => {
    setError(null);
    try {
      await api.patch(`/courier/staff/agents/${agentId}/toggle`);
      await loadAgents();
    } catch (e: any) {
      setError(e?.response?.data?.message || "فشل تحديث حالة المندوب");
    }
  };

  if (authLoading) return <div className="p-10 text-center">جاري التحميل...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "courier_staff") return <Navigate to="/" replace />;

  const renderOrderCard = (o: DeliveryOrder) => {
    const expanded = !!expandedByOrder[o._id];
    const isBusy = busyOrderId === o._id;
    const isDone = isFinal(o.status);
    const isFailed = o.status === "DELIVERY_FAILED";
    const canAssign = ["READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(o.status);
    const canPickUp = ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(o.status);
    const canCodPaid = ["DELIVERED"].includes(o.status);
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

            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-500">المندوب</div>
            <div className="font-black text-slate-800">{agentName(o.agentUser)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-500">قيمة المزاد</div>
            <div className="font-black text-slate-800">
              {Number(o.auction?.currentPrice || 0).toLocaleString()} د.ع
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-500">مستحق البائع</div>
            <div className="font-black text-slate-800">{sellerPayout(o).toLocaleString()} د.ع</div>
          </div>
        </div>

            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="font-black text-slate-800 mb-1">بيانات المشتري</div>
                <div className="text-slate-600">الاسم: {o.auction?.winner?.name || "-"}</div>
                <div className="text-slate-600">الهاتف: {o.auction?.winner?.phone || "-"}</div>
                <div className="text-slate-600">العنوان: {fullAddress(o.auction?.winner || null)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="font-black text-slate-800 mb-1">بيانات البائع</div>
                <div className="text-slate-600">الاسم: {o.auction?.seller?.name || "-"}</div>
                <div className="text-slate-600">الهاتف: {o.auction?.seller?.phone || "-"}</div>
                <div className="text-slate-600">العنوان: {fullAddress(o.auction?.seller || null)}</div>
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
          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="text-[11px] text-slate-500 mb-1.5">تعيين مندوب</div>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={assignAgentByOrder[o._id] || ""}
                onChange={(e) => setAssignAgentByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
                className="rounded-lg border px-2.5 py-1.5 text-xs font-bold"
              >
                <option value="">اختر مندوباً</option>
                {agents
                  .filter((a) => a.isCourierActive !== false)
                  .map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} - {a.phone}
                    </option>
                  ))}
              </select>
              <button
                onClick={() => onAssignAgent(o._id)}
                disabled={!canAssign || isBusy || !assignAgentByOrder[o._id]}
                className="rounded-lg bg-slate-900 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                تعيين
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onPickedUp(o._id)}
              disabled={!canPickUp || isBusy}
              className="rounded-lg bg-slate-900 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Truck className="w-4 h-4" />
                تأكيد الاستلام
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

          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="text-[11px] text-slate-500 mb-1.5">تأكيد دفع COD للبائع</div>
            <input
              value={otpByOrder[o._id] || ""}
              onChange={(e) => setOtpByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
              className="w-full rounded-lg border px-2.5 py-1.5 text-center text-sm tracking-widest font-black"
              placeholder="OTP البائع"
            />
            <input
              value={receiptByOrder[o._id] || ""}
              onChange={(e) => setReceiptByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border px-2.5 py-1.5 text-xs"
              placeholder="رقم الوصل (اختياري)"
            />
            <button
              onClick={() => onCodPaid(o._id)}
              disabled={!canCodPaid || isBusy}
              className="mt-1.5 w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                تأكيد دفع COD
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
              {failureReasons.map((r) => (
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
            <button
              onClick={() => onFailed(o._id)}
              disabled={!canFail || isBusy}
              className="mt-1.5 w-full rounded-lg bg-rose-600 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                تسجيل فشل
              </span>
            </button>
          </div>
        </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-black text-slate-900">لوحة موظف الشركة</div>
            <div className="text-sm text-slate-600 mt-1">
              إدارة المندوبين وطلبات التوصيل والدفع.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadOrders}
              className="rounded-xl border px-3 py-2 font-bold inline-flex items-center gap-2"
            >
              <RefreshCcw className={`w-4 h-4 ${loadingOrders ? "animate-spin" : ""}`} />
              تحديث الطلبات
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border bg-white p-3 text-center">
          <div className="text-xs text-slate-500">مندوبون فعّالون</div>
          <div className="text-2xl font-black text-emerald-700">
            {agents.filter((a) => a.isCourierActive !== false).length}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-3 text-center">
          <div className="text-xs text-slate-500">طلبات فعالة</div>
          <div className="text-2xl font-black text-slate-900">{filteredOrders.active.length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-3 text-center">
          <div className="text-xs text-slate-500">طلبات فاشلة (مخفية)</div>
          <div className="text-2xl font-black text-amber-700">{filteredOrders.failed.length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-3 text-center">
          <div className="text-xs text-slate-500">طلبات منتهية</div>
          <div className="text-2xl font-black text-emerald-700">{filteredOrders.done.length}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-black text-slate-900 inline-flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            إدارة المندوبين
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadAgents}
              className="rounded-xl border px-3 py-2 text-sm font-bold"
              disabled={loadingAgents}
            >
              {loadingAgents ? "..." : "تحديث"}
            </button>
            <button
              onClick={() => setShowAgentModal(true)}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة مندوب
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {agents.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-center text-slate-500">
              لا يوجد مندوبون بعد.
            </div>
          ) : (
            agents.map((a) => (
              <div key={a._id} className="rounded-2xl border p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{a.name}</div>
                  <div className="text-xs text-slate-500">{a.phone}</div>
                </div>
                <button
                  onClick={() => onToggleAgent(a._id)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold border ${
                    a.isCourierActive === false
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {a.isCourierActive === false ? "معطّل" : "فعّال"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border pl-9 pr-3 py-2"
            placeholder="بحث بالـ orderId أو tracking"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-black text-slate-700">أرشيف الطلبات الفاشلة</div>
          <button
            onClick={() => setShowFailedArchive((v) => !v)}
            className="rounded-xl border px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            {showFailedArchive
              ? "إخفاء الأرشيف"
              : `عرض الأرشيف (${filteredOrders.failed.length})`}
          </button>
        </div>
      </div>

      <section>
        <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 inline-flex items-center gap-2">
          <Siren className="w-4 h-4 text-rose-600" />
          <span className="text-sm font-black text-rose-700">طلبات قيد التنفيذ - تحتاج انتباه</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-2.5">
          {filteredOrders.active.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">
              لا توجد طلبات قيد التنفيذ.
            </div>
          ) : (
            filteredOrders.active.map(renderOrderCard)
          )}
        </div>
      </section>

      {showFailedArchive && (
        <section>
          <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-black text-amber-700">أرشيف الطلبات الفاشلة - للمراجعة</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-2.5">
            {filteredOrders.failed.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">
                لا توجد طلبات فاشلة حالياً.
              </div>
            ) : (
              filteredOrders.failed.map(renderOrderCard)
            )}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 inline-flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-black text-emerald-700">طلبات منتهية - لا تتطلب إجراء</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-2.5 opacity-90">
          {filteredOrders.done.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-slate-500">
              لا توجد طلبات منتهية.
            </div>
          ) : (
            filteredOrders.done.map(renderOrderCard)
          )}
        </div>
      </section>

      {showAgentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-slate-900">إضافة مندوب جديد</div>
              <button
                onClick={() => setShowAgentModal(false)}
                className="rounded-xl border p-2 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="اسم المندوب"
              />
              <input
                value={newAgentPhone}
                onChange={(e) => setNewAgentPhone(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="رقم الهاتف"
                inputMode="tel"
              />
              <input
                value={newAgentPassword}
                onChange={(e) => setNewAgentPassword(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
                placeholder="كلمة المرور"
                type="password"
              />
              <button
                onClick={onCreateAgent}
                className="w-full rounded-xl bg-slate-900 py-2 text-sm font-bold text-white"
              >
                إنشاء المندوب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
