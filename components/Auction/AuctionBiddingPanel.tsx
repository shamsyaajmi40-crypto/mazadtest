import React, { useState, useEffect, useRef } from "react";
import { Clock, Eye, VolumeX, Volume2, Loader2, Gavel, History, AlertTriangle, Settings, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import maskUsername from "@/utils/maskUsername.ts";
import { placeBid } from "../../services/auction";
import { getImageUrl } from "../../utils/getImageUrl";
import TermsModal from "../TermsModal";
import { motion, AnimatePresence } from "framer-motion";

interface AuctionBiddingPanelProps {
  auction: any;
  bids: any[];
  user: any;
  socket: any;
  isConnected: boolean;
  isAdmin: boolean;
  refreshAuction: () => Promise<void>;
  setAuction: React.Dispatch<React.SetStateAction<any>>;
  setBids: React.Dispatch<React.SetStateAction<any[]>>;
  refreshUser: () => Promise<void>;
  playSound: (type: any) => void;
  triggerHaptic: (pattern?: any) => void;
  isMuted: boolean;
  toggleMute: () => void;
  viewersCount: number;
  setViewersCount: React.Dispatch<React.SetStateAction<number>>;
  handleApprove: () => Promise<void>;
  setRejectModalOpen: (open: boolean) => void;
  adminActionLoading: boolean;
}

const AuctionBiddingPanel = ({
  auction,
  bids,
  user,
  socket,
  isConnected,
  isAdmin,
  refreshAuction,
  setAuction,
  setBids,
  refreshUser,
  playSound,
  triggerHaptic,
  isMuted,
  toggleMute,
  viewersCount,
  setViewersCount,
  handleApprove,
  setRejectModalOpen,
  adminActionLoading,
}: AuctionBiddingPanelProps) => {
  const [bidLoading, setBidLoading] = useState(false);
  const [optimisticBid, setOptimisticBid] = useState<number | null>(null);
  const [bidCooldown, setBidCooldown] = useState(0);
  const [showBidTermsModal, setShowBidTermsModal] = useState(false);
  const [isHotAuction, setIsHotAuction] = useState(false);
  const [priceFlash, setPriceFlash] = useState(false);
  const [timeFlash, setTimeFlash] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [error, setError] = useState("");

  const timeRef = useRef<HTMLDivElement>(null);
  const auctionRef = useRef(auction);
  const bidsRef = useRef(bids);
  const userRef = useRef(user);
  const optimisticBidRef = useRef(optimisticBid);
  const lastBidTimesRef = useRef<number[]>([]);
  const hasPlayedGavelRef = useRef(false);

  useEffect(() => { auctionRef.current = auction; }, [auction]);
  useEffect(() => { bidsRef.current = bids; }, [bids]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { optimisticBidRef.current = optimisticBid; }, [optimisticBid]);

  const now = Date.now();
  const startTime = new Date(auction.startTime || auction.createdAt).getTime();
  const endTime = new Date(auction.endTime).getTime();
  const normalizedStatus = String(auction.status || "").toLowerCase();
  
  const isPending = normalizedStatus === "pending";
  const isRejected = normalizedStatus === "rejected";
  const isUpcoming = now < startTime && !isPending && !isRejected;
  const isActive = now >= startTime && now < endTime && normalizedStatus === "active";
  
  const isDealSuccess = normalizedStatus === "completed";
  const isDealFailed = ["cancelled_by_winner", "cancelled_by_seller", "cancelled_by_both"].includes(normalizedStatus) || auction.deliveryOrder?.status === "DELIVERY_FAILED";
  const isEnded = (now >= endTime || normalizedStatus === "ended" || isDealSuccess || isDealFailed) && !isPending && !isRejected;

  const isOwner = String(auction.owner?._id || auction.owner) === String(user?._id);
  const isCurrentLeader = bids.length > 0 && String(bids[0].bidder?._id || (typeof bids[0].bidder === 'string' ? bids[0].bidder : (bids[0].bidder as any)._id)) === String(user?._id);

  const displayedPrice = optimisticBid !== null ? optimisticBid : auction.currentPrice;
  const targetTime = isUpcoming ? startTime : endTime;
  const timeDiff = targetTime - now;
  const isLastMinutes = isActive && timeDiff > 0 && timeDiff <= 5 * 60 * 1000;

  const getUserId = (u: any): string => {
    if (!u) return "";
    return typeof u === "string" ? u : u._id || u.id || "";
  };

  const uniqueBidsMap = new Map<string, { bid: any; count: number; bidderId: string }>();
  bids.forEach((bid) => {
    const bId = getUserId(bid.bidder);
    if (!bId) return;
    const existing = uniqueBidsMap.get(bId);
    if (existing) {
      existing.count++;
    } else {
      uniqueBidsMap.set(bId, { bid, count: 1, bidderId: bId });
    }
  });
  const uniqueBids = Array.from(uniqueBidsMap.values()).sort((a, b) => b.bid.amount - a.bid.amount);

  useEffect(() => {
    const timer = setInterval(() => {
      const a = auctionRef.current;
      if (!a || !timeRef.current) return;
      const currentNow = Date.now();
      const s = a.startTime ? new Date(a.startTime).getTime() : new Date(a.createdAt).getTime();
      const e = new Date(a.endTime).getTime();
      let target: number;
      let label: string;

      if (currentNow < s) { target = s; label = "upcoming"; } 
      else if (currentNow >= s && currentNow < e) { target = e; label = "active"; } 
      else { 
        timeRef.current.textContent = "منتهي"; 
        if (!hasPlayedGavelRef.current) { playSound('gavel'); hasPlayedGavelRef.current = true; }
        return; 
      }

      const diff = target - currentNow;
      if (diff <= 0) { timeRef.current.textContent = label === "upcoming" ? "بدأ الآن" : "منتهي"; return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      if (label === "active" && diff <= 30000 && diff > 0) playSound('tick');
      timeRef.current.textContent = `${h}س ${m}د ${sec}ث`;
    }, 1000);
    return () => clearInterval(timer);
  }, [playSound]);

  useEffect(() => {
    if (bidCooldown <= 0) return;
    const t = setInterval(() => setBidCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [bidCooldown]);

  useEffect(() => { if (bidCooldown === 0) setError(""); }, [bidCooldown]);

  const applyAuctionUpdate = (data: { auction: any; bids: any[] }) => {
    setAuction((prev: any) => {
      if (!prev) return data.auction;
      // Allow update if optimistic bid is null OR if server price has caught up/surpassed it
      if (optimisticBidRef.current !== null && data.auction.currentPrice < optimisticBidRef.current) {
        return { ...prev, endTime: data.auction.endTime };
      }
      return data.auction;
    });
    setBids(data.bids);
  };

  const executeBid = async () => {
    if (!auction || bidLoading) return;

    const basePrice = optimisticBid !== null ? optimisticBid : auction.currentPrice;
    const nextBid = basePrice + auction.increment;

    setOptimisticBid(nextBid);
    setBidLoading(true);
    setError("");
    playSound('bid');
    triggerHaptic(50);

    try {
      const optimisticBidEntry = {
        _id: "optimistic",
        amount: nextBid,
        bidder: user._id,
        createdAt: new Date().toISOString(),
      };

      setBids((prev) => [optimisticBidEntry, ...prev]);

      await placeBid(auction._id, nextBid, true);
      playSound('success');
      await refreshAuction();
      setOptimisticBid(null);
    } catch (err: any) {
      setOptimisticBid(null);
      const status = err?.response?.status;
      if (status === 429) {
        const retryAfter = err?.response?.data?.retryAfter ?? Number(err?.response?.headers?.["retry-after"]) ?? 5;
        setBidCooldown(Number(retryAfter));
        setError(`يرجى الانتظار ${Number(retryAfter)} ثانية ثم أعد المحاولة`);
        return;
      }
      setError(err?.response?.data?.message || "فشلت المزايدة");
    } finally {
      setBidLoading(false);
    }
  };

  const handlePlaceBid = async () => {
    if (!user) {
      alert("يجب تسجيل الدخول للمزايدة");
      return;
    }
    if (!auction || bidLoading) return;
    if (bidCooldown > 0) {
      setError(`انتظر ${bidCooldown} ثانية ثم أعد المحاولة`);
      return;
    }

    try { await refreshUser(); } catch (e) { }

    const hasAlreadyBid = bids.some(
      (b) => b.bidder && getUserId(b.bidder) === String(user?._id)
    );

    if (!hasAlreadyBid && (user?.balance || 0) < (auction.depositAmount || 0)) {
      setError(`رصيدك غير كافٍ. يتطلب المزاد عربوناً بقيمة ${(auction.depositAmount || 0).toLocaleString()} د.ع.`);
      return;
    }

    const acceptedKey = `hasAcceptedBidTerms_${auction._id}`;
    if (!sessionStorage.getItem(acceptedKey)) {
      setShowBidTermsModal(true);
      return;
    }

    await executeBid();
  };

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join the auction room for real-time updates
    socket.emit("auction:join", auction._id);

    const handleBidNew = (data: { auction: any; bids?: any[] }) => {
      if (!data?.bids) {
        setAuction((prev: any) => {
          if (!prev) return data.auction;
          if (optimisticBidRef.current !== null) return { ...prev, endTime: data.auction.endTime };
          return data.auction;
        });
        return;
      }

      const getSafeId = (val: any) => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        const id = val._id || val.id;
        if (id) return String(id);
        return null;
      };

      const myId = getSafeId(userRef.current);
      const currentHighestId = getSafeId(data.bids?.[0]?.bidder);
      const prevWinnerId = getSafeId(auctionRef.current?.winner);
      const prevTopBidderId = bidsRef.current.length > 0 ? getSafeId(bidsRef.current[0].bidder) : null;

      const isMeNow = !!(myId && currentHighestId && String(myId) === String(currentHighestId));
      const wasMePrev = !!(myId && (String(prevWinnerId) === String(myId) || String(prevTopBidderId) === String(myId)));

      if (wasMePrev && !isMeNow) {
        playSound('outbid');
        triggerHaptic([60, 40, 60]);
      } else if (isMeNow) {
        if (optimisticBidRef.current === null) {
          playSound('success');
        }
      } else {
        playSound('competition');
      }

      const nowTs = Date.now();
      lastBidTimesRef.current = [...lastBidTimesRef.current.filter(ts => nowTs - ts < 10000), nowTs];
      if (lastBidTimesRef.current.length >= 3 && !isHotAuction) {
        setIsHotAuction(true);
        playSound('fire');
        setTimeout(() => setIsHotAuction(false), 12000);
      }

      applyAuctionUpdate(data as any);
      setPriceFlash(true);
      setTimeout(() => setPriceFlash(false), 900);

      if (optimisticBidRef.current === null && data.auction?.currentPrice) {
        toast(`⚡ ${data.auction.currentPrice.toLocaleString()} د.ع`, {
          duration: 3000,
          style: { fontWeight: 'bold', direction: 'rtl' },
        });
      }

      if ((data as any).extensionApplied) {
        setTimeFlash(true);
        setTimeout(() => setTimeFlash(false), 2000);
        toast(`⏱️ تم تمديد وقت المزاد بـ ${(data as any).extensionSeconds ?? 60} ثانية بسبب مزايدة في اللحظات الأخيرة!`, {
          duration: 5000,
          icon: '🔔',
          style: { fontWeight: 'bold', direction: 'rtl', background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' },
        });
      }
    };

    socket.on("bid:new", handleBidNew);

    const handleViewersCount = (count: number) => {
      setViewersCount(count);
    };
    socket.on("viewers_count", handleViewersCount);

    return () => { 
      socket.off("bid:new", handleBidNew); 
      socket.off("viewers_count", handleViewersCount);
    };
  }, [socket, isConnected, playSound, triggerHaptic, setAuction, setBids, setViewersCount]);

  useEffect(() => {
    if (optimisticBid !== null && auction && auction.currentPrice >= optimisticBid) {
      setOptimisticBid(null);
    }
  }, [auction?.currentPrice, optimisticBid]);

  return (
    <div className="bg-white/90 backdrop-blur-2xl p-5 sm:p-8 rounded-3xl border border-white shadow-[0_10px_40px_rgb(0,0,0,0.08)] sticky top-24 h-fit flex flex-col z-20">
      {/* Price & Status Row */}
      <div className="bg-white border border-slate-100 rounded-[2rem] p-5 sm:p-6 shadow-xl shadow-slate-200/30 relative overflow-hidden mb-6">
        <div className="flex items-center justify-between mb-5">
          {isPending ? (
            <div className="flex items-center gap-2 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">تحت المراجعة</span>
            </div>
          ) : isRejected ? (
            <div className="flex items-center gap-2 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">تم الرفض</span>
            </div>
          ) : !isEnded ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-red-50 px-3 py-1 rounded-lg border border-red-100/50">
              <div className="relative flex items-center justify-center w-2 h-2">
                {isActive && <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping"></span>}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isActive ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-slate-300'}`}></span>
              </div>
              <span className={`text-[10px] font-black tracking-widest uppercase ${isActive ? 'text-red-600' : 'text-slate-400'}`}>
                {isActive ? "LIVE" : "UPCOMING"}
              </span>
            </div>
            {/* Connection Status Indicator */}
            <div 
              className={`w-2 h-2 rounded-full shadow-[0_0_5px_rgba(0,0,0,0.1)] transition-colors duration-500 ${isConnected ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-slate-300'}`}
              title={isConnected ? "متصل بالبث المباشر" : "غير متصل - جاري إعادة الاتصال..."}
            />
          </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
              <span className="text-[10px] font-black text-slate-500">منتهي</span>
            </div>
          )}

          {isActive && (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
                title={isMuted ? "تفعيل الصوت" : "كتم الصوت"}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                <Eye className="w-3.5 h-3.5" />
                <span>{viewersCount} يشاهدون</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className={`flex flex-col justify-center rounded-2xl p-2.5 sm:p-3.5 relative overflow-hidden transition-all duration-300 ${isHotAuction ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-500/20 shadow-lg shadow-orange-500/10' : 'bg-indigo-50/50 border-indigo-100'} ${priceFlash ? 'bg-indigo-100 border-indigo-300 shadow-inner scale-105' : ''}`}>
            <div className="flex justify-between items-start mb-1 relative z-10">
              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${isHotAuction ? 'text-orange-700' : 'text-indigo-700/60'}`}>
                {isEnded ? "السعر النهائي" : "أعلى عرض حالي"}
              </span>
              {!isEnded && (
                <span className={`text-[9px] font-black bg-white px-1.5 py-0.5 rounded border shadow-sm ${isHotAuction ? 'text-orange-600 border-orange-100' : 'text-indigo-600 border-indigo-100'}`}>
                  +{auction.increment.toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex flex-col relative z-10">
              <div className="flex items-baseline gap-1">
                <span className={`text-xl sm:text-2xl font-black tracking-tight leading-none whitespace-nowrap ${isHotAuction ? 'text-orange-900' : 'text-indigo-900'}`}>{displayedPrice.toLocaleString()}</span>
                <span className={`text-[9px] sm:text-[10px] font-bold shrink-0 ${isHotAuction ? 'text-orange-400' : 'text-indigo-400'}`}>د.ع</span>
              </div>
              <div className={`text-[8px] font-bold mt-0.5 ${isHotAuction ? 'text-orange-600/60' : 'text-indigo-600/40'}`}>
                بدأ بـ: {auction?.startingPrice?.toLocaleString()} د.ع
              </div>
            </div>
          </div>

          {!isEnded ? (
            <div className={`flex flex-col justify-center rounded-2xl p-2.5 sm:p-3.5 relative overflow-hidden transition-all shadow-sm 
              ${timeFlash ? 'bg-orange-500 scale-105 shadow-orange-500/50' : isLastMinutes ? 'bg-gradient-to-br from-orange-500 to-red-600 border-none shadow-orange-500/20' : 'bg-slate-900 border border-slate-800'}`}>
              <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1 ${timeFlash || isLastMinutes ? 'text-white/80' : 'text-slate-400'}`}>
                {timeFlash ? "تم التمديد!" : isLastMinutes ? "فرصة أخيرة!" : "الوقت المتبقي"}
              </span>
              <div ref={timeRef} className={`text-[1.1rem] sm:text-[1.25rem] font-black tabular-nums tracking-tight leading-none relative z-10 whitespace-nowrap min-w-0 ${timeFlash || isLastMinutes ? 'text-white drop-shadow-md animate-pulse' : 'text-emerald-400'}`}></div>
            </div>
          ) : (
            <div className="flex flex-col justify-center bg-slate-50 border border-slate-100 rounded-2xl p-2.5 sm:p-3.5">
              <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">حالة المزاد</span>
              <span className="text-xs sm:text-sm font-black text-slate-700">انتهى الوقت</span>
            </div>
          )}
        </div>

        {!isEnded && !isOwner && (
          <button
            onClick={handlePlaceBid}
            disabled={isUpcoming || isPending || isRejected || bidLoading || bidCooldown > 0 || isCurrentLeader}
            className={`w-full py-4 sm:py-5 text-white rounded-2xl sm:rounded-3xl font-black text-sm sm:text-base flex flex-col items-center justify-center gap-1 sm:gap-1.5 transition-all duration-300 group relative overflow-hidden
            ${isCurrentLeader 
              ? 'bg-gradient-to-r from-slate-400 to-slate-500 shadow-lg opacity-90 cursor-default' 
              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 shadow-[0_10px_25px_-5px_rgba(16,185,129,0.5)] hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.6)] active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none'}`}
          >
            {bidLoading ? <Loader2 className="animate-spin w-6 h-6" /> : isCurrentLeader ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-100" />
                <span className="text-emerald-50">أنت المتصدر حالياً</span>
              </>
            ) : (
              <>
                <Gavel className="w-5 h-5" />
                <span>{bidCooldown > 0 ? `انتظر ${bidCooldown}ث` : `${(displayedPrice + auction.increment).toLocaleString()} د.ع`}</span>
              </>
            )}
          </button>
        )}

        {/* Balance Hint */}
        {user && !isOwner && !isEnded && (
          <div className="mt-3 flex items-center justify-center gap-2">
            { (user.balance || 0) < (auction.depositAmount || 0) ? (
              <span className="text-[11px] font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100 animate-pulse">
                ⚠️ رصيدك الحالي {user.balance?.toLocaleString()} د.ع | تحتاج {(auction.depositAmount).toLocaleString()} د.ع عربون
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-slate-400">
                سيتم حجز {(auction.depositAmount || 0).toLocaleString()} د.ع كعربون عند المزايدة
              </span>
            )}
          </div>
        )}
      </div>

       {isPending && isAdmin && (
          <div className="mt-6 p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden group mb-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all"></div>
            <div className="relative z-10">
              <h3 className="text-white font-black text-sm mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> لوحة تحكم الإدارة
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleApprove}
                  disabled={adminActionLoading}
                  className="flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {adminActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  قبول ونشر
                </button>
                <button
                  onClick={() => setRejectModalOpen(true)}
                  disabled={adminActionLoading}
                  className="flex items-center justify-center gap-2 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-black text-xs active:scale-95 transition-all disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  رفض المزاد
                </button>
              </div>
            </div>
          </div>
        )}

      {!isEnded && uniqueBids.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100/60 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-slate-200/50"></div>
          <h4 className="flex items-center justify-between text-sm sm:text-base font-black text-slate-800 mb-5">
            <span className="flex items-center gap-2.5">
              <History className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
              أعلى المزايدين (المتصدرين)
            </span>
            <span className="text-[10px] sm:text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md font-bold">{uniqueBids.length} منافسين</span>
          </h4>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {uniqueBids.slice(0, 3).map((b, idx) => {
              const bId = b.bidderId;
              const isMe = bId === getUserId(user);
              const isFirst = idx === 0;
              return (
                <div key={bId} className={`flex items-center justify-between p-3.5 sm:p-4 rounded-[1.25rem] border transition-all duration-300 ${isFirst ? 'bg-gradient-to-r from-amber-50 to-yellow-50/30 border-amber-200/60 shadow-[0_4px_20px_rgb(251,191,36,0.15)] scale-[1.02] origin-right z-10' : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100/80 hover:border-slate-200'}`}>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-2xl font-black text-lg sm:text-xl shadow-sm ${isFirst ? 'bg-gradient-to-br from-amber-200 to-yellow-400 text-white shadow-amber-300/50' : 'bg-white text-slate-400 border border-slate-100'}`}>
                      {isFirst ? '👑' : `#${idx + 1}`}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm sm:text-base font-black ${isFirst ? 'text-amber-900 tracking-tight' : 'text-slate-700'}`}>
                        {(isMe || isOwner) ? (isMe ? (isFirst ? "أنت المتصدر! 🥇" : "مزايدتك (تم تجاوزك)") : (b.bid.bidder?.name || "مزايد")) : maskUsername(b.bid.bidder?.name || "")}
                      </span>
                      <span className="text-[10px] sm:text-xs text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isFirst ? 'bg-amber-400' : 'bg-slate-300'}`}></span>
                        {b.count} مزايدة
                      </span>
                    </div>
                  </div>
                  <div className={`font-black tracking-tight flex flex-col items-end ${isFirst ? 'text-amber-700 text-base sm:text-lg' : 'text-slate-800 text-[13px] sm:text-sm'}`}>
                    {b.bid.amount.toLocaleString()}
                    <span className="text-[9px] sm:text-[10px] uppercase opacity-70">د.ع</span>
                  </div>
                </div>
              );
            })}
          </div>
          {uniqueBids.length > 0 && (
            <button 
              onClick={() => setShowHistoryModal(true)}
              className="w-full mt-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black transition-all border border-slate-200 border-dashed"
            >
              عرض السجل الكامل ({bids.length} مزايدات)
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 text-rose-600 bg-rose-50 p-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Terms Modal for Bidding */}
      <TermsModal
        isOpen={showBidTermsModal}
        onClose={() => setShowBidTermsModal(false)}
        title="تأكيد شروط المزايدة"
        description={<>بمجرد وضع المزايدة، سيتم اقتطاع وحجز <strong>عربون دخول</strong> بقيمة ({(auction.depositAmount || 0).toLocaleString()} د.ع) من محفظتك لضمان جديتك في هذا المزاد.</>}
        termsList={[
          "المزايدة تعتبر التزاماً قاطعاً بالشراء في حال رسو المزاد عليك.",
          "سيتم خصم مبلغ العربون فور المزايدة ولن يتم استرداده إذا انسحبت بعد فوزك.",
          "في حال خسارتك للمزاد، سيتم فك الحجز وإرجاع العربون إلى محفظتك فوراً.",
          "يجب عليك الرد وإتمام الصفقة مع البائع خلال المدة المحددة."
        ]}
        actionLabel={`موافق ومزايدة بـ ${(displayedPrice + auction.increment).toLocaleString()} د.ع`}
        onAccept={async () => {
          const acceptedKey = `hasAcceptedBidTerms_${auction._id}`;
          sessionStorage.setItem(acceptedKey, "true");
          setShowBidTermsModal(false);
          await executeBid();
        }}
      />

      {/* Full History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-500" /> سجل المزايدات الكامل
                </h3>
                <button 
                  onClick={() => setShowHistoryModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 transition-colors"
                >
                  <XCircle className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {bids.map((bid, idx) => {
                  const bId = getUserId(bid.bidder);
                  const isMe = bId === getUserId(user);
                  return (
                    <div key={bid._id} className={`flex items-center justify-between p-4 rounded-2xl border ${idx === 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'} transition-all`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {idx === 0 ? '👑' : `#${idx + 1}`}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {(isMe || isOwner) ? (isMe ? "أنت" : (bid.bidder?.name || "مزايد")) : maskUsername(bid.bidder?.name || "")}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {new Date(bid.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className={`font-black text-sm ${idx === 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                        {bid.amount.toLocaleString()} د.ع
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">إجمالي المزايدات: {bids.length}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AuctionBiddingPanel;
