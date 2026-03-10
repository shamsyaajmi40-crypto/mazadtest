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
  ReceiptText,
} from "lucide-react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { calculateCommission } from "../utils/commission";

type DeliveryOrder = {
  _id: string;
  status: string;
  failureReason?: string | null;
  deliveryFee?: number;
  trackingCode?: string;
  agentUser?: { _id: string; name?: string; phone?: string } | string | null;
  logs?: Array<{ status: string; by: any; note?: string; at?: string; createdAt?: string }>;
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

const GOVERNORATES = [
  "بغداد", "البصرة", "نينوى", "أربيل", "النجف", "كربلاء", "كركوك",
  "الأنبار", "ذي قار", "بابل", "صلاح الدين", "السليمانية", "دهوك",
  "واسط", "ميسان", "الديوانية", "المثنى", "ديالى"
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

const getCommission = (order: DeliveryOrder) => calculateCommission(order.auction?.currentPrice || 0);
const sellerPayout = (order: DeliveryOrder) => Math.max(0, Number(order.auction?.currentPrice || 0) - getCommission(order));
const extractReceiptNo = (order: DeliveryOrder) => {
  const log = order.logs?.find((l) => l.status === "COD_PAID_TO_SELLER" || l.status === "COMPLETED" || l.note?.includes("receiptNo="));
  if (!log || !log.note) return "-";
  const match = log.note.match(/receiptNo=([^;]+)/);
  return match && match[1] ? match[1] : "-";
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

const agentName = (agent: DeliveryOrder["agentUser"]) => {
  if (!agent) return "غير معيّن";
  if (typeof agent === "string") return `#${agent.slice(-6)}`;
  return agent.name || `#${agent._id?.slice(-6) || "---"}`;
};

export default function CourierStaffDashboard() {
  const { user, loading: authLoading, logout } = useContext(AuthContext);

  const [activeTab, setActiveTab] = useState<"orders" | "finances">("orders");
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
  const [newAgentEmail, setNewAgentEmail] = useState("");
  const [newAgentPassword, setNewAgentPassword] = useState("");
  const [newAgentGovernorate, setNewAgentGovernorate] = useState("");
  const [newAgentAddress, setNewAgentAddress] = useState("");

  const [assignAgentByOrder, setAssignAgentByOrder] = useState<Record<string, string>>({});
  const [otpByOrder, setOtpByOrder] = useState<Record<string, string>>({});
  const [receiptByOrder, setReceiptByOrder] = useState<Record<string, string>>({});
  const [reasonByOrder, setReasonByOrder] = useState<Record<string, string>>({});
  const [noteByOrder, setNoteByOrder] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(Date.now());
  const [showFailedArchive, setShowFailedArchive] = useState(false);
  const [showDoneArchive, setShowDoneArchive] = useState(false);
  const [expandedByOrder, setExpandedByOrder] = useState<Record<string, boolean>>({});
  const [showFailForm, setShowFailForm] = useState<Record<string, boolean>>({});

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
    if (!newAgentName || !newAgentPhone || !newAgentEmail || !newAgentPassword) {
      setError("الاسم والهاتف والإيميل وكلمة المرور مطلوبة");
      return;
    }
    try {
      await api.post("/courier/staff/agents", {
        name: newAgentName.trim(),
        phone: newAgentPhone.trim(),
        email: newAgentEmail.trim(),
        password: newAgentPassword,
        governorate: newAgentGovernorate,
        address: newAgentAddress.trim(),
      });
      setNewAgentName("");
      setNewAgentPhone("");
      setNewAgentEmail("");
      setNewAgentPassword("");
      setNewAgentGovernorate("");
      setNewAgentAddress("");
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
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              المندوب: {agentName(o.agentUser)}
            </div>
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
            <div className="text-[11px] text-slate-500 mb-3 bg-slate-50 p-2 rounded-lg inline-flex items-center gap-2 border border-slate-100">
              <span className="font-bold text-slate-700">التتبع (Tracking):</span> <span className="font-mono">{o.trackingCode || "غير متوفر"}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100/50">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">المندوب المكلّف</div>
                <div className="font-black text-slate-800 text-xs">{agentName(o.agentUser)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100/50">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">سعر الرسو</div>
                <div className="font-black text-slate-800 text-xs">{Number(o.auction?.currentPrice || 0).toLocaleString()} د.ع</div>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 border border-rose-100/50">
                <div className="text-[10px] text-rose-600 uppercase tracking-wider mb-1 font-bold">عمولة المنصة</div>
                <div className="font-black text-rose-900 text-xs">{getCommission(o).toLocaleString()} د.ع</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100/50">
                <div className="text-[10px] text-emerald-600 uppercase tracking-wider mb-1 font-bold">صافي البائع</div>
                <div className="font-black text-emerald-900 text-xs">{sellerPayout(o).toLocaleString()} د.ع</div>
              </div>
              <div className="rounded-xl bg-indigo-50 p-3 border border-indigo-100/50">
                <div className="text-[10px] text-indigo-600 uppercase tracking-wider mb-1 font-bold">حالة الطلب</div>
                <div className="font-black text-indigo-900 text-[11px] truncate">{statusLabel[o.status] || "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-blue-200 transition-colors">
                <div className="font-black text-slate-800 mb-2 text-xs flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  بيانات التسليم (المشتري)
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-600 flex items-start gap-1"><span className="text-slate-400 font-medium w-12 shrink-0">الاسم:</span> <span className="font-bold text-slate-800">{o.auction?.winner?.name || "-"}</span></div>
                  <div className="text-xs text-slate-600 flex items-start gap-1"><span className="text-slate-400 font-medium w-12 shrink-0">الهاتف:</span> <span className="font-mono font-bold text-slate-800">{o.auction?.winner?.phone || "-"}</span></div>
                  <div className="text-xs text-slate-600 flex items-start gap-1"><span className="text-slate-400 font-medium w-12 shrink-0">العنوان:</span> <span>{fullAddress(o.auction?.winner || null)}</span></div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:border-amber-200 transition-colors">
                <div className="font-black text-slate-800 mb-2 text-xs flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  بيانات الاستلام (البائع)
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-600 flex items-start gap-1"><span className="text-slate-400 font-medium w-12 shrink-0">الاسم:</span> <span className="font-bold text-slate-800">{o.auction?.seller?.name || "-"}</span></div>
                  <div className="text-xs text-slate-600 flex items-start gap-1"><span className="text-slate-400 font-medium w-12 shrink-0">الهاتف:</span> <span className="font-mono font-bold text-slate-800">{o.auction?.seller?.phone || "-"}</span></div>
                  <div className="text-xs text-slate-600 flex items-start gap-1"><span className="text-slate-400 font-medium w-12 shrink-0">العنوان:</span> <span>{fullAddress(o.auction?.seller || null)}</span></div>
                </div>
              </div>
            </div>

            {o.status === "DELIVERY_FAILED" && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 shadow-sm">
                <div className="text-xs font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  سبب الفشل: {failureReasonLabel[o.failureReason || ""] || o.failureReason || "-"}
                </div>
                <div className={`text-[11px] font-black mt-1 ${reviewOpen ? "text-rose-600" : "text-rose-900"}`}>
                  {reviewOpen
                    ? `المهلة المتبقية للتراجع عن الفشل: ${formatRemaining(deadlineMs - nowMs)}`
                    : "انتهت مهلة المراجعة، تم إغلاق الطلب وتطبيق العقوبة (إن وجدت)."}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100/80 mb-3">
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">تعيين مندوب التوصيل</div>
                <div className="flex flex-col gap-2">
                  <select
                    value={assignAgentByOrder[o._id] || ""}
                    onChange={(e) => setAssignAgentByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all outline-none"
                  >
                    <option value="">اختر مندوباً للنقل...</option>
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
                    className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    تعيين المندوب
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">تأكيد دفع السيولة (البائع)</div>
                <div className="flex flex-col gap-2">
                  <input
                    value={otpByOrder[o._id] || ""}
                    onChange={(e) => setOtpByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="OTP الدفع للبائع"
                  />
                  <input
                    value={receiptByOrder[o._id] || ""}
                    onChange={(e) => setReceiptByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="رقم الوصل (اختياري)"
                  />
                  <button
                    onClick={() => onCodPaid(o._id)}
                    disabled={!canCodPaid || isBusy}
                    className="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Wallet className="w-3.5 h-3.5" /> تأكيد الدفع
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-transparent">
              <button
                onClick={() => onPickedUp(o._id)}
                disabled={!canPickUp || isBusy}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95 inline-flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4 text-emerald-400" /> البائع سلّم البضاعة
              </button>

              <button
                onClick={() => onRevertFailed(o._id)}
                disabled={!canRevert || isBusy}
                className="w-full rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-all active:scale-95 inline-flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-amber-500" /> تراجع عن الفشل
              </button>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowFailForm((p) => ({ ...p, [o._id]: !p[o._id] }))}
                  disabled={!canFail || isBusy}
                  className={`w-full h-full rounded-xl border py-3 text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${showFailForm[o._id]
                    ? "border-rose-400 bg-rose-100 text-rose-800"
                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    } disabled:opacity-50`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" /> الإبلاغ عن فشل الطلب
                </button>

                {showFailForm[o._id] && (
                  <div className="bg-white border border-rose-200 shadow-sm rounded-2xl p-4 w-full animate-in fade-in slide-in-from-top-2 mt-1">
                    <div className="text-[11px] text-slate-500 uppercase font-black mb-3">تفاصيل فشل التوصيل</div>
                    <select
                      value={reasonByOrder[o._id] || ""}
                      onChange={(e) => setReasonByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
                      className="w-full rounded-xl border-slate-200 text-xs font-bold mb-2.5 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-slate-50 p-2.5 outline-none shadow-sm"
                    >
                      <option value="">اختر السبب...</option>
                      {failureReasons.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <input
                      value={noteByOrder[o._id] || ""}
                      onChange={(e) => setNoteByOrder((p) => ({ ...p, [o._id]: e.target.value }))}
                      className="w-full rounded-xl border-slate-200 text-xs mb-2.5 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-slate-50 p-2.5 outline-none shadow-sm"
                      placeholder="ملاحظات توضيحية للإدارة..."
                    />
                    <button
                      onClick={() => onFailed(o._id)}
                      disabled={!canFail || isBusy || !reasonByOrder[o._id]}
                      className="w-full rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      تأكيد المشكلة
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 relative pb-20 font-sans">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-br from-slate-900 to-slate-800 -z-0 rounded-b-[40px] md:rounded-b-[80px]" />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 relative z-10">
        <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-lg p-5 shadow-xl text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-2xl md:text-3xl font-black tracking-tight">لوحة موظف الشركة</div>
              <div className="text-sm text-slate-200 mt-1 font-medium">
                إدارة المندوبين، مراقبة طلبات التوصيل، ومتابعة الدفعات النقدية (COD)
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={loadOrders}
                className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 font-bold inline-flex items-center gap-2 transition-all active:scale-95"
              >
                <RefreshCcw className={`w-4 h-4 ${loadingOrders ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">تحديث</span>
              </button>
              <button
                onClick={logout}
                className="rounded-xl bg-rose-500/90 hover:bg-rose-500 px-4 py-2 font-bold inline-flex items-center gap-2 transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">خروج</span>
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">مندوبون فعّالون</div>
            <div className="text-3xl font-black text-indigo-600">
              {agents.filter((a) => a.isCourierActive !== false).length}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">طلبات فعالة</div>
            <div className="text-3xl font-black text-slate-800">{filteredOrders.active.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">طلبات فاشلة</div>
            <div className="text-3xl font-black text-rose-600">{filteredOrders.failed.length}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-4 text-center shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">طلبات منتهية</div>
            <div className="text-3xl font-black text-emerald-600">{filteredOrders.done.length}</div>
          </div>
        </div>
      </div>

      {/* --- التبويبات الرئيسية --- */}
      <div className="flex bg-slate-200/50 p-1.5 rounded-2xl w-fit mt-6 overflow-x-auto mx-auto sm:mx-0">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${activeTab === "orders" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
        >
          <Truck className="w-4 sm:w-5 h-4 sm:h-5" /> إدارة الطلبات والمندوبين
        </button>
        <button
          onClick={() => setActiveTab("finances")}
          className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 ${activeTab === "finances" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            }`}
        >
          <ReceiptText className="w-4 sm:w-5 h-4 sm:h-5" /> السجلات المالية للشركة
        </button>
      </div>

      {activeTab === "finances" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 w-full">
          {filteredOrders.done.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
              لا يوجد سجل مالي لطلبات مكتملة في قائمة اليوم.
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-indigo-200/60 bg-indigo-50/30 p-4 sm:p-5 shadow-sm">
                <div className="font-extrabold text-indigo-900 inline-flex items-center gap-2 text-base sm:text-lg mb-4">
                  <Wallet className="w-5 h-5 text-indigo-500" />
                  خلاصة الإيرادات
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="rounded-2xl bg-white border border-indigo-100 p-3 sm:p-4 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">إجمالي الكاش المستلم</div>
                    <div className="text-lg sm:text-xl font-black text-slate-900">
                      {filteredOrders.done.reduce((acc, o) => acc + Number(o.auction?.currentPrice || 0) + Number(o.deliveryFee || 0), 0).toLocaleString()} <span className="text-[10px] sm:text-xs text-slate-500">د.ع</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-slate-400 mt-1">المستلم من المشترين</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-emerald-100 p-3 sm:p-4 shadow-sm">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">إيرادات التوصيل لك</div>
                    <div className="text-lg sm:text-xl font-black text-emerald-700">
                      {filteredOrders.done.reduce((acc, o) => acc + Number(o.deliveryFee || 0), 0).toLocaleString()} <span className="text-[10px] sm:text-xs text-emerald-600/70">د.ع</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-emerald-600/70 mt-1">أرباح الشركة الصافية</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-violet-100 p-3 sm:p-4 shadow-sm">
                    <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1">مستحقات البائعين</div>
                    <div className="text-lg sm:text-xl font-black text-violet-700">
                      {filteredOrders.done.reduce((acc, o) => acc + sellerPayout(o), 0).toLocaleString()} <span className="text-[10px] sm:text-xs text-violet-600/70">د.ع</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-violet-600/70 mt-1">تم تسليمها نقداً</div>
                  </div>
                  <div className="rounded-2xl bg-white border border-rose-100 p-3 sm:p-4 shadow-sm">
                    <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">عمولات المنصة</div>
                    <div className="text-lg sm:text-xl font-black text-rose-700">
                      {filteredOrders.done.reduce((acc, o) => acc + getCommission(o), 0).toLocaleString()} <span className="text-[10px] sm:text-xs text-rose-600/70">د.ع</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-rose-600/70 mt-1">ديون للمنصة</div>
                  </div>
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 sm:p-4 shadow-sm text-white">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">إجمالي المزاد المباع</div>
                    <div className="text-lg sm:text-xl font-black text-white">
                      {filteredOrders.done.reduce((acc, o) => acc + Number(o.auction?.currentPrice || 0), 0).toLocaleString()} <span className="text-[10px] sm:text-xs text-slate-400">د.ع</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-slate-400 mt-1">قيمة البضائع</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-2">
                  <ReceiptText className="w-4 sm:w-5 h-4 sm:h-5 text-slate-500" />
                  <div className="font-extrabold text-slate-800 text-sm sm:text-base">تفاصيل المعاملات المالية المنجزة</div>
                </div>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                        <th className="px-3 sm:px-5 py-3 sm:py-4 whitespace-nowrap min-w-[120px]">رقم الوصل</th>
                        <th className="px-3 sm:px-5 py-3 sm:py-4 whitespace-nowrap">رقم الطلب</th>
                        <th className="px-3 sm:px-5 py-3 sm:py-4 whitespace-nowrap">المندوب</th>
                        <th className="px-3 sm:px-5 py-3 sm:py-4 whitespace-nowrap text-emerald-700">الكاش (COD)</th>
                        <th className="px-3 sm:px-5 py-3 sm:py-4 whitespace-nowrap text-indigo-700">أجرة النقل</th>
                        <th className="px-3 sm:px-5 py-3 sm:py-4 whitespace-nowrap text-rose-700">عمولة المنصة</th>
                        <th className="px-3 sm:px-5 py-3 sm:py-4 whitespace-nowrap text-violet-700">المدفوع للبائع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-xs sm:text-sm">
                      {filteredOrders.done.map((o) => {
                        const gross = Number(o.auction?.currentPrice || 0);
                        const fee = Number(o.deliveryFee || 0);
                        const totalCol = gross + fee;
                        const comm = getCommission(o);
                        const pay = sellerPayout(o);
                        const receipt = extractReceiptNo(o);
                        const aName = typeof o.agentUser === 'object' && o.agentUser?.name ? o.agentUser.name : "غير معروف";

                        return (
                          <tr key={o._id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 sm:px-5 py-3 sm:py-4">
                              <span className="font-mono text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                                {receipt}
                              </span>
                            </td>
                            <td className="px-3 sm:px-5 py-3 sm:py-4 font-mono text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">#{o._id.slice(-6).toUpperCase()}</td>
                            <td className="px-3 sm:px-5 py-3 sm:py-4 text-[11px] sm:text-xs text-slate-700 whitespace-nowrap">{aName}</td>
                            <td className="px-3 sm:px-5 py-3 sm:py-4 text-emerald-800 font-black whitespace-nowrap">{totalCol.toLocaleString()}</td>
                            <td className="px-3 sm:px-5 py-3 sm:py-4 text-indigo-700 font-bold whitespace-nowrap">{fee.toLocaleString()}</td>
                            <td className="px-3 sm:px-5 py-3 sm:py-4 text-rose-700 font-bold whitespace-nowrap">{comm.toLocaleString()}</td>
                            <td className="px-3 sm:px-5 py-3 sm:py-4 text-violet-800 font-black whitespace-nowrap">{pay.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 w-full">
          <div className="rounded-3xl border border-slate-200/60 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="font-extrabold text-slate-800 inline-flex items-center gap-2 text-base sm:text-lg">
                <UserCog className="w-5 h-5 text-indigo-500" />
                إدارة مناديب التوصيل
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadAgents}
                  className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors"
                  disabled={loadingAgents}
                >
                  {loadingAgents ? "..." : "تحديث"}
                </button>
                <button
                  onClick={() => setShowAgentModal(true)}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-bold text-white inline-flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  إضافة مندوب
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.length === 0 ? (
                <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400 font-medium">
                  لا يوجد مندوبون بعد. انقر على "إضافة مندوب" للبدء.
                </div>
              ) : (
                agents.map((a) => (
                  <div key={a._id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 flex items-center justify-between group hover:border-slate-200 transition-colors">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        {a.name}
                        {a.isCourierActive === false && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{a.phone}</div>
                    </div>
                    <button
                      onClick={() => onToggleAgent(a._id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-colors ${a.isCourierActive === false
                        ? "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                        : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        }`}
                    >
                      {a.isCourierActive === false ? "معطّل" : "فعّال"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-slate-200/60 bg-white p-2.5 shadow-sm">
              <div className="relative">
                <Search className="absolute right-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl bg-slate-50 hover:bg-slate-100 focus:bg-white border-0 py-3 pr-11 pl-4 text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  placeholder="ابحث برقم الطلب (OrderId) أو التتبع (Tracking)..."
                />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/60 bg-white p-2.5 shadow-sm flex items-center justify-between px-5">
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
                {showFailedArchive
                  ? "إخفاء الأرشيف"
                  : `عرض الأرشيف (${filteredOrders.failed.length})`}
              </button>
            </div>
          </div>

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
                {filteredOrders.active.length} طلبات
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
              {filteredOrders.active.length === 0 ? (
                <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
                  لا توجد طلبات قيد التنفيذ في الوقت الحالي.
                </div>
              ) : (
                filteredOrders.active.map(renderOrderCard)
              )}
            </div>
          </section>

          {
            showFailedArchive && (
              <section className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="inline-flex items-center gap-2 border-t-2 border-dashed border-slate-200 w-full pt-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                  <h2 className="text-lg font-black text-slate-800">الطلبات الفاشلة (للمراجعة)</h2>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{filteredOrders.failed.length}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {filteredOrders.failed.length === 0 ? (
                    <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
                      لا توجد طلبات فاشلة حالياً.
                    </div>
                  ) : (
                    filteredOrders.failed.map(renderOrderCard)
                  )}
                </div>
              </section>
            )
          }

          <section className="rounded-3xl border border-slate-200/60 bg-white p-2.5 shadow-sm flex items-center justify-between px-5 mt-6">
            <div className="text-sm font-black text-slate-700 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              أرشيف الطلبات المكتملة حديثاً
            </div>
            <button
              onClick={() => setShowDoneArchive((v) => !v)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${showDoneArchive
                ? "bg-slate-900 text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
            >
              {showDoneArchive
                ? "إخفاء"
                : `عرض (${filteredOrders.done.length})`}
            </button>
          </section>

          {
            showDoneArchive && (
              <section className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 opacity-90 hover:opacity-100 transition-opacity duration-300">
                  {filteredOrders.done.length === 0 ? (
                    <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
                      لا توجد طلبات منتهية في قائمة اليوم.
                    </div>
                  ) : (
                    filteredOrders.done.map(renderOrderCard)
                  )}
                </div>
              </section>
            )
          }
        </div>
      )}

      {
        showAgentModal && (
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
                  className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                  placeholder="اسم المندوب"
                />
                <input
                  value={newAgentPhone}
                  onChange={(e) => setNewAgentPhone(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                  placeholder="رقم الهاتف"
                  inputMode="tel"
                />
                <input
                  value={newAgentEmail}
                  onChange={(e) => setNewAgentEmail(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                  placeholder="البريد الإلكتروني"
                  type="email"
                />
                <input
                  value={newAgentPassword}
                  onChange={(e) => setNewAgentPassword(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                  placeholder="كلمة المرور"
                  type="password"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={newAgentGovernorate}
                    onChange={(e) => setNewAgentGovernorate(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-sm font-bold bg-white"
                  >
                    <option value="">المحافظة...</option>
                    {GOVERNORATES.map(gov => (
                      <option key={gov} value={gov}>{gov}</option>
                    ))}
                  </select>
                  <input
                    value={newAgentAddress}
                    onChange={(e) => setNewAgentAddress(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                    placeholder="العنوان"
                  />
                </div>
                <button
                  onClick={onCreateAgent}
                  disabled={!newAgentName || !newAgentPhone || !newAgentEmail || !newAgentPassword || newAgentPassword.length < 6}
                  className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  إنشاء المندوب
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div>
    </div >
  );
}
