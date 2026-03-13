import { useContext, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle,
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
  logs?: Array<{
    status: string;
    by: any;
    note?: string;
    at?: string;
    createdAt?: string;
  }>;
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
  {
    value: "SELLER_NO_SHOW",
    label: "Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¬Ã˜Â¯",
  },
  {
    value: "SELLER_NOT_READY",
    label: "Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹ Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â¬Ã˜Â§Ã™â€¡Ã˜Â²",
  },
  {
    value: "COURIER_ISSUE",
    label: "Ã™â€¦Ã˜Â´Ã™Æ’Ã™â€žÃ˜Â© Ã™â€žÃ™Ë†Ã˜Â¬Ã˜Â³Ã˜ÂªÃ™Å Ã˜Â©",
  },
];

const GOVERNORATES = [
  "Ã˜Â¨Ã˜ÂºÃ˜Â¯Ã˜Â§Ã˜Â¯",
  "Ã˜Â§Ã™â€žÃ˜Â¨Ã˜ÂµÃ˜Â±Ã˜Â©",
  "Ã™â€ Ã™Å Ã™â€ Ã™Ë†Ã™â€°",
  "Ã˜Â£Ã˜Â±Ã˜Â¨Ã™Å Ã™â€ž",
  "Ã˜Â§Ã™â€žÃ™â€ Ã˜Â¬Ã™Â",
  "Ã™Æ’Ã˜Â±Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Â¡",
  "Ã™Æ’Ã˜Â±Ã™Æ’Ã™Ë†Ã™Æ’",
  "Ã˜Â§Ã™â€žÃ˜Â£Ã™â€ Ã˜Â¨Ã˜Â§Ã˜Â±",
  "Ã˜Â°Ã™Å  Ã™â€šÃ˜Â§Ã˜Â±",
  "Ã˜Â¨Ã˜Â§Ã˜Â¨Ã™â€ž",
  "Ã˜ÂµÃ™â€žÃ˜Â§Ã˜Â­ Ã˜Â§Ã™â€žÃ˜Â¯Ã™Å Ã™â€ ",
  "Ã˜Â§Ã™â€žÃ˜Â³Ã™â€žÃ™Å Ã™â€¦Ã˜Â§Ã™â€ Ã™Å Ã˜Â©",
  "Ã˜Â¯Ã™â€¡Ã™Ë†Ã™Æ’",
  "Ã™Ë†Ã˜Â§Ã˜Â³Ã˜Â·",
  "Ã™â€¦Ã™Å Ã˜Â³Ã˜Â§Ã™â€ ",
  "Ã˜Â§Ã™â€žÃ˜Â¯Ã™Å Ã™Ë†Ã˜Â§Ã™â€ Ã™Å Ã˜Â©",
  "Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â«Ã™â€ Ã™â€°",
  "Ã˜Â¯Ã™Å Ã˜Â§Ã™â€žÃ™â€°",
];

const failureReasonLabel: Record<string, string> = {
  BUYER_NO_SHOW:
    "Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å  Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¬Ã˜Â¯",
  BUYER_REFUSED:
    "Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å  Ã˜Â±Ã™ÂÃ˜Â¶ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€žÃ˜Â§Ã™â€¦",
  BUYER_DID_NOT_RECEIVE:
    "Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å  Ã™â€žÃ™â€¦ Ã™Å Ã˜Â³Ã˜ÂªÃ™â€žÃ™â€¦ Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â¶Ã˜Â§Ã˜Â¹Ã˜Â©",
  BUYER_UNREACHABLE: "Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å  Ã™â€žÃ˜Â§ Ã™Å Ã˜Â±Ã˜Â¯",
  WRONG_ADDRESS:
    "Ã˜Â¹Ã™â€ Ã™Ë†Ã˜Â§Ã™â€  Ã˜ÂºÃ™Å Ã˜Â± Ã˜ÂµÃ˜Â­Ã™Å Ã˜Â­/Ã˜ÂºÃ™Å Ã˜Â± Ã™Ë†Ã˜Â§Ã˜Â¶Ã˜Â­",
  SELLER_NO_SHOW:
    "Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ™Ë†Ã˜Â§Ã˜Â¬Ã˜Â¯",
  SELLER_NOT_READY: "Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹ Ã˜ÂºÃ™Å Ã˜Â± Ã˜Â¬Ã˜Â§Ã™â€¡Ã˜Â²",
  COURIER_ISSUE: "Ã™â€¦Ã˜Â´Ã™Æ’Ã™â€žÃ˜Â© Ã™â€žÃ™Ë†Ã˜Â¬Ã˜Â³Ã˜ÂªÃ™Å Ã˜Â©",
};

const statusLabel: Record<string, string> = {
  READY_FOR_PICKUP:
    "Ã˜Â¨Ã˜Â§Ã™â€ Ã˜ÂªÃ˜Â¸Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€žÃ˜Â§Ã™â€¦ Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹",
  PICKED_UP:
    "Ã˜ÂªÃ™â€¦ Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€žÃ˜Â§Ã™â€¦ Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹",
  OUT_FOR_DELIVERY: "Ã™â€šÃ™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã™â€ž",
  DELIVERED:
    "Ã˜ÂªÃ™â€¦ Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™â€žÃ™Å Ã™â€¦ Ã™â€žÃ™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å ",
  DELIVERY_FAILED: "Ã™ÂÃ˜Â´Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã™â€ž",
  COD_PAID_TO_SELLER: "Ã˜ÂªÃ™â€¦ Ã˜Â¯Ã™ÂÃ˜Â¹ COD Ã™â€žÃ™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹",
  COMPLETED: "Ã™â€¦Ã™Æ’Ã˜ÂªÃ™â€¦Ã™â€ž",
};

const isFinal = (status: string) =>
  ["COD_PAID_TO_SELLER", "COMPLETED"].includes(status);

const getCommission = (order: DeliveryOrder) =>
  calculateCommission(
    order.auction?.currentPrice || 0,
    order.auction?.startingPrice || 0,
  );
