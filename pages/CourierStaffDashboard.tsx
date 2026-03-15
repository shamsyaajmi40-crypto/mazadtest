import { useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CreditCard,
  Siren,
  LogOut,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Truck,
  User,
  UserCog,
  Wallet,
  X,
  ReceiptText,
} from "lucide-react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { calculateCommission } from "../utils/commission";
import "./CourierStaffDashboard.css";

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
  receiptId?: string | null;
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
  "بغداد", "البصرة", "نينوى", "أربيل", "النجف", "كربلاء", "كركوك", "الأنبار", "ذي قار", 
  "بابل", "صلاح الدين", "السليمانية", "دهوك", "واسط", "ميسان", "الديوانية", "المثنى", "ديالى"
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

const isFinal = (status: string) => ["COD_PAID_TO_SELLER", "COMPLETED"].includes(status);

const getCommission = (order: DeliveryOrder) => calculateCommission(order.auction?.currentPrice || 0, order.auction?.startingPrice || 0);
const sellerPayout = (order: DeliveryOrder) => Math.max(0, Number(order.auction?.currentPrice || 0) - getCommission(order));
const extractReceiptNo = (order: DeliveryOrder): string => {
  if (order.receiptId) return order.receiptId;
  const log = order.logs?.find(l => l.status === "COD_PAID_TO_SELLER" || l.status === "COMPLETED" || l.note?.includes("receiptNo="));
  if (!log || !log.note) return "-";
  const match = log.note.match(/receiptNo=([^;]+)/);
  return match && match[1] ? match[1] : "-";
};

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
    const list = q ? orders.filter(o => o._id.toLowerCase().includes(q) || (o.trackingCode || "").toLowerCase().includes(q)) : orders;
    return {
      active: list.filter(o => !isFinal(o.status) && o.status !== "DELIVERY_FAILED"),
      failed: list.filter(o => o.status === "DELIVERY_FAILED"),
      done: list.filter(o => isFinal(o.status))
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

  const onAssignAgent = (orderId: string) => runOrderAction(orderId, async () => {
    const agentUserId = assignAgentByOrder[orderId];
    if (!agentUserId) throw new Error("اختر مندوباً أولاً");
    await api.post(`/courier/orders/${orderId}/assign-agent`, { agentUserId });
  });

  const onPickedUp = (orderId: string) => runOrderAction(orderId, async () => {
    await api.post(`/courier/orders/${orderId}/picked-up`);
  });

  const onCreateAgent = async () => {
    if (!newAgentName || !newAgentPhone || !newAgentEmail || !newAgentPassword) {
      setError("الاسم والهاتف والإيميل وكلمة المرور مطلوبة");
      return;
    }
    setError(null);
    try {
      await api.post("/courier/staff/agents", {
        name: newAgentName,
        phone: newAgentPhone,
        email: newAgentEmail,
        password: newAgentPassword,
        governorate: newAgentGovernorate,
        address: newAgentAddress
      });
      setNewAgentName(""); setNewAgentPhone(""); setNewAgentEmail(""); setNewAgentPassword("");
      setNewAgentGovernorate(""); setNewAgentAddress("");
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

  const onCodPaid = (orderId: string) => runOrderAction(orderId, async () => {
    const otp = (otpByOrder[orderId] || "").trim();
    if (!otp) throw new Error("أدخل OTP البائع");
    await api.post(`/courier/orders/${orderId}/cod-paid`, { otp, receiptNo: receiptByOrder[orderId] || "" });
    setOtpByOrder(p => ({ ...p, [orderId]: "" }));
    setReceiptByOrder(p => ({ ...p, [orderId]: "" }));
  });

  const onFailed = (orderId: string) => runOrderAction(orderId, async () => {
    const reason = (reasonByOrder[orderId] || "").trim();
    if (!reason) throw new Error("اختر سبب الفشل");
    await api.post(`/courier/orders/${orderId}/failed`, { reason, note: noteByOrder[orderId] || "" });
  });

  const onRevertFailed = (orderId: string) => runOrderAction(orderId, async () => {
    await api.post(`/courier/orders/${orderId}/failed/revert`, { note: noteByOrder[orderId] || "" });
  });

  if (authLoading) return <div className="p-10 text-center text-white bg-slate-950 min-h-screen">جاري التحميل...</div>;
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
    const deadlineMs = o.auction?.confirmationDeadline ? new Date(o.auction.confirmationDeadline).getTime() : 0;
    const reviewOpen = o.status === "DELIVERY_FAILED" && deadlineMs > nowMs;
    const canRevert = reviewOpen;

    const statusClasses = isDone ? "status-completed" : isFailed ? "status-failed" : "status-active";
    const indicatorGlow = isDone ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : isFailed ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]" : "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]";

    return (
      <div key={o._id} className="glass-card overflow-hidden relative group p-5 flex flex-col gap-4 animate-slide-up">
        <div className={`absolute top-0 right-0 w-2 h-full ${indicatorGlow}`} />
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-lg tracking-tight">#{o._id.slice(-6).toUpperCase()}</span>
              <span className={`status-badge ${statusClasses}`}>{statusLabel[o.status] || o.status}</span>
            </div>
            <div className="text-xs text-slate-500 font-bold mt-1.5 flex items-center gap-2">
              <User className="w-3 h-3" /> المندوب: <span className="text-slate-300">{agentName(o.agentUser)}</span>
            </div>
          </div>
          <button onClick={() => setExpandedByOrder(p => ({ ...p, [o._id]: !expanded }))} className="glass-card p-2 text-slate-400 hover:text-white transition-colors">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {!expanded && (
          <div className="flex items-center justify-between mt-1 pt-3 border-t border-white/5">
            <div className="text-[11px] font-black text-indigo-400">{Number(o.auction?.currentPrice || 0).toLocaleString()} <span className="opacity-50">IQD</span></div>
            <div className="text-[10px] text-slate-500 font-mono">{o.trackingCode || "NO TRACKING"}</div>
          </div>
        )}

        {expanded && (
          <div className="mt-2 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-xs font-black text-slate-500 uppercase mb-2">بيانات التسليم (المشتري)</div>
                <div className="text-sm font-bold text-slate-200 mb-1">{o.auction?.winner?.name || "-"}</div>
                <div className="text-xs text-slate-400 font-mono mb-2">{o.auction?.winner?.phone || "-"}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{fullAddress(o.auction?.winner || null)}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-xs font-black text-slate-500 uppercase mb-2">بيانات الاستلام (البائع)</div>
                <div className="text-sm font-bold text-slate-200 mb-1">{o.auction?.seller?.name || "-"}</div>
                <div className="text-xs text-slate-400 font-mono mb-2">{o.auction?.seller?.phone || "-"}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{fullAddress(o.auction?.seller || null)}</div>
              </div>
            </div>

            <div className="bg-slate-900/40 rounded-2xl p-4 border border-white/5 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xs font-black text-slate-500 uppercase mb-1">الرقم المرجعي</div>
                <div className="text-sm font-mono font-bold text-indigo-400">{o.trackingCode || "N/A"}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-black text-slate-500 uppercase mb-1">سعر الرسو</div>
                <div className="text-sm font-bold text-white">{Number(o.auction?.currentPrice || 0).toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-black text-slate-500 uppercase mb-1">صافي الشركة</div>
                <div className="text-sm font-bold text-emerald-400">{Number(o.deliveryFee || 0).toLocaleString()}</div>
              </div>
            </div>

            {o.status === "DELIVERY_FAILED" && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-rose-400 font-black text-xs mb-1">
                  <AlertTriangle className="w-4 h-4" /> سبب الفشل: {failureReasonLabel[o.failureReason || ""] || o.failureReason || "-"}
                </div>
                <div className="text-[10px] text-rose-300/70">
                  {reviewOpen ? `تحذير: مهلة التراجع تنتهي خلال ${formatRemaining(deadlineMs - nowMs)}` : "مغلق نهائياً - تمت مراجعة الفشل."}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="text-xs font-black text-slate-500 uppercase">العمليات اللوجستية</div>
                  <select value={assignAgentByOrder[o._id] || ""} onChange={e => setAssignAgentByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]">
                    <option value="">تعيين مندوب...</option>
                    {agents.filter(a => a.isCourierActive !== false).map(a => <option key={a._id} value={a._id}>{a.name} ({a.phone})</option>)}
                  </select>
                  <button onClick={() => onAssignAgent(o._id)} disabled={!canAssign || isBusy || !assignAgentByOrder[o._id]} className="w-full premium-btn-primary text-sm py-3.5 min-h-[48px] disabled:opacity-30">تحديث المندوب المكلف</button>
                </div>
                <div className="space-y-3">
                  <div className="text-xs font-black text-slate-500 uppercase">التسوية المالية (COD)</div>
                  <div className="flex gap-2">
                    <input value={otpByOrder[o._id] || ""} onChange={e => setOtpByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-3 text-sm font-mono placeholder:text-slate-600 outline-none min-h-[44px]" placeholder="OTP البائع" />
                    <input value={receiptByOrder[o._id] || ""} onChange={e => setReceiptByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-3 text-sm font-mono placeholder:text-slate-600 outline-none min-h-[44px]" placeholder="رقم الوصل" />
                  </div>
                  <button onClick={() => onCodPaid(o._id)} disabled={!canCodPaid || isBusy} className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 rounded-xl py-3.5 min-h-[48px] text-emerald-400 font-black text-sm transition-all active:scale-95 disabled:opacity-20">تأكيد استلام الكاش والتسوية</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                <button onClick={() => onPickedUp(o._id)} disabled={!canPickUp || isBusy} className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl py-3.5 min-h-[44px] text-indigo-400 font-bold text-xs transition-all disabled:opacity-20 active:scale-95 flex items-center justify-center gap-2"><Truck className="w-4 h-4" /> تم استلام الطلب</button>
                <button onClick={() => onRevertFailed(o._id)} disabled={!canRevert || isBusy} className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl py-3.5 min-h-[44px] text-amber-400 font-bold text-xs transition-all disabled:opacity-20 active:scale-95 flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> تصحيح حالة الفشل</button>
                <button onClick={() => setShowFailForm(p => ({ ...p, [o._id]: !p[o._id] }))} className={`border rounded-xl py-3.5 min-h-[44px] font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 ${showFailForm[o._id] ? "bg-rose-500 border-rose-500 text-white" : "bg-rose-500/10 border-rose-500/20 text-rose-500"}`}><AlertCircle className="w-4 h-4" /> بلاغ فشل توصيل</button>
              </div>
              {showFailForm[o._id] && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 animate-in slide-in-from-top-2">
                  <div className="text-xs font-black text-rose-400 uppercase mb-3">تفاصيل البلاغ اللوجستي</div>
                  <div className="space-y-3">
                    <select value={reasonByOrder[o._id] || ""} onChange={e => setReasonByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none min-h-[44px]">
                      <option value="">اختر سبب التعثر...</option>
                      {failureReasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <input value={noteByOrder[o._id] || ""} onChange={e => setNoteByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none min-h-[44px]" placeholder="أضف ملاحظات توضيحية للفريق الفني..." />
                    <button onClick={() => onFailed(o._id)} disabled={!canFail || isBusy || !reasonByOrder[o._id]} className="w-full bg-rose-600 rounded-xl py-3.5 min-h-[48px] text-white font-black text-sm shadow-lg shadow-rose-600/20">إرسال البلاغ فوراً</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="courier-dashboard-container font-sans relative">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-from),_transparent_50%)] from-indigo-500/10 to-transparent pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-from),_transparent_50%)] from-emerald-500/5 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 relative z-10 animate-slide-up">
        <header className="glass-panel p-6 md:p-8 flex flex-wrap items-center justify-between gap-6 overflow-hidden relative">
          <div className="relative">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">مركز التحكم بالنقل</h1>
            <p className="text-slate-400 mt-2 font-medium max-w-md">إدارة المندوبين، مراقبة طلبات التوصيل، ومتابعة الدفعات النقدية والعمليات اللوجستية بدقة عالية.</p>
          </div>
          <div className="flex items-center gap-3 relative">
            <button onClick={loadOrders} className="glass-card px-5 py-2.5 font-bold flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95 border-white/5">
              <RefreshCcw className={`w-4 h-4 text-indigo-400 ${loadingOrders ? "animate-spin" : ""}`} /> تحديث البيانات
            </button>
            <button onClick={logout} className="rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-5 py-2.5 font-bold text-rose-400 flex items-center gap-2 transition-all active:scale-95">
              <LogOut className="w-4 h-4" /> تسجيل الخروج
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          <div className="glass-panel p-5 text-center stat-glow-indigo group hover:border-indigo-500/30 transition-all">
            <div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">المندوبون</div>
            <div className="text-4xl font-black text-white group-hover:scale-110 transition-transform">{agents.filter(a => a.isCourierActive !== false).length}</div>
            <div className="text-[10px] text-slate-500 mt-1">كادر فعال حالياً</div>
          </div>
          <div className="glass-panel p-5 text-center hover:border-blue-500/30 transition-all">
            <div className="text-[11px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">طلبات نشطة</div>
            <div className="text-4xl font-black text-white">{filteredOrders.active.length}</div>
            <div className="text-[10px] text-slate-500 mt-1">قيد المعالجة</div>
          </div>
          <div className="glass-panel p-5 text-center stat-glow-rose hover:border-rose-500/30 transition-all">
            <div className="text-[11px] font-black text-rose-400 uppercase tracking-[0.2em] mb-2">تعثر التوصيل</div>
            <div className="text-4xl font-black text-rose-500">{filteredOrders.failed.length}</div>
            <div className="text-[10px] text-slate-500 mt-1">تحت المراجعة</div>
          </div>
          <div className="glass-panel p-5 text-center stat-glow-emerald hover:border-emerald-500/30 transition-all">
            <div className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">المكتملة اليوم</div>
            <div className="text-4xl font-black text-emerald-500">{filteredOrders.done.length}</div>
            <div className="text-[10px] text-slate-500 mt-1">تمت بنجاح</div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 backdrop-blur-md p-4 text-sm font-bold text-rose-400 shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        <div className="flex bg-slate-900/50 backdrop-blur-xl p-1.5 rounded-[2rem] w-fit border border-white/5 mx-auto lg:mx-0 shadow-2xl">
          <button onClick={() => setActiveTab("orders")} className={`px-8 py-3.5 rounded-[1.5rem] font-black text-sm transition-all flex items-center gap-3 relative overflow-hidden group ${activeTab === "orders" ? "bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]" : "text-slate-500 hover:text-slate-300"}`}>
            <Truck className={`w-5 h-5 ${activeTab === "orders" ? "text-white" : "text-slate-600"}`} /> إدارة الطلبات والمندوبين
          </button>
          <button onClick={() => setActiveTab("finances")} className={`px-8 py-3.5 rounded-[1.5rem] font-black text-sm transition-all flex items-center gap-3 relative overflow-hidden group ${activeTab === "finances" ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]" : "text-slate-500 hover:text-slate-300"}`}>
            <ReceiptText className={`w-5 h-5 ${activeTab === "finances" ? "text-white" : "text-slate-600"}`} /> السجلات المالية للشركة
          </button>
        </div>

        {activeTab === "finances" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500 w-full">
            {filteredOrders.done.length === 0 ? (
              <div className="glass-panel p-16 text-center border-dashed border-2 border-white/5">
                <ReceiptText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-300">لا يوجد سجل مالي حالياً</h3>
                <p className="text-slate-500 mt-2">بمجرد اكتمال الطلبات، ستظهر العمليات المالية والعمولات هنا.</p>
              </div>
            ) : (
              <>
                <div className="glass-panel p-6 md:p-8 relative overflow-hidden">
                  <h3 className="font-black text-emerald-400 inline-flex items-center gap-3 text-xl mb-8 relative">
                    <Wallet className="w-6 h-6" /> تحليل التدفقات النقدية
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="glass-card p-5 border-l-4 border-l-slate-400">
                      <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">إجمالي الكاش المتداول</div>
                      <div className="text-2xl font-black text-white">{(filteredOrders.done.reduce((acc, o) => acc + Number(o.auction?.currentPrice || 0) + Number(o.deliveryFee || 0), 0)).toLocaleString()} <span className="text-xs text-slate-500 mr-1 italic">IQD</span></div>
                    </div>
                    <div className="glass-card p-5 border-l-4 border-l-emerald-500 stat-glow-emerald">
                      <div className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-2">أرباح الشركة الصافية</div>
                      <div className="text-2xl font-black text-emerald-400">{(filteredOrders.done.reduce((acc, o) => acc + Number(o.deliveryFee || 0), 0)).toLocaleString()} <span className="text-xs text-emerald-600/70 mr-1 italic">IQD</span></div>
                    </div>
                    <div className="glass-card p-5 border-l-4 border-l-indigo-500 stat-glow-indigo">
                      <div className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">مستحقات البائعين</div>
                      <div className="text-2xl font-black text-indigo-300">{(filteredOrders.done.reduce((acc, o) => acc + sellerPayout(o), 0)).toLocaleString()} <span className="text-xs text-indigo-400/50 mr-1 italic">IQD</span></div>
                    </div>
                    <div className="glass-card p-5 border-l-4 border-l-rose-500 stat-glow-rose">
                      <div className="text-xs font-black text-rose-500 uppercase tracking-widest mb-2">ديون المنصة</div>
                      <div className="text-2xl font-black text-rose-400">{(filteredOrders.done.reduce((acc, o) => acc + getCommission(o), 0)).toLocaleString()} <span className="text-xs text-rose-500/50 mr-1 italic">IQD</span></div>
                    </div>
                    <div className="glass-card p-5 border-l-4 border-l-slate-200 bg-white/5">
                      <div className="text-xs font-black text-slate-300 uppercase tracking-widest mb-2">قيمة المبيعات</div>
                      <div className="text-2xl font-black text-white">{(filteredOrders.done.reduce((acc, o) => acc + Number(o.auction?.currentPrice || 0), 0)).toLocaleString()} <span className="text-xs text-slate-500 mr-1 italic">IQD</span></div>
                    </div>
                  </div>
                </div>
                <div className="glass-panel overflow-hidden border-white/5">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h4 className="font-black text-white flex items-center gap-3"><ReceiptText className="text-indigo-400" /> سجل التسويات التفصيلي</h4>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">اليوم: {new Date().toLocaleDateString("ar-EG")}</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead>
                        <tr className="bg-white/2 text-slate-400 text-xs font-black uppercase tracking-widest">
                          <th className="px-6 py-4">الوصل</th>
                          <th className="px-6 py-4">الطلب</th>
                          <th className="px-6 py-4">المندوب</th>
                          <th className="px-6 py-4 text-emerald-400">COD المستلم</th>
                          <th className="px-6 py-4 text-indigo-400">أرباحك</th>
                          <th className="px-6 py-4 text-rose-400">العمولة</th>
                          <th className="px-6 py-4 text-violet-400">صافي البائع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredOrders.done.map(o => {
                          const gross = Number(o.auction?.currentPrice || 0);
                          const fee = Number(o.deliveryFee || 0);
                          const comm = getCommission(o);
                          const pay = sellerPayout(o);
                          return (
                            <tr key={o._id} className="hover:bg-white/[0.02] transition-colors group">
                              <td className="px-6 py-4"><span className="font-mono text-xs font-black bg-slate-800 text-indigo-300 px-3 py-1 rounded-full border border-white/5">{extractReceiptNo(o)}</span></td>
                              <td className="px-6 py-4 font-mono text-[11px] text-slate-500 font-bold group-hover:text-slate-300">#{o._id.slice(-6).toUpperCase()}</td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-300">{typeof o.agentUser === 'object' ? o.agentUser?.name : 'غير معروف'}</td>
                              <td className="px-6 py-4 text-emerald-400 font-black">{(gross + fee).toLocaleString()}</td>
                              <td className="px-6 py-4 text-indigo-300 font-bold">{fee.toLocaleString()}</td>
                              <td className="px-6 py-4 text-rose-400/80 font-bold">{comm.toLocaleString()}</td>
                              <td className="px-6 py-4 text-violet-300 font-black">{pay.toLocaleString()}</td>
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
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-500 w-full pb-10">
            <div className="glass-panel p-6 md:p-8 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl"><UserCog className="w-7 h-7 text-indigo-400" /></div>
                  <div>
                    <h3 className="text-xl font-black text-white">إدارة مناديب التوصيل</h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">مراقبة كفاءة المندوبين وتعيين المهام اللوجستية.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={loadAgents} disabled={loadingAgents} className="glass-card px-5 py-2.5 font-bold text-xs flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95">
                    <RefreshCcw className={`w-3.5 h-3.5 ${loadingAgents ? "animate-spin" : ""}`} /> تحديث الحالة
                  </button>
                  <button onClick={() => setShowAgentModal(true)} className="premium-btn-primary flex items-center gap-2 text-xs">
                    <Plus className="w-4 h-4" /> إضافة مندوب جديد
                  </button>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {agents.length === 0 ? <p className="col-span-full py-12 text-center text-slate-500 font-bold">لا يوجد مناديب مسجلون حالياً.</p> : agents.map(a => (
                  <div key={a._id} className="glass-card p-4 group hover:ring-2 hover:ring-indigo-500/30">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-black text-indigo-400 relative">
                        {a.name.slice(0, 1)}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${a.isCourierActive !== false ? "bg-emerald-500" : "bg-rose-500"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-slate-200 truncate">{a.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono tracking-tight">{a.phone}</div>
                      </div>
                      <button onClick={() => onToggleAgent(a._id)} className={`rounded-lg p-2 transition-all ${a.isCourierActive !== false ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"}`}>
                        {a.isCourierActive !== false ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-panel p-2 flex items-center relative group">
                <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent border-0 py-4 pr-14 pl-6 text-white font-bold placeholder:text-slate-600 outline-none" placeholder="ابحث برقم الطلب (Order ID) أو التتبع (Tracking Number)..." />
              </div>
              <div className="glass-panel p-2 flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`w-5 h-5 ${showFailedArchive ? 'text-rose-400' : 'text-slate-500'}`} />
                  <div className="text-sm font-black text-slate-200">الطلبات الفاشلة</div>
                </div>
                <button onClick={() => setShowFailedArchive(v => !v)} className={`rounded-xl px-5 py-2.5 min-h-[44px] text-xs font-black transition-all ${showFailedArchive ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-400"}`}>
                  {showFailedArchive ? "إخفاء" : `عرض (${filteredOrders.failed.length})`}
                </button>
              </div>
            </div>

            <section className="space-y-4 pt-4">
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-panel p-4 rounded-2xl border-indigo-500/30 border overflow-hidden">
                <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500 rounded-l" />
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                  <span className="relative flex h-3 w-3"><span className="animate-ping absolute h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative rounded-full h-3 w-3 bg-indigo-500"></span></span>
                  الطلبات الجارية
                </h2>
                <span className="rounded-xl bg-indigo-500/20 border border-indigo-500/40 px-4 py-2 min-h-[44px] inline-flex items-center justify-center text-sm font-bold text-indigo-300 gap-2"><Truck className="w-4 h-4" /> {filteredOrders.active.length} طلبات</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {filteredOrders.active.length === 0 ? <div className="col-span-full glass-panel border-2 border-dashed border-white/10 rounded-3xl p-10 text-center text-slate-400 font-medium text-sm">لا توجد طلبات جارية حالياً.</div> : filteredOrders.active.map(renderOrderCard)}
              </div>
            </section>

            {showFailedArchive && (
              <section className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-lg font-black text-rose-400 flex items-center gap-2 border-t border-white/10 pt-6">
                  <div className="w-2 h-2 rounded-full bg-rose-500" /> الطلبات الفاشلة (للمراجعة)
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {filteredOrders.failed.length === 0 ? <div className="col-span-full glass-panel border-2 border-dashed border-white/10 rounded-3xl p-10 text-center text-slate-500 font-medium text-sm">لا توجد طلبات فاشلة.</div> : filteredOrders.failed.map(renderOrderCard)}
                </div>
              </section>
            )}

            <section className="glass-panel rounded-2xl p-4 flex items-center justify-between border-white/5">
              <div className="text-sm font-black text-slate-200 flex items-center gap-2"><CheckCircle2 className="text-emerald-500 w-4 h-4" /> أرشيف الطلبات المكتملة</div>
              <button onClick={() => setShowDoneArchive(v => !v)} className={`rounded-xl px-4 py-2.5 min-h-[44px] text-xs font-bold transition-all ${showDoneArchive ? "bg-slate-700 text-slate-200 border border-white/10" : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"}`}>
                {showDoneArchive ? "إخفاء" : `عرض (${filteredOrders.done.length})`}
              </button>
            </section>

            {showDoneArchive && (
              <section className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 opacity-90">
                  {filteredOrders.done.length === 0 ? <div className="col-span-full glass-panel border-2 border-dashed border-white/10 rounded-3xl p-10 text-center text-slate-500 font-medium text-sm">لا توجد طلبات مكتملة اليوم.</div> : filteredOrders.done.map(renderOrderCard)}
                </div>
              </section>
            )}
          </div>
        )}

        {showAgentModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md glass-panel rounded-3xl border border-white/10 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white">إضافة مندوب جديد</h3>
                <button onClick={() => setShowAgentModal(false)} className="rounded-xl glass-card p-2.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus:ring-2 focus:ring-indigo-500"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} className="w-full rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50" placeholder="اسم المندوب" />
                <input value={newAgentPhone} onChange={e => setNewAgentPhone(e.target.value)} className="w-full rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50" placeholder="رقم الهاتف" />
                <input value={newAgentEmail} onChange={e => setNewAgentEmail(e.target.value)} className="w-full rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50" placeholder="البريد الإلكتروني" type="email" />
                <input value={newAgentPassword} onChange={e => setNewAgentPassword(e.target.value)} className="w-full rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50" placeholder="كلمة المرور" type="password" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={newAgentGovernorate} onChange={e => setNewAgentGovernorate(e.target.value)} className="w-full rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">المحافظة...</option>
                    {GOVERNORATES.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                  </select>
                  <input value={newAgentAddress} onChange={e => setNewAgentAddress(e.target.value)} className="w-full rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50" placeholder="العنوان" />
                </div>
                <button onClick={onCreateAgent} disabled={!newAgentName || !newAgentPhone || !newAgentEmail || !newAgentPassword} className="w-full rounded-xl premium-btn-primary py-3.5 min-h-[48px] text-sm font-black text-white shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 mt-4">إنشاء المندوب</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
