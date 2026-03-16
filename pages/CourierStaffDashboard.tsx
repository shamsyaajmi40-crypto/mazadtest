import { useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  LogOut,
  RefreshCcw,
  RotateCcw,
  Truck,
  User,
  UserCog,
  Search,
  Wallet,
  ReceiptText,
  Plus,
  X,
  Building,
  MapPin,
  Calendar,
  Phone,
  MessageCircle,
} from "lucide-react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { calculateCommission } from "../utils/commission";
import "./CourierStaffDashboard.css"; // We will simplify this CSS next

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
  destination?: {
    governorate?: string;
    address?: string;
    location?: { lat: number; lng: number } | null;
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
  READY_FOR_PICKUP: "بانتظار الاستلام",
  PICKED_UP: "تم الاستلام من البائع",
  OUT_FOR_DELIVERY: "قيد التوصيل",
  DELIVERED: "تم التسليم (بانتظار التسوية)",
  DELIVERY_FAILED: "فشل التوصيل",
  COD_PAID_TO_SELLER: "تم دفع COD",
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

  const [activeTab, setActiveTab] = useState<"orders" | "agents" | "finances">("orders");
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
  
  // View states for Orders Tab
  const [orderView, setOrderView] = useState<"active" | "failed" | "done">("active");
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

  if (authLoading) return <div className="p-10 text-center text-slate-500 min-h-screen bg-slate-50">جاري التحميل...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "courier_staff") return <Navigate to="/" replace />;

  const renderContextualOrderCard = (o: DeliveryOrder) => {
    const expanded = !!expandedByOrder[o._id];
    const isBusy = busyOrderId === o._id;
    const isDone = isFinal(o.status);
    const isFailed = o.status === "DELIVERY_FAILED";
    const deadlineMs = o.auction?.confirmationDeadline ? new Date(o.auction.confirmationDeadline).getTime() : 0;
    const reviewOpen = isFailed && deadlineMs > nowMs;
    const canRevert = reviewOpen;

    // Determine Context
    const isAssignmentPhase = ["READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(o.status);
    const isSettlementPhase = o.status === "DELIVERED";

    return (
      <div key={o._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        {/* Status Bar */}
        <div className={`h-1.5 w-full ${isDone ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-blue-600'}`} />
        
        <div className="p-4 sm:p-5">
           {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-slate-800">#{o._id.slice(-6).toUpperCase()}</span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${isDone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : isFailed ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                  {statusLabel[o.status] || o.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-4">
                <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {o.trackingCode || "N/A"}</div>
                <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> <span className="font-medium text-slate-700">{agentName(o.agentUser)}</span></div>
              </div>
            </div>
            <button 
              onClick={() => setExpandedByOrder(p => ({ ...p, [o._id]: !expanded }))} 
              className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors w-fit"
            >
              {expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'} {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {!expanded && isAssignmentPhase && (
             <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <div className="font-bold text-slate-700">قيمة التحصيل: {(Number(o.auction?.currentPrice || 0) + Number(o.deliveryFee || 0)).toLocaleString()} د.ع</div>
             </div>
          )}

          {expanded && (
            <div className="pt-4 border-t border-slate-100 space-y-5 animate-in fade-in duration-200">
               {/* Clean Data Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">بيانات التسليم (المشتري)</div>
                    <div className="font-bold text-slate-800 mb-1">{o.auction?.winner?.name || "-"}</div>
                    <div className="text-sm font-mono text-slate-600 mb-2 flex items-center justify-between">
                      <span dir="ltr">{o.auction?.winner?.phone || "-"}</span>
                      {o.auction?.winner?.phone && (
                        <div className="flex gap-2">
                           <a 
                             href={`tel:${o.auction.winner.phone}`} 
                             className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                             title="اتصال هاتفي"
                           >
                             <Phone className="w-3.5 h-3.5" />
                           </a>
                           <a 
                             href={`https://wa.me/${o.auction.winner.phone.replace(/\D/g, '')}`} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200"
                             title="مراسلة واتساب"
                           >
                             <MessageCircle className="w-3.5 h-3.5" />
                           </a>
                        </div>
                       )}
                    </div>
                    <div className="text-sm text-slate-600 flex flex-col gap-2">
                      <div className="flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
                        {fullAddress(o.destination || o.auction?.winner || null)}
                      </div>
                      {o.destination?.location && (
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${o.destination.location.lat},${o.destination.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 w-fit px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors mt-1 border border-blue-200"
                        >
                          <MapPin className="w-3 h-3" /> الملاحة عبر خرائط جوجل
                        </a>
                      )}
                    </div>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">بيانات الاستلام (البائع)</div>
                    <div className="font-bold text-slate-800 mb-1">{o.auction?.seller?.name || "-"}</div>
                    <div className="text-sm font-mono text-slate-600 mb-2 flex items-center justify-between">
                      <span dir="ltr">{o.auction?.seller?.phone || "-"}</span>
                      {o.auction?.seller?.phone && (
                        <div className="flex gap-2">
                           <a 
                             href={`tel:${o.auction.seller.phone}`} 
                             className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                             title="اتصال هاتفي"
                           >
                             <Phone className="w-3.5 h-3.5" />
                           </a>
                           <a 
                             href={`https://wa.me/${o.auction.seller.phone.replace(/\D/g, '')}`} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200"
                             title="مراسلة واتساب"
                           >
                             <MessageCircle className="w-3.5 h-3.5" />
                           </a>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">{fullAddress(o.auction?.seller || null)}</div>
                 </div>
               </div>

               {/* Financial Summary */}
               <div className="flex flex-wrap gap-4 p-4 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-lg">
                  <div>
                    <div className="text-xs font-bold text-emerald-700/70 uppercase">تحصيل من المشتري</div>
                    <div className="text-lg font-black">{(Number(o.auction?.currentPrice || 0) + Number(o.deliveryFee || 0)).toLocaleString()} د.ع</div>
                  </div>
                  <div className="border-l border-emerald-200 mx-2" />
                  <div>
                    <div className="text-xs font-bold text-emerald-700/70 uppercase">تسليم للبائع (صافي)</div>
                    <div className="text-lg font-black">{sellerPayout(o).toLocaleString()} د.ع</div>
                  </div>
               </div>

               {/* Failure Banner */}
               {isFailed && (
                 <div className="bg-rose-50 p-4 border border-rose-200 rounded-lg flex items-start gap-3">
                   <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                   <div>
                     <div className="font-bold text-rose-800">تقرير فشل التوصيل</div>
                     <div className="text-sm text-rose-700 mt-1">السبب: {failureReasonLabel[o.failureReason || ""] || o.failureReason || "-"}</div>
                     <div className="text-xs text-rose-600 mt-2 font-medium">
                       {reviewOpen ? `تحذير: مهلة التراجع تنتهي خلال ${formatRemaining(deadlineMs - nowMs)}` : "تم إغلاق الطلب ولم يعد قابلاً للتراجع."}
                     </div>
                   </div>
                 </div>
               )}

               {/* Contextual Action Area */}
               <div className="pt-2">
                 {isAssignmentPhase && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase">تعيين مندوب</label>
                       <div className="flex gap-2">
                          <select 
                            value={assignAgentByOrder[o._id] || ""} 
                            onChange={e => setAssignAgentByOrder(p => ({ ...p, [o._id]: e.target.value }))}
                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">اختر المندوب...</option>
                            {agents.filter(a => a.isCourierActive !== false).map(a => <option key={a._id} value={a._id}>{a.name} ({a.phone})</option>)}
                          </select>
                          <button onClick={() => onAssignAgent(o._id)} disabled={isBusy || !assignAgentByOrder[o._id]} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 disabled:opacity-50">تحديث</button>
                       </div>
                     </div>
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase">إجراءات لوجستية</label>
                       <div className="flex gap-2">
                         <button onClick={() => onPickedUp(o._id)} disabled={isBusy || o.status !== "READY_FOR_PICKUP"} className="flex-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200 px-3 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">تأكيد الاستلام من البائع</button>
                         <button onClick={() => setShowFailForm(p => ({ ...p, [o._id]: !p[o._id] }))} disabled={isBusy} className="bg-white text-rose-600 border border-slate-300 hover:bg-rose-50 px-3 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50">بلاغ فشل</button>
                       </div>
                     </div>
                   </div>
                 )}

                 {isSettlementPhase && (
                   <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg space-y-4">
                     <div className="flex items-center gap-2 text-amber-800 font-bold"><Wallet className="w-5 h-5" /> التسوية المالية وإغلاق الطلب</div>
                     <div className="flex flex-col sm:flex-row gap-3">
                       <input value={otpByOrder[o._id] || ""} onChange={e => setOtpByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="flex-1 border border-amber-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-500" placeholder="رمز OTP المعتمد من البائع" />
                       <input value={receiptByOrder[o._id] || ""} onChange={e => setReceiptByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="flex-1 border border-amber-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber-500" placeholder="رقم الوصل المالي" />
                       <button onClick={() => onCodPaid(o._id)} disabled={isBusy} className="bg-amber-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap">تأكيد التسوية</button>
                     </div>
                   </div>
                 )}

                 {isFailed && canRevert && (
                   <div className="mt-4 border-t border-slate-100 pt-4 text-left">
                     <button onClick={() => onRevertFailed(o._id)} disabled={isBusy} className="bg-white border text-amber-600 border-amber-200 hover:bg-amber-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-2">
                       <RotateCcw className="w-4 h-4" /> التراجع عن حالة الفشل
                     </button>
                   </div>
                 )}

                 {/* Inline Failure Form */}
                 {showFailForm[o._id] && isAssignmentPhase && (
                   <div className="mt-4 p-4 border border-rose-200 bg-white rounded-lg shadow-sm">
                      <div className="text-sm font-bold text-rose-800 mb-3">تسجيل بلاغ فشل توصيل</div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select value={reasonByOrder[o._id] || ""} onChange={e => setReasonByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none">
                          <option value="">اختر السبب الحقيقي للتعثر...</option>
                          {failureReasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <input value={noteByOrder[o._id] || ""} onChange={e => setNoteByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="ملاحظات تفصيلية..." />
                        <button onClick={() => onFailed(o._id)} disabled={isBusy || !reasonByOrder[o._id]} className="bg-rose-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-rose-700 disabled:opacity-50">تأكيد البلاغ</button>
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Enterprise Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Building className="w-6 h-6" /></div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">إدارة اللوجستيات والتوصيل</h1>
                <div className="text-xs text-slate-500 font-medium tracking-wide">بيئة العمل الموحدة لموظفي الشركة</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { loadOrders(); loadAgents(); }} className="h-10 px-4 border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 font-bold text-sm flex items-center gap-2 transition-colors">
                <RefreshCcw className={`w-4 h-4 ${loadingOrders || loadingAgents ? 'animate-spin' : ''}`} /> التحديث الان
              </button>
              <button onClick={logout} className="h-10 px-4 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-bold text-sm transition-colors border border-transparent">
                تسجيل الخروج
              </button>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-6 mt-2 overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => setActiveTab('orders')} 
              className={`pb-3 text-sm font-bold transition-colors whitespace-nowrap border-b-2 ${activeTab === 'orders' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              الطلبات الجارية ({filteredOrders.active.length + filteredOrders.failed.length})
            </button>
            <button 
              onClick={() => setActiveTab('agents')} 
              className={`pb-3 text-sm font-bold transition-colors whitespace-nowrap border-b-2 ${activeTab === 'agents' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              الفريق والمندوبين ({agents.length})
            </button>
            <button 
              onClick={() => setActiveTab('finances')} 
              className={`pb-3 text-sm font-bold transition-colors whitespace-nowrap border-b-2 ${activeTab === 'finances' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              السجلات المالية
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg flex items-center gap-3 text-rose-800 font-bold shadow-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {/* TAB 1: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               {/* View Toggles */}
               <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm w-fit">
                 <button onClick={() => setOrderView('active')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${orderView === 'active' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>جديدة وتوصيل ({filteredOrders.active.length})</button>
                 <button onClick={() => setOrderView('failed')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-1.5 ${orderView === 'failed' ? 'bg-rose-50 text-rose-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                   فاشلة {filteredOrders.failed.length > 0 && <span className="w-2 h-2 rounded-full bg-rose-500" />} ({filteredOrders.failed.length})
                 </button>
               </div>
               
               {/* Search */}
               <div className="relative max-w-sm w-full">
                 <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                   value={search} 
                   onChange={e => setSearch(e.target.value)} 
                   className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pr-10 pl-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm" 
                   placeholder="بحث بالرقم أو التتبع..." 
                 />
               </div>
            </div>

            <div className="space-y-4">
              {orderView === 'active' && (
                filteredOrders.active.length === 0 ? (
                  <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium">لا توجد طلبات جارية أو قيد التوصيل في الوقت الحالي.</div>
                ) : filteredOrders.active.map(renderContextualOrderCard)
              )}
              {orderView === 'failed' && (
                filteredOrders.failed.length === 0 ? (
                  <div className="text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium">لا توجد طلبات فاشلة بانتظار المراجعة. صندوقك نظيف!</div>
                ) : filteredOrders.failed.map(renderContextualOrderCard)
              )}
            </div>
          </div>
        )}

        {/* TAB 2: AGENTS */}
        {activeTab === 'agents' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-800">إدارة كادر التوصيل</h2>
                <div className="text-sm text-slate-500 mt-1">المندوبون النشطون: {agents.filter(a => a.isCourierActive !== false).length} من إجمالي {agents.length}</div>
              </div>
              <button onClick={() => setShowAgentModal(true)} className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
                <Plus className="w-4 h-4" /> إضافة مندوب جديد
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(a => (
                <div key={a._id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-600 text-lg relative shrink-0">
                    {a.name.slice(0, 1)}
                    <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${a.isCourierActive !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{a.name}</div>
                    <div className="text-sm text-slate-500 font-mono mt-0.5">{a.phone}</div>
                    <button 
                      onClick={() => onToggleAgent(a._id)} 
                      className={`mt-3 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                        a.isCourierActive !== false 
                        ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' 
                        : 'border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      {a.isCourierActive !== false ? '✅ حساب فعال' : '❌ حساب معطل'}
                    </button>
                  </div>
                </div>
              ))}
              {agents.length === 0 && (
                <div className="col-span-full text-center py-16 bg-white border border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium">لا يوجد مندوبين مسجلين. ابدأ بإضافة فريقك.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: FINANCES */}
        {activeTab === 'finances' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Value Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">صافي أرباح الشركة</div>
                <div className="text-2xl font-black text-emerald-600">
                  {filteredOrders.done.reduce((acc, o) => acc + Number(o.deliveryFee || 0), 0).toLocaleString()} <span className="text-sm text-emerald-600/50">IQD</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">الديون المستحقة للبائعين</div>
                <div className="text-2xl font-black text-indigo-600">
                  {filteredOrders.done.reduce((acc, o) => acc + sellerPayout(o), 0).toLocaleString()} <span className="text-sm text-indigo-600/50">IQD</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm border-l-4 border-l-slate-800">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">النقد الإجمالي المحصل (COD)</div>
                <div className="text-2xl font-black text-slate-800">
                  {filteredOrders.done.reduce((acc, o) => acc + Number(o.auction?.currentPrice || 0) + Number(o.deliveryFee || 0), 0).toLocaleString()} <span className="text-sm text-slate-400">IQD</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">الطلبات المنجزة مالياً</div>
                <div className="text-2xl font-black text-slate-700">{filteredOrders.done.length} <span className="text-sm text-slate-400">عملية</span></div>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                 <h3 className="font-black text-slate-800 flex items-center gap-2"><ReceiptText className="w-5 h-5 text-slate-400" /> دفتر الأستاذ (العمليات المنجزة)</h3>
                 <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><Calendar className="w-4 h-4" /> اليوم: {new Date().toLocaleDateString('ar-EG')}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-white border-b border-slate-100">
                    <tr className="text-slate-500 font-bold">
                      <th className="px-6 py-4 whitespace-nowrap">رقم الوصل المالي</th>
                      <th className="px-6 py-4 whitespace-nowrap">رقم الطلب / المندوب</th>
                      <th className="px-6 py-4 whitespace-nowrap">إجمالي COD المستلم</th>
                      <th className="px-6 py-4 whitespace-nowrap text-emerald-600">ربح توصيل الشركة</th>
                      <th className="px-6 py-4 whitespace-nowrap text-rose-600">عمولة مزاد</th>
                      <th className="px-6 py-4 whitespace-nowrap text-indigo-600">مدفوعات البائع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {filteredOrders.done.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">لا توجد سجلات مالية منجزة.</td></tr>
                    ) : filteredOrders.done.map(o => {
                      const gross = Number(o.auction?.currentPrice || 0);
                      const fee = Number(o.deliveryFee || 0);
                      const comm = getCommission(o);
                      const pay = sellerPayout(o);
                      return (
                        <tr key={o._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-mono bg-slate-100 text-slate-800 px-2.5 py-1 rounded text-xs font-bold border border-slate-200">{extractReceiptNo(o)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-mono text-xs font-bold">#{o._id.slice(-6).toUpperCase()}</div>
                            <div className="text-xs text-slate-500 mt-1">{typeof o.agentUser === 'object' ? o.agentUser?.name : '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-bold">{(gross + fee).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-emerald-600 font-bold">{fee.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-rose-600 font-bold">{comm.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-indigo-600 font-bold bg-indigo-50/30">{pay.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Add Agent Modal */}
        {showAgentModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-black text-slate-800">إضافة مندوب جديد</h3>
                <button onClick={() => setShowAgentModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">الاسم الكامل</label>
                  <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">رقم الهاتف</label>
                    <input value={newAgentPhone} onChange={e => setNewAgentPhone(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" dir="ltr" placeholder="07xxxxxxx" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">البريد الإلكتروني (لتسجيل الدخول)</label>
                    <input value={newAgentEmail} onChange={e => setNewAgentEmail(e.target.value)} type="email" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">كلمة المرور الأولية</label>
                  <input value={newAgentPassword} onChange={e => setNewAgentPassword(e.target.value)} type="password" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" dir="ltr" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">المحافظة</label>
                    <select value={newAgentGovernorate} onChange={e => setNewAgentGovernorate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                      <option value="">اختر...</option>
                      {GOVERNORATES.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">العنوان التفصيلي</label>
                    <input value={newAgentAddress} onChange={e => setNewAgentAddress(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 mt-2">
                  <button onClick={onCreateAgent} disabled={!newAgentName || !newAgentPhone || !newAgentEmail || !newAgentPassword} className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">تسجيل وتفعيل المندوب</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