const sellerPayout = (order: DeliveryOrder) =>
  Math.max(0, Number(order.auction?.currentPrice || 0) - getCommission(order));
const extractReceiptNo = (order: DeliveryOrder): string => {
  // Prefer the top-level receiptId stored directly on the order
  if (order.receiptId) return order.receiptId;
  // Fallback: parse from logs note for older orders
  const log = order.logs?.find(
    (l) =>
      l.status === "COD_PAID_TO_SELLER" ||
      l.status === "COMPLETED" ||
      l.note?.includes("receiptNo="),
  );
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
  if (!agent) return "Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¹Ã™Å Ã™â€˜Ã™â€ ";
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

  const [assignAgentByOrder, setAssignAgentByOrder] = useState<
    Record<string, string>
  >({});
  const [otpByOrder, setOtpByOrder] = useState<Record<string, string>>({});
  const [receiptByOrder, setReceiptByOrder] = useState<Record<string, string>>(
    {},
  );
  const [reasonByOrder, setReasonByOrder] = useState<Record<string, string>>(
    {},
  );
  const [noteByOrder, setNoteByOrder] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(Date.now());
  const [showFailedArchive, setShowFailedArchive] = useState(false);
  const [showDoneArchive, setShowDoneArchive] = useState(false);
  const [expandedByOrder, setExpandedByOrder] = useState<
    Record<string, boolean>
  >({});
  const [showFailForm, setShowFailForm] = useState<Record<string, boolean>>({});

  const loadOrders = async () => {
    setLoadingOrders(true);
    setError(null);
    try {
      const { data } = await api.get("/courier/staff/orders");
      setOrders(data || []);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          "Ã™ÂÃ˜Â´Ã™â€ž Ã˜Â¬Ã™â€žÃ˜Â¨ Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª",
      );
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
      setError(
        e?.response?.data?.message ||
          "Ã™ÂÃ˜Â´Ã™â€ž Ã˜Â¬Ã™â€žÃ˜Â¨ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨Ã™Å Ã™â€ ",
      );
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
      ? orders.filter(
          (o) =>
            o._id.toLowerCase().includes(q) ||
            (o.trackingCode || "").toLowerCase().includes(q),
        )
      : orders;

    return {
      active: list.filter(
        (o) => !isFinal(o.status) && o.status !== "DELIVERY_FAILED",
      ),
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
      setError(
        e?.response?.data?.message ||
          "Ã™ÂÃ˜Â´Ã™â€ž Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â©",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  const onAssignAgent = (orderId: string) =>
    runOrderAction(orderId, async () => {
      const agentUserId = assignAgentByOrder[orderId];
      if (!agentUserId)
        throw new Error(
          "Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â± Ã™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨Ã˜Â§Ã™â€¹ Ã˜Â£Ã™Ë†Ã™â€žÃ˜Â§Ã™â€¹",
        );
      await api.post(`/courier/orders/${orderId}/assign-agent`, {
        agentUserId,
      });
    });

  const onPickedUp = (orderId: string) =>
    runOrderAction(orderId, async () => {
      await api.post(`/courier/orders/${orderId}/picked-up`);
    });

  const onCreateAgent = async () => {
    if (
      !newAgentName ||
      !newAgentPhone ||
      !newAgentEmail ||
      !newAgentPassword
    ) {
      setError(
        "Ø§Ù„Ø§Ø³Ù… ÙˆØ§Ù„Ù‡Ø§ØªÙ ÙˆØ§Ù„Ø¥ÙŠÙ…ÙŠÙ„ ÙˆÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù…Ø·Ù„ÙˆØ¨Ø©",
      );
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
        address: newAgentAddress,
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
      setError(e?.response?.data?.message || "ÙØ´Ù„ Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ù†Ø¯ÙˆØ¨");
    }
  };

  const onCodPaid = (orderId: string) =>
    runOrderAction(orderId, async () => {
      const otp = (otpByOrder[orderId] || "").trim();
      if (!otp) throw new Error("Ø£Ø¯Ø®Ù„ OTP Ø§Ù„Ø¨Ø§Ø¦Ø¹");
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
      if (!reason) throw new Error("Ø§Ø®ØªØ± Ø³Ø¨Ø¨ Ø§Ù„ÙØ´Ù„");
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

  if (authLoading)
    return (
      <div className="p-10 text-center text-white bg-slate-950 min-h-screen">
        جاري التحميل...
      </div>
    );
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "courier_staff") return <Navigate to="/" replace />;

  const renderOrderCard = (o: DeliveryOrder) => {
    const expanded = !!expandedByOrder[o._id];
    const isBusy = busyOrderId === o._id;
    const isDone = isFinal(o.status);
    const isFailed = o.status === "DELIVERY_FAILED";
    const canAssign = [
      "READY_FOR_PICKUP",
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
    ].includes(o.status);
    const canPickUp = ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(
      o.status,
    );
    const canCodPaid = ["DELIVERED"].includes(o.status);
    const canFail = !isFinal(o.status);
    const deadlineMs = o.auction?.confirmationDeadline
      ? new Date(o.auction.confirmationDeadline).getTime()
      : 0;
    const reviewOpen = o.status === "DELIVERY_FAILED" && deadlineMs > nowMs;
    const canRevert = reviewOpen;

    const statusClasses = isDone
      ? "status-completed"
      : isFailed
        ? "status-failed"
        : "status-active";
    const indicatorGlow = isDone
      ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
      : isFailed
        ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]"
        : "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]";

    return (
      <div
        key={o._id}
        className="glass-card overflow-hidden relative group p-5 flex flex-col gap-4 animate-slide-up"
      >
        {/* Status Indicator Bar */}
        <div className={`absolute top-0 right-0 w-2 h-full ${indicatorGlow}`} />

        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-lg tracking-tight">
                #{o._id.slice(-6).toUpperCase()}
              </span>
              <span className={`status-badge ${statusClasses}`}>
                {statusLabel[o.status] || o.status}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-bold mt-1.5 flex items-center gap-2">
              <User className="w-3 h-3" />
              Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨:{" "}
              <span className="text-slate-300">{agentName(o.agentUser)}</span>
            </div>
          </div>

          <button
            onClick={() =>
              setExpandedByOrder((p) => ({ ...p, [o._id]: !expanded }))
            }
            className="glass-card p-2 text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Action Quick Bar (Visible when not expanded) */}
        {!expanded && (
          <div className="flex items-center justify-between mt-1 pt-3 border-t border-white/5">
            <div className="text-[11px] font-black text-indigo-400">
              {Number(o.auction?.currentPrice || 0).toLocaleString()}{" "}
              <span className="opacity-50">IQD</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {o.trackingCode || "NO TRACKING"}
            </div>
          </div>
        )}

        {expanded && (
          <div className="mt-2 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Manifest Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[9px] font-black text-slate-500 uppercase mb-2">
                  Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™â€žÃ™Å Ã™â€¦
                  (Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å )
                </div>
                <div className="text-xs font-bold text-slate-200 mb-1">
                  {o.auction?.winner?.name || "-"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mb-2">
                  {o.auction?.winner?.phone || "-"}
                </div>
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  {fullAddress(o.auction?.winner || null)}
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                <div className="text-[9px] font-black text-slate-500 uppercase mb-2">
                  Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â§Ã˜Â³Ã˜ÂªÃ™â€žÃ˜Â§Ã™â€¦
                  (Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹)
                </div>
                <div className="text-xs font-bold text-slate-200 mb-1">
                  {o.auction?.seller?.name || "-"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mb-2">
                  {o.auction?.seller?.phone || "-"}
                </div>
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  {fullAddress(o.auction?.seller || null)}
                </div>
              </div>
            </div>

            {/* Financial Manifest */}
            <div className="bg-slate-900/40 rounded-2xl p-4 border border-white/5 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-[9px] font-black text-slate-500 uppercase mb-1">
                  Ã˜Â§Ã™â€žÃ˜Â±Ã™â€šÃ™â€¦ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â¬Ã˜Â¹Ã™Å 
                </div>
                <div className="text-xs font-mono font-bold text-indigo-400">
                  {o.trackingCode || "N/A"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] font-black text-slate-500 uppercase mb-1">
                  Ã˜Â³Ã˜Â¹Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â±Ã˜Â³Ã™Ë†
                </div>
                <div className="text-xs font-bold text-white">
                  {Number(o.auction?.currentPrice || 0).toLocaleString()}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] font-black text-slate-500 uppercase mb-1">
                  Ã˜ÂµÃ˜Â§Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â±Ã™Æ’Ã˜Â©
                </div>
                <div className="text-xs font-bold text-emerald-400">
                  {Number(o.deliveryFee || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {o.status === "DELIVERY_FAILED" && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-rose-400 font-black text-xs mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Ã˜Â³Ã˜Â¨Ã˜Â¨ Ã˜Â§Ã™â€žÃ™ÂÃ˜Â´Ã™â€ž:{" "}
                  {failureReasonLabel[o.failureReason || ""] ||
                    o.failureReason ||
                    "-"}
                </div>
                <div className="text-[10px] text-rose-300/70">
                  {reviewOpen
                    ? `Ã˜ÂªÃ˜Â­Ã˜Â°Ã™Å Ã˜Â±: Ã™â€¦Ã™â€¡Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹ Ã˜ÂªÃ™â€ Ã˜ÂªÃ™â€¡Ã™Å  Ã˜Â®Ã™â€žÃ˜Â§Ã™â€ž ${formatRemaining(deadlineMs - nowMs)}`
                    : "Ã™â€¦Ã˜ÂºÃ™â€žÃ™â€š Ã™â€ Ã™â€¡Ã˜Â§Ã˜Â¦Ã™Å Ã˜Â§Ã™â€¹ - Ã˜ÂªÃ™â€¦Ã˜Âª Ã™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â© Ã˜Â§Ã™â€žÃ™ÂÃ˜Â´Ã™â€ž."}
                </div>
              </div>
            )}

            {/* Control Panel */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="text-[10px] font-black text-slate-500 uppercase">
                    Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â§Ã˜Âª
                    Ã˜Â§Ã™â€žÃ™â€žÃ™Ë†Ã˜Â¬Ã˜Â³Ã˜ÂªÃ™Å Ã˜Â©
                  </div>
                  <select
                    value={assignAgentByOrder[o._id] || ""}
                    onChange={(e) =>
                      setAssignAgentByOrder((p) => ({
                        ...p,
                        [o._id]: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">
                      Ã˜ÂªÃ˜Â¹Ã™Å Ã™Å Ã™â€  Ã™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨...
                    </option>
                    {agents
                      .filter((a) => a.isCourierActive !== false)
                      .map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.name} ({a.phone})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => onAssignAgent(o._id)}
                    disabled={
                      !canAssign || isBusy || !assignAgentByOrder[o._id]
                    }
                    className="w-full premium-btn-primary text-xs py-3 disabled:opacity-30"
                  >
                    Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨
                    Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã™â€žÃ™Â
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] font-black text-slate-500 uppercase">
                    Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™Ë†Ã™Å Ã˜Â©
                    Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â© (COD)
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={otpByOrder[o._id] || ""}
                      onChange={(e) =>
                        setOtpByOrder((p) => ({
                          ...p,
                          [o._id]: e.target.value,
                        }))
                      }
                      className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono placeholder:text-slate-600 outline-none"
                      placeholder="OTP Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹"
                    />
                    <input
                      value={receiptByOrder[o._id] || ""}
                      onChange={(e) =>
                        setReceiptByOrder((p) => ({
                          ...p,
                          [o._id]: e.target.value,
                        }))
                      }
                      className="w-1/2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono placeholder:text-slate-600 outline-none"
                      placeholder="Ã˜Â±Ã™â€šÃ™â€¦ Ã˜Â§Ã™â€žÃ™Ë†Ã˜ÂµÃ™â€ž"
                    />
                  </div>
                  <button
                    onClick={() => onCodPaid(o._id)}
                    disabled={!canCodPaid || isBusy}
                    className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 rounded-xl py-3 text-emerald-400 font-black text-xs transition-all active:scale-95 disabled:opacity-20"
                  >
                    Ã˜ÂªÃ˜Â£Ã™Æ’Ã™Å Ã˜Â¯ Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€žÃ˜Â§Ã™â€¦
                    Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã˜Â´ Ã™Ë†Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™Ë†Ã™Å Ã˜Â©
                  </button>
                </div>
              </div>

              {/* Status Update Actions */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => onPickedUp(o._id)}
                  disabled={!canPickUp || isBusy}
                  className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl py-3 text-indigo-400 font-bold text-[10px] transition-all disabled:opacity-20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <Truck className="w-4 h-4" /> Ã˜ÂªÃ™â€¦
                  Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€žÃ˜Â§Ã™â€¦ Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨
                </button>
                <button
                  onClick={() => onRevertFailed(o._id)}
                  disabled={!canRevert || isBusy}
                  className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl py-3 text-amber-400 font-bold text-[10px] transition-all disabled:opacity-20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Ã˜ÂªÃ˜ÂµÃ˜Â­Ã™Å Ã˜Â­
                  Ã˜Â­Ã˜Â§Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™ÂÃ˜Â´Ã™â€ž
                </button>
                <button
                  onClick={() =>
                    setShowFailForm((p) => ({ ...p, [o._id]: !p[o._id] }))
                  }
                  className={`border rounded-xl py-3 font-bold text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    showFailForm[o._id]
                      ? "bg-rose-500 border-rose-500 text-white"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                  }`}
                >
                  <AlertCircle className="w-4 h-4" /> Ã˜Â¨Ã™â€žÃ˜Â§Ã˜Âº
                  Ã™ÂÃ˜Â´Ã™â€ž Ã˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã™â€ž
                </button>
              </div>

              {showFailForm[o._id] && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 animate-in slide-in-from-top-2">
                  <div className="text-[10px] font-black text-rose-400 uppercase mb-3">
                    Ã˜ÂªÃ™ÂÃ˜Â§Ã˜ÂµÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€žÃ˜Â§Ã˜Âº
                    Ã˜Â§Ã™â€žÃ™â€žÃ™Ë†Ã˜Â¬Ã˜Â³Ã˜ÂªÃ™Å 
                  </div>
                  <div className="space-y-3">
                    <select
                      value={reasonByOrder[o._id] || ""}
                      onChange={(e) =>
                        setReasonByOrder((p) => ({
                          ...p,
                          [o._id]: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none"
                    >
                      <option value="">
                        Ã˜Â§Ã˜Â®Ã˜ÂªÃ˜Â± Ã˜Â³Ã˜Â¨Ã˜Â¨
                        Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¹Ã˜Â«Ã˜Â±...
                      </option>
                      {failureReasons.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={noteByOrder[o._id] || ""}
                      onChange={(e) =>
                        setNoteByOrder((p) => ({
                          ...p,
                          [o._id]: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-medium text-white outline-none"
                      placeholder="Ã˜Â£Ã˜Â¶Ã™Â Ã™â€¦Ã™â€žÃ˜Â§Ã˜Â­Ã˜Â¸Ã˜Â§Ã˜Âª Ã˜ÂªÃ™Ë†Ã˜Â¶Ã™Å Ã˜Â­Ã™Å Ã˜Â© Ã™â€žÃ™â€žÃ™ÂÃ˜Â±Ã™Å Ã™â€š Ã˜Â§Ã™â€žÃ™ÂÃ™â€ Ã™Å ..."
                    />
                    <button
                      onClick={() => onFailed(o._id)}
                      disabled={!canFail || isBusy || !reasonByOrder[o._id]}
                      className="w-full bg-rose-600 rounded-xl py-3 text-white font-black text-xs shadow-lg shadow-rose-600/20"
                    >
                      Ã˜Â¥Ã˜Â±Ã˜Â³Ã˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â¨Ã™â€žÃ˜Â§Ã˜Âº
                      Ã™ÂÃ™Ë†Ã˜Â±Ã˜Â§Ã™â€¹
                    </button>
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
      {/* Premium Background Decoration */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-from),_transparent_50%)] from-indigo-500/10 to-transparent pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-from),_transparent_50%)] from-emerald-500/5 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 relative z-10 animate-slide-up">
        {/* Premium Command Header */}
        <header className="glass-panel p-6 md:p-8 flex flex-wrap items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -mr-16 -mt-16" />

          <div className="relative">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Ã™â€¦Ã˜Â±Ã™Æ’Ã˜Â² Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â­Ã™Æ’Ã™â€¦
              Ã˜Â¨Ã˜Â§Ã™â€žÃ™â€ Ã™â€šÃ™â€ž
            </h1>
            <p className="text-slate-400 mt-2 font-medium max-w-md">
              Ã˜Â¥Ã˜Â¯Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨Ã™Å Ã™â€ Ã˜Å’
              Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨Ã˜Â© Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª
              Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã™â€žÃ˜Å’ Ã™Ë†Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â¨Ã˜Â¹Ã˜Â©
              Ã˜Â§Ã™â€žÃ˜Â¯Ã™ÂÃ˜Â¹Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€ Ã™â€šÃ˜Â¯Ã™Å Ã˜Â©
              Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â§Ã˜Âª
              Ã˜Â§Ã™â€žÃ™â€žÃ™Ë†Ã˜Â¬Ã˜Â³Ã˜ÂªÃ™Å Ã˜Â© Ã˜Â¨Ã˜Â¯Ã™â€šÃ˜Â©
              Ã˜Â¹Ã˜Â§Ã™â€žÃ™Å Ã˜Â©.
            </p>
          </div>

          <div className="flex items-center gap-3 relative">
            <button
              onClick={loadOrders}
              className="glass-card px-5 py-2.5 font-bold flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95 border-white/5"
            >
              <RefreshCcw
                className={`w-4 h-4 text-indigo-400 ${loadingOrders ? "animate-spin" : ""}`}
              />
              Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â§Ã™â€žÃ˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª
            </button>
            <button
              onClick={logout}
              className="rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-5 py-2.5 font-bold text-rose-400 flex items-center gap-2 transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              Ã˜ÂªÃ˜Â³Ã˜Â¬Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜Â®Ã˜Â±Ã™Ë†Ã˜Â¬
            </button>
          </div>
        </header>

        {/* Global Intelligence Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          <div className="glass-panel p-5 text-center stat-glow-indigo group hover:border-indigo-500/30 transition-all">
            <div className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">
              Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨Ã™Ë†Ã™â€ 
            </div>
            <div className="text-4xl font-black text-white group-hover:scale-110 transition-transform">
              {agents.filter((a) => a.isCourierActive !== false).length}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Ã™Æ’Ã˜Â§Ã˜Â¯Ã˜Â± Ã™ÂÃ˜Â¹Ã˜Â§Ã™â€ž Ã˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â§Ã™â€¹
            </div>
          </div>
          <div className="glass-panel p-5 text-center hover:border-blue-500/30 transition-all">
            <div className="text-[11px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">
              Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã™â€ Ã˜Â´Ã˜Â·Ã˜Â©
            </div>
            <div className="text-4xl font-black text-white">
              {filteredOrders.active.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Ã™â€šÃ™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â©
            </div>
          </div>
          <div className="glass-panel p-5 text-center stat-glow-rose hover:border-rose-500/30 transition-all">
            <div className="text-[11px] font-black text-rose-400 uppercase tracking-[0.2em] mb-2">
              Ã˜ÂªÃ˜Â¹Ã˜Â«Ã˜Â± Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã™â€ž
            </div>
            <div className="text-4xl font-black text-rose-500">
              {filteredOrders.failed.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Ã˜ÂªÃ˜Â­Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â©
            </div>
          </div>
          <div className="glass-panel p-5 text-center stat-glow-emerald hover:border-emerald-500/30 transition-all">
            <div className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">
              Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã˜ÂªÃ™â€¦Ã™â€žÃ˜Â© Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦
            </div>
            <div className="text-4xl font-black text-emerald-500">
              {filteredOrders.done.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Ã˜ÂªÃ™â€¦Ã˜Âª Ã˜Â¨Ã™â€ Ã˜Â¬Ã˜Â§Ã˜Â­
            </div>
          </div>
        </div>
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 backdrop-blur-md p-4 text-sm font-bold text-rose-400 shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Premium Navigation Tabs */}
        <div className="flex bg-slate-900/50 backdrop-blur-xl p-1.5 rounded-[2rem] w-fit border border-white/5 mx-auto lg:mx-0 shadow-2xl">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-8 py-3.5 rounded-[1.5rem] font-black text-sm transition-all flex items-center gap-3 relative overflow-hidden group ${
              activeTab === "orders"
                ? "bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Truck
              className={`w-5 h-5 ${activeTab === "orders" ? "text-white" : "text-slate-600"}`}
            />
            Ã˜Â¥Ã˜Â¯Ã˜Â§Ã˜Â±Ã˜Â© Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª
            Ã™Ë†Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨Ã™Å Ã™â€ 
            {activeTab === "orders" && (
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("finances")}
            className={`px-8 py-3.5 rounded-[1.5rem] font-black text-sm transition-all flex items-center gap-3 relative overflow-hidden group ${
              activeTab === "finances"
                ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <ReceiptText
              className={`w-5 h-5 ${activeTab === "finances" ? "text-white" : "text-slate-600"}`}
            />
            Ã˜Â§Ã™â€žÃ˜Â³Ã˜Â¬Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â©
            Ã™â€žÃ™â€žÃ˜Â´Ã˜Â±Ã™Æ’Ã˜Â©
            {activeTab === "finances" && (
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        </div>

        {activeTab === "finances" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500 w-full">
            {filteredOrders.done.length === 0 ? (
              <div className="glass-panel p-16 text-center border-dashed border-2 border-white/5">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                  <ReceiptText className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-300">
                  Ã™â€žÃ˜Â§ Ã™Å Ã™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â³Ã˜Â¬Ã™â€ž Ã™â€¦Ã˜Â§Ã™â€žÃ™Å 
                  Ã˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â§Ã™â€¹
                </h3>
                <p className="text-slate-500 mt-2">
                  Ã˜Â¨Ã™â€¦Ã˜Â¬Ã˜Â±Ã˜Â¯ Ã˜Â§Ã™Æ’Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€ž
                  Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜ÂªÃ˜Å’ Ã˜Â³Ã˜ÂªÃ˜Â¸Ã™â€¡Ã˜Â±
                  Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â§Ã˜Âª
                  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â§Ã™â€žÃ™Å Ã˜Â©
                  Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â§Ã˜Âª Ã™â€¡Ã™â€ Ã˜Â§.
                </p>
              </div>
            ) : (
              <>
                {/* Financial Intelligence Overview */}
                <div className="glass-panel p-6 md:p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full -mr-32 -mt-32" />

                  <h3 className="font-black text-emerald-400 inline-flex items-center gap-3 text-xl mb-8 relative">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <Wallet className="w-6 h-6" />
                    </div>
                    Ã˜ÂªÃ˜Â­Ã™â€žÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â¯Ã™ÂÃ™â€šÃ˜Â§Ã˜Âª
                    Ã˜Â§Ã™â€žÃ™â€ Ã™â€šÃ˜Â¯Ã™Å Ã˜Â©
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="glass-card p-5 border-l-4 border-l-slate-400">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                        Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã˜Â´
                        Ã˜Â§Ã™â€žÃ™â€¦Ã˜ÂªÃ˜Â¯Ã˜Â§Ã™Ë†Ã™â€ž
                      </div>
                      <div className="text-2xl font-black text-white">
                        {filteredOrders.done
                          .reduce(
                            (acc, o) =>
                              acc +
                              Number(o.auction?.currentPrice || 0) +
                              Number(o.deliveryFee || 0),
                            0,
                          )
                          .toLocaleString()}
                        <span className="text-xs text-slate-500 mr-1 italic">
                          IQD
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ã˜ÂªÃ™â€¦
                        Ã˜Â§Ã˜Â³Ã˜ÂªÃ™â€žÃ˜Â§Ã™â€¦Ã™â€¡ Ã™â€¦Ã™â€ 
                        Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜ÂªÃ˜Â±Ã™Å Ã™â€ 
                      </div>
                    </div>

                    <div className="glass-card p-5 border-l-4 border-l-emerald-500 stat-glow-emerald">
                      <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">
                        Ã˜Â£Ã˜Â±Ã˜Â¨Ã˜Â§Ã˜Â­ Ã˜Â§Ã™â€žÃ˜Â´Ã˜Â±Ã™Æ’Ã˜Â©
                        Ã˜Â§Ã™â€žÃ˜ÂµÃ˜Â§Ã™ÂÃ™Å Ã˜Â©
                      </div>
                      <div className="text-2xl font-black text-emerald-400">
                        {filteredOrders.done
                          .reduce(
                            (acc, o) => acc + Number(o.deliveryFee || 0),
                            0,
                          )
                          .toLocaleString()}
                        <span className="text-xs text-emerald-600/70 mr-1 italic">
                          IQD
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-600/70 mt-2">
                        Ã˜Â¹Ã™â€  Ã˜Â¹Ã™â€¦Ã™â€žÃ™Å Ã˜Â§Ã˜Âª
                        Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦
                      </div>
                    </div>

                    <div className="glass-card p-5 border-l-4 border-l-indigo-500 stat-glow-indigo">
                      <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">
                        Ã™â€¦Ã˜Â³Ã˜ÂªÃ˜Â­Ã™â€šÃ˜Â§Ã˜Âª
                        Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹Ã™Å Ã™â€ 
                      </div>
                      <div className="text-2xl font-black text-indigo-300">
                        {filteredOrders.done
                          .reduce((acc, o) => acc + sellerPayout(o), 0)
                          .toLocaleString()}
                        <span className="text-xs text-indigo-400/50 mr-1 italic">
                          IQD
                        </span>
                      </div>
                      <div className="text-[10px] text-indigo-400/50 mt-2">
                        Ã™â€¦Ã˜Â¯Ã™ÂÃ™Ë†Ã˜Â¹Ã˜Â§Ã˜Âª Ã™â€ Ã™â€šÃ˜Â¯Ã™Å Ã˜Â©
                        Ã™ÂÃ™Ë†Ã˜Â±Ã™Å Ã˜Â©
                      </div>
                    </div>

                    <div className="glass-card p-5 border-l-4 border-l-rose-500 stat-glow-rose">
                      <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">
                        Ã˜Â¯Ã™Å Ã™Ë†Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜ÂµÃ˜Â©
                      </div>
                      <div className="text-2xl font-black text-rose-400">
                        {filteredOrders.done
                          .reduce((acc, o) => acc + getCommission(o), 0)
                          .toLocaleString()}
                        <span className="text-xs text-rose-500/50 mr-1 italic">
                          IQD
                        </span>
                      </div>
                      <div className="text-[10px] text-rose-500/50 mt-2">
                        Ã˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â§Ã˜Âª Ã™â€¦Ã˜Â³Ã˜ÂªÃ˜Â­Ã™â€šÃ˜Â©
                        Ã™â€žÃ™â€žÃ˜Â³Ã™Å Ã˜Â³Ã˜ÂªÃ™â€¦
                      </div>
                    </div>

                    <div className="glass-card p-5 border-l-4 border-l-slate-200 bg-white/5">
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">
                        Ã™â€šÃ™Å Ã™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã™Å Ã˜Â¹Ã˜Â§Ã˜Âª
                      </div>
                      <div className="text-2xl font-black text-white">
                        {filteredOrders.done
                          .reduce(
                            (acc, o) =>
                              acc + Number(o.auction?.currentPrice || 0),
                            0,
                          )
                          .toLocaleString()}
                        <span className="text-xs text-slate-500 mr-1 italic">
                          IQD
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-2">
                        Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã™â€¦Ã˜Â¨Ã™Å Ã˜Â¹Ã˜Â§Ã˜Âª
                        Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â²Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactions Ledger */}
                <div className="glass-panel overflow-hidden border-white/5">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-800 rounded-lg">
                        <ReceiptText className="w-5 h-5 text-indigo-400" />
                      </div>
                      <h4 className="font-black text-white">
                        Ã˜Â³Ã˜Â¬Ã™â€ž Ã˜Â§Ã™â€žÃ˜ÂªÃ˜Â³Ã™Ë†Ã™Å Ã˜Â§Ã˜Âª
                        Ã˜Â§Ã™â€žÃ˜ÂªÃ™ÂÃ˜ÂµÃ™Å Ã™â€žÃ™Å 
                      </h4>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦:{" "}
                      {new Date().toLocaleDateString("ar-EG")}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead>
                        <tr className="bg-white/2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="px-6 py-4">Ã˜Â§Ã™â€žÃ™Ë†Ã˜ÂµÃ™â€ž</th>
                          <th className="px-6 py-4">Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨</th>
                          <th className="px-6 py-4">
                            Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨
                          </th>
                          <th className="px-6 py-4 text-emerald-400">
                            COD Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ™â€žÃ™â€¦
                          </th>
                          <th className="px-6 py-4 text-indigo-400">
                            Ã˜Â£Ã˜Â±Ã˜Â¨Ã˜Â§Ã˜Â­Ã™Æ’
                          </th>
                          <th className="px-6 py-4 text-rose-400">
                            Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Ë†Ã™â€žÃ˜Â©
                          </th>
                          <th className="px-6 py-4 text-violet-400">
                            Ã˜ÂµÃ˜Â§Ã™ÂÃ™Å  Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Â¦Ã˜Â¹
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredOrders.done.map((o) => {
                          const gross = Number(o.auction?.currentPrice || 0);
                          const fee = Number(o.deliveryFee || 0);
                          const totalCol = gross + fee;
                          const comm = getCommission(o);
                          const pay = sellerPayout(o);
                          const receipt = extractReceiptNo(o);
                          const aName =
                            typeof o.agentUser === "object" && o.agentUser?.name
                              ? o.agentUser.name
                              : "Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â¹Ã˜Â±Ã™Ë†Ã™Â";

                          return (
                            <tr
                              key={o._id}
                              className="hover:bg-white/[0.02] transition-colors group"
                            >
                              <td className="px-6 py-4">
                                <span className="font-mono text-xs font-black bg-slate-800 text-indigo-300 px-3 py-1 rounded-full border border-white/5">
                                  {receipt}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-mono text-[11px] text-slate-500 font-bold group-hover:text-slate-300">
                                #{o._id.slice(-6).toUpperCase()}
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-slate-300">
                                {aName}
                              </td>
                              <td className="px-6 py-4 text-emerald-400 font-black">
                                {totalCol.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-indigo-300 font-bold">
                                {fee.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-rose-400/80 font-bold">
                                {comm.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-violet-300 font-black">
                                {pay.toLocaleString()}
                              </td>
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
            {/* Agent Management Intelligence */}
            <div className="glass-panel p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl rounded-full -mr-32 -mt-32" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl">
                    <UserCog className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">
                      Ã˜Â¥Ã˜Â¯Ã˜Â§Ã˜Â±Ã˜Â© Ã™â€¦Ã™â€ Ã˜Â§Ã˜Â¯Ã™Å Ã˜Â¨
                      Ã˜Â§Ã™â€žÃ˜ÂªÃ™Ë†Ã˜ÂµÃ™Å Ã™â€ž
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Ã™â€¦Ã˜Â±Ã˜Â§Ã™â€šÃ˜Â¨Ã˜Â© Ã™Æ’Ã™ÂÃ˜Â§Ã˜Â¡Ã˜Â©
                      Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨Ã™Å Ã™â€ 
                      Ã™Ë†Ã˜ÂªÃ˜Â¹Ã™Å Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ™â€¦Ã™â€¡Ã˜Â§Ã™â€¦
                      Ã˜Â§Ã™â€žÃ™â€žÃ™Ë†Ã˜Â¬Ã˜Â³Ã˜ÂªÃ™Å Ã˜Â©.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={loadAgents}
                    disabled={loadingAgents}
                    className="glass-card px-5 py-2.5 font-bold text-xs flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95"
                  >
                    <RefreshCcw
                      className={`w-3.5 h-3.5 ${loadingAgents ? "animate-spin" : ""}`}
                    />
                    Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â« Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ˜Â©
                  </button>
                  <button
                    onClick={() => setShowAgentModal(true)}
                    className="premium-btn-primary flex items-center gap-2 text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Ã˜Â¥Ã˜Â¶Ã˜Â§Ã™ÂÃ˜Â© Ã™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨ Ã˜Â¬Ã˜Â¯Ã™Å Ã˜Â¯
                  </button>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {agents.length === 0 ? (
                  <div className="col-span-full py-12 text-center rounded-2xl border-2 border-dashed border-white/5 bg-slate-900/20">
                    <p className="text-slate-500 font-bold">
                      Ã™â€žÃ˜Â§ Ã™Å Ã™Ë†Ã˜Â¬Ã˜Â¯ Ã™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨Ã™Ë†Ã™â€ 
                      Ã™â€¦Ã˜Â³Ã˜Â¬Ã™â€žÃ™Ë†Ã™â€  Ã˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â§Ã™â€¹.
                    </p>
                  </div>
                ) : (
                  agents.map((a) => (
                    <div
                      key={a._id}
                      className="glass-card p-4 group hover:ring-2 hover:ring-indigo-500/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-black text-indigo-400">
                            {a.name.slice(0, 1)}
                          </div>
                          <div
                            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${a.isCourierActive !== false ? "bg-emerald-500" : "bg-rose-500"}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-slate-200 truncate">
                            {a.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono tracking-tight mt-0.5">
                            {a.phone}
                          </div>
                        </div>
                        <button
                          onClick={() => onToggleAgent(a._id)}
                          className={`rounded-lg p-2 transition-all ${
                            a.isCourierActive !== false
                              ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                          }`}
                          title={
                            a.isCourierActive !== false
                              ? "Ã˜ÂªÃ˜Â¹Ã˜Â·Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨"
                              : "Ã˜ÂªÃ™ÂÃ˜Â¹Ã™Å Ã™â€ž Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨"
                          }
                        >
                          {a.isCourierActive !== false ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* Search & Intelligence Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-panel p-2 flex items-center relative group">
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Search className="w-5 h-5 text-indigo-400 group-focus-within:text-white transition-colors" />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border-0 py-4 pr-14 pl-6 text-white font-bold placeholder:text-slate-600 outline-none"
                  placeholder="Ã˜Â§Ã˜Â¨Ã˜Â­Ã˜Â« Ã˜Â¨Ã˜Â±Ã™â€šÃ™â€¦ Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨ (Order ID) Ã˜Â£Ã™Ë† Ã˜Â§Ã™â€žÃ˜ÂªÃ˜ÂªÃ˜Â¨Ã˜Â¹ (Tracking Number)..."
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-indigo-500/10 text-indigo-400 text-[10px] font-black px-3 py-1.5 rounded-lg border border-indigo-500/20">
                  AI SEARCH
                </div>
              </div>

              <div className="glass-panel p-2 flex items-center justify-between px-6 group hover:border-rose-500/30 transition-all">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl transition-colors ${showFailedArchive ? "bg-rose-500/20 text-rose-400" : "bg-slate-800 text-slate-500"}`}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-black text-slate-200">
                    Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™ÂÃ˜Â§Ã˜Â´Ã™â€žÃ˜Â©
                  </div>
                </div>
                <button
                  onClick={() => setShowFailedArchive((v) => !v)}
                  className={`rounded-xl px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                    showFailedArchive
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {showFailedArchive
                    ? "Ã˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡"
                    : `Ã˜Â¹Ã˜Â±Ã˜Â¶ (${filteredOrders.failed.length})`}
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
                  <h2 className="text-xl font-black text-blue-900 tracking-tight">
                    Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â§Ã˜Â±Ã™Å Ã˜Â©
                    (Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¡Ã™â€¦ - Ã™â€šÃ™Å Ã˜Â¯
                    Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â°)
                  </h2>
                </div>
                <span className="rounded-xl bg-blue-500 px-4 py-1.5 text-sm font-bold text-white shadow-sm flex items-center gap-2 w-max ring-4 ring-blue-50">
                  <Truck className="w-4 h-4" />
                  {filteredOrders.active.length} Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {filteredOrders.active.length === 0 ? (
                  <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
                    Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª
                    Ã™â€šÃ™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã™ÂÃ™Å 
                    Ã˜Â§Ã™â€žÃ™Ë†Ã™â€šÃ˜Âª Ã˜Â§Ã™â€žÃ˜Â­Ã˜Â§Ã™â€žÃ™Å .
                  </div>
                ) : (
                  filteredOrders.active.map(renderOrderCard)
                )}
              </div>
            </section>

            {showFailedArchive && (
              <section className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="inline-flex items-center gap-2 border-t-2 border-dashed border-slate-200 w-full pt-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                  <h2 className="text-lg font-black text-slate-800">
                    Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ™ÂÃ˜Â§Ã˜Â´Ã™â€žÃ˜Â©
                    (Ã™â€žÃ™â€žÃ™â€¦Ã˜Â±Ã˜Â§Ã˜Â¬Ã˜Â¹Ã˜Â©)
                  </h2>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                    {filteredOrders.failed.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {filteredOrders.failed.length === 0 ? (
                    <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
                      Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª
                      Ã™ÂÃ˜Â§Ã˜Â´Ã™â€žÃ˜Â© Ã˜Â­Ã˜Â§Ã™â€žÃ™Å Ã˜Â§Ã™â€¹.
                    </div>
                  ) : (
                    filteredOrders.failed.map(renderOrderCard)
                  )}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-slate-200/60 bg-white p-2.5 shadow-sm flex items-center justify-between px-5 mt-6">
              <div className="text-sm font-black text-slate-700 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Ã˜Â£Ã˜Â±Ã˜Â´Ã™Å Ã™Â Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª
                Ã˜Â§Ã™â€žÃ™â€¦Ã™Æ’Ã˜ÂªÃ™â€¦Ã™â€žÃ˜Â© Ã˜Â­Ã˜Â¯Ã™Å Ã˜Â«Ã˜Â§Ã™â€¹
              </div>
              <button
                onClick={() => setShowDoneArchive((v) => !v)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                  showDoneArchive
                    ? "bg-slate-900 text-white"
                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
              >
                {showDoneArchive
                  ? "Ã˜Â¥Ã˜Â®Ã™ÂÃ˜Â§Ã˜Â¡"
                  : `Ã˜Â¹Ã˜Â±Ã˜Â¶ (${filteredOrders.done.length})`}
              </button>
            </section>

            {showDoneArchive && (
              <section className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 opacity-90 hover:opacity-100 transition-opacity duration-300">
                  {filteredOrders.done.length === 0 ? (
                    <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center text-slate-400 font-medium">
                      Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª
                      Ã™â€¦Ã™â€ Ã˜ÂªÃ™â€¡Ã™Å Ã˜Â© Ã™ÂÃ™Å  Ã™â€šÃ˜Â§Ã˜Â¦Ã™â€¦Ã˜Â©
                      Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦.
                    </div>
                  ) : (
                    filteredOrders.done.map(renderOrderCard)
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {showAgentModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="text-lg font-black text-slate-900">
                  Ã˜Â¥Ã˜Â¶Ã˜Â§Ã™ÂÃ˜Â© Ã™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨ Ã˜Â¬Ã˜Â¯Ã™Å Ã˜Â¯
                </div>
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
                  placeholder="Ã˜Â§Ã˜Â³Ã™â€¦ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨"
                />
                <input
                  value={newAgentPhone}
                  onChange={(e) => setNewAgentPhone(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                  placeholder="Ã˜Â±Ã™â€šÃ™â€¦ Ã˜Â§Ã™â€žÃ™â€¡Ã˜Â§Ã˜ÂªÃ™Â"
                  inputMode="tel"
                />
                <input
                  value={newAgentEmail}
                  onChange={(e) => setNewAgentEmail(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                  placeholder="Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â±Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¥Ã™â€žÃ™Æ’Ã˜ÂªÃ˜Â±Ã™Ë†Ã™â€ Ã™Å "
                  type="email"
                />
                <input
                  value={newAgentPassword}
                  onChange={(e) => setNewAgentPassword(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                  placeholder="Ã™Æ’Ã™â€žÃ™â€¦Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â±Ã™Ë†Ã˜Â±"
                  type="password"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={newAgentGovernorate}
                    onChange={(e) => setNewAgentGovernorate(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-sm font-bold bg-white"
                  >
                    <option value="">
                      Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â§Ã™ÂÃ˜Â¸Ã˜Â©...
                    </option>
                    {GOVERNORATES.map((gov) => (
                      <option key={gov} value={gov}>
                        {gov}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newAgentAddress}
                    onChange={(e) => setNewAgentAddress(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                    placeholder="Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã™Ë†Ã˜Â§Ã™â€ "
                  />
                </div>
                <button
                  onClick={onCreateAgent}
                  disabled={
                    !newAgentName ||
                    !newAgentPhone ||
                    !newAgentEmail ||
                    !newAgentPassword ||
                    newAgentPassword.length < 6
                  }
                  className="w-full rounded-xl bg-slate-900 py-3 text-sm font-black text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  Ã˜Â¥Ã™â€ Ã˜Â´Ã˜Â§Ã˜Â¡ Ã˜Â§Ã™â€žÃ™â€¦Ã™â€ Ã˜Â¯Ã™Ë†Ã˜Â¨
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
