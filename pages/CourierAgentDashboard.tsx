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
  Siren,
  User,
  Search,
  Wallet,
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

const getCommission = (order: DeliveryOrder) => calculateCommission(order.auction?.currentPrice || 0, order.auction?.startingPrice || 0);
const sellerPayout = (order: DeliveryOrder) => Math.max(0, Number(order.auction?.currentPrice || 0) - getCommission(order));

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
  const [search, setSearch] = useState("");

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
    return {
      active: list.filter(o => !isFinal(o.status) && o.status !== "DELIVERY_FAILED"),
      failed: list.filter(o => o.status === "DELIVERY_FAILED"),
      done: list.filter(o => isFinal(o.status))
    };
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

  if (authLoading) return <div className="p-10 text-center text-white bg-slate-950 min-h-screen">جاري التحميل...</div>;
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
            <div className="text-[11px] text-slate-500 font-bold mt-1.5 flex items-center gap-2">
              <Truck className="w-3 h-3" /> {o.trackingCode || "N/A"}
            </div>
          </div>
          <button onClick={() => setExpandedByOrder(p => ({ ...p, [o._id]: !expanded }))} className="glass-card p-2 text-slate-400 hover:text-white transition-colors">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {!expanded && (
          <div className="flex items-center justify-between mt-1 pt-3 border-t border-white/5">
            <div className="text-[11px] font-black text-indigo-400">{totalDueWithDelivery(o).toLocaleString()} <span className="opacity-50">IQD</span></div>
            <div className="text-[10px] text-slate-500 font-bold">بانتظار الإجراء...</div>
          </div>
        )}

        {expanded && (
          <div className="mt-2 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[9px] font-black text-slate-500 uppercase mb-2">المشتري (تسليم)</div>
                <div className="text-xs font-bold text-slate-200 mb-1">{o.auction?.winner?.name || "-"}</div>
                <div className="text-[10px] text-slate-400 font-mono mb-2">{o.auction?.winner?.phone || "-"}</div>
                <div className="text-[10px] text-slate-500 leading-relaxed">{fullAddress(o.auction?.winner || null)}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[9px] font-black text-slate-500 uppercase mb-2">البائع (استلام)</div>
                <div className="text-xs font-bold text-slate-200 mb-1">{o.auction?.seller?.name || "-"}</div>
                <div className="text-[10px] text-slate-400 font-mono mb-2">{o.auction?.seller?.phone || "-"}</div>
                <div className="text-[10px] text-slate-500 leading-relaxed">{fullAddress(o.auction?.seller || null)}</div>
              </div>
            </div>

            <div className="bg-slate-900/40 rounded-2xl p-4 border border-white/5 grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-[9px] font-black text-slate-500 uppercase mb-1">الاستحصال (COD)</div>
                <div className="text-sm font-black text-emerald-400">{totalDueWithDelivery(o).toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] font-black text-slate-500 uppercase mb-1">صافي المشتري</div>
                <div className="text-sm font-black text-violet-400">{sellerPayout(o).toLocaleString()}</div>
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
              <button
                onClick={() => onPickedUp(o._id)}
                disabled={!canPickUp || isBusy}
                className="w-full premium-btn-primary flex items-center justify-center gap-2 py-4 disabled:opacity-30"
              >
                <Truck className="w-5 h-5 text-emerald-400" /> تم استلام الطلب من البائع
              </button>

              <div className="glass-card p-3 flex flex-col gap-3">
                <input
                  value={otpByOrder[o._id] || ""}
                  onChange={(e) => setOtpByOrder(p => ({ ...p, [o._id]: e.target.value }))}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-black text-white tracking-widest outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="رمز OTP المشتري"
                  inputMode="numeric"
                />
                <button
                  onClick={() => onDelivered(o._id)}
                  disabled={!canDeliver || isBusy}
                  className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 rounded-xl py-3.5 text-emerald-400 font-black text-sm transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" /> تأكيد التسليم للمشتري
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setShowFailForm(p => ({ ...p, [o._id]: !p[o._id] }))}
                  disabled={!canFail || isBusy}
                  className={`border rounded-xl py-3 font-bold text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2 ${showFailForm[o._id] ? "bg-rose-500 border-rose-500 text-white" : "bg-rose-500/10 border-rose-500/20 text-rose-500"}`}
                >
                  <AlertCircle className="w-4 h-4" /> بلاغ فشل
                </button>
                <button
                  onClick={() => onRevertFailed(o._id)}
                  disabled={!canRevert || isBusy}
                  className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl py-3 text-amber-400 font-bold text-[10px] transition-all disabled:opacity-20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> تراجع عن الفشل
                </button>
              </div>

              {showFailForm[o._id] && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 animate-in slide-in-from-top-2">
                  <div className="text-[10px] font-black text-rose-400 uppercase mb-3 text-right">تفاصيل بلاغ الفشل</div>
                  <div className="space-y-3">
                    <select value={reasonByOrder[o._id] || ""} onChange={e => setReasonByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none">
                      <option value="">اختر سبب المشكلة...</option>
                      {reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <input value={noteByOrder[o._id] || ""} onChange={e => setNoteByOrder(p => ({ ...p, [o._id]: e.target.value }))} className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none" placeholder="ملاحظات إضافية..." />
                    <button onClick={() => onFailed(o._id)} disabled={!canFail || isBusy || !reasonByOrder[o._id]} className="w-full bg-rose-600 rounded-xl py-3 text-white font-black text-xs shadow-lg shadow-rose-600/20">تأكيد الإغلاق كفشل</button>
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
    <div className="courier-dashboard-container font-sans relative pb-20">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-from),_transparent_50%)] from-indigo-500/10 to-transparent pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-from),_transparent_50%)] from-emerald-500/5 to-transparent pointer-events-none" />

      <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 relative z-10 animate-slide-up">
        {/* Mobile-Optimized Header */}
        <header className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 overflow-hidden relative">
          <div className="relative">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">لوحة المندوب الميداني</h1>
            <p className="text-slate-400 mt-1 text-sm font-medium">إدارة عمليات الاستلام والتسليم اللوجستية.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadOrders} className="glass-card px-4 py-2 font-bold flex items-center gap-2 hover:bg-white/10 transition-all border-white/5 text-xs">
              <RefreshCcw className={`w-3.5 h-3.5 text-indigo-400 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
            <button onClick={logout} className="rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-4 py-2 font-bold text-rose-400 text-xs flex items-center gap-2 transition-all">
              <LogOut className="w-3.5 h-3.5" /> خروج
            </button>
          </div>
        </header>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <div className="glass-panel p-4 text-center stat-glow-indigo">
            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-1">نشطة</div>
            <div className="text-2xl font-black text-white">{filteredOrders.active.length}</div>
          </div>
          <div className="glass-panel p-4 text-center stat-glow-rose">
            <div className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-1">فاشلة</div>
            <div className="text-2xl font-black text-rose-500">{filteredOrders.failed.length}</div>
          </div>
          <div className="glass-panel p-4 text-center stat-glow-emerald">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1">منتهية</div>
            <div className="text-2xl font-black text-emerald-500">{filteredOrders.done.length}</div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 backdrop-blur-md p-4 text-xs font-bold text-rose-400 shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Action Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel p-2 flex items-center relative group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-transparent border-0 py-3 pr-10 pl-4 text-white font-bold text-xs placeholder:text-slate-600 outline-none" placeholder="ابحث برقم الطلب..." />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFailedArchive(!showFailedArchive)} className={`flex-1 glass-panel px-4 py-3 font-black text-[11px] transition-all flex items-center justify-center gap-2 ${showFailedArchive ? 'bg-indigo-500/20 border-indigo-500/40 text-white' : 'text-slate-500'}`}>
              <AlertTriangle className="w-4 h-4" /> الأرشيف الفاشل ({filteredOrders.failed.length})
            </button>
            <button onClick={() => setShowDoneArchive(!showDoneArchive)} className={`flex-1 glass-panel px-4 py-3 font-black text-[11px] transition-all flex items-center justify-center gap-2 ${showDoneArchive ? 'bg-emerald-500/20 border-emerald-500/40 text-white' : 'text-slate-500'}`}>
              <CheckCircle2 className="w-4 h-4" /> المكتمل اليوم ({filteredOrders.done.length})
            </button>
          </div>
        </div>

        {/* Order Sections */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 py-2">
            <div className="relative flex h-3 w-3"><span className="animate-ping absolute h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative rounded-full h-3 w-3 bg-indigo-500"></span></div>
            <h2 className="text-lg font-black text-white tracking-tight">الطلبات الجارية للأهمية</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.active.length === 0 ? (
              <div className="col-span-full glass-panel border-dashed border-2 border-white/5 p-12 text-center text-slate-500 font-bold">كل شيء هادئ هنا... لا توجد طلبات جارية.</div>
            ) : filteredOrders.active.map(renderCard)}
          </div>
        </section>

        {showFailedArchive && (
          <section className="space-y-4 pt-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-lg font-black text-rose-400 flex items-center gap-2 border-t border-white/5 pt-6">أرشيف الطلبات الفاشلة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.failed.length === 0 ? <div className="col-span-full text-center text-slate-600 py-10 font-bold">لا توجد طلبات فاشلة اليوم.</div> : filteredOrders.failed.map(renderCard)}
            </div>
          </section>
        )}

        {showDoneArchive && (
          <section className="space-y-4 pt-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-lg font-black text-emerald-400 flex items-center gap-2 border-t border-white/5 pt-6">الطلبات المكتملة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-80">
              {filteredOrders.done.length === 0 ? <div className="col-span-full text-center text-slate-600 py-10 font-bold">لم تكتمل أي طلبات حتى الآن.</div> : filteredOrders.done.map(renderCard)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
