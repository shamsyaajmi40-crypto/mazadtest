
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Auction } from '../types';
import { Clock, Tag, Image as ImageIcon } from 'lucide-react';
import { AUCTION_STATUS } from "../types";
import { getImageUrl } from "@/utils/getImageUrl";
import api from "../services/api";



//
const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return { text: "مكتمل", className: "bg-green-100 text-green-800" };

    case "cancelled_by_winner":
    case "cancelled_by_seller":
    case "cancelled_by_both":
      return { text: "ملغي", className: "bg-red-100 text-red-800" };

    case "ended":
      return { text: "منتهي", className: "bg-yellow-100 text-yellow-800" };

    default:
      return null;
  }
};

//hotaucation 




// ?…?ƒ?ˆ?† ?„?¹?±?¶ ?†?¬?ˆ?… ?§?„???‚?????…
const RatingStars = ({ value }: { value: number }) => {
  // ???‚?±???¨ ?§?„?‚???…?© ?¥?„?‰ ?£?‚?±?¨ ?†?µ??
  const full = Math.floor(value);
  // ?­?³?§?¨ ?¥?°?§ ?ƒ?§?† ?‡?†?§?ƒ ?†?µ?? ?†?¬?…?©
  const hasHalf = value - full >= 0.5;
  // ?­?³?§?¨ ?§?„?†?¬?ˆ?… ?§?„???§?±???©
  const empty = 5 - full - (hasHalf ? 1 : 0);
  // ?¯?§?„?© ?„?­?³?§?¨ ?§?„?ˆ?‚?? ?§?„?…???¨?‚??


  // ?¹?±?¶ ?§?„?†?¬?ˆ?…
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <svg key={`f-${i}`} viewBox="0 0 24 24" width="14" height="14" fill="#facc15">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}

      {hasHalf && (
        <svg viewBox="0 0 24 24" width="14" height="14">
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="50%" stopColor="#e5e7eb" />
            </linearGradient>
          </defs>
          <path
            fill="url(#half)"
            d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
          />
        </svg>
      )}

      {Array.from({ length: empty }).map((_, i) => (
        <svg key={`e-${i}`} viewBox="0 0 24 24" width="14" height="14" fill="#e5e7eb">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </div>
  );
};

// ?¨?·?§?‚?© ?§?„?…?²?§?¯ ?„?¹?±?¶ ?…?¹?„?ˆ?…?§?? ?§?„?…?²?§?¯
const AuctionCard: React.FC<{ auction: Auction; archived?: boolean; compact?: boolean }> = ({ auction, archived = false, compact = false }) => {
  const navigate = useNavigate();
  // ?­?§?„?© ?§?„?ˆ?‚?? ?§?„?…???¨?‚??
  // ?­?§?„?© ?§?†???‡?§?? ?§?„?…?²?§?¯
  const [isEnded, setIsEnded] = useState(false);
  // ?­?§?„?© ?§?„???‚?????…
  const [rating, setRating] = useState<{
    average: number | null;
    count: number;
  } | null>(null);
  // ?¬?„?¨ ?­?§?„?© ?§?„?…?²?§?¯ (?…?¬?¯?ˆ?„?Œ ?…?¨?§?´?±?Œ ?…?†???‡??)
  // =====================
  // Auction Time Status
  // =====================


  const now = Date.now();
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();

  const isScheduled = now < start;
  const isActive = now >= start && now < end;
  const isEndedByTime = now >= end;

  // ?ˆ?‚?? ?§?„?¹?¯ ?§?„???†?§?²?„?? ?§?„?µ?­???­
  // ?¹?¯?§?¯ ?????§?¹?„?? ?®?????? ?„?¨?·?§?‚?© ?§?„?…?²?§?¯
  const getRemainingTime = () => {
    const now = Date.now();

    const start = new Date(auction.startTime).getTime();
    const end = new Date(auction.endTime).getTime();

    const target = now < start ? start : end;

    const diff = target - now;

    if (diff <= 0) return null;

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return { days, hours, minutes, seconds };
  };

  const [, forceTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      forceTick(v => v + 1);
    }, 1000);

    return () => clearInterval(t);
  }, []);

  const totalDuration = end - start;
  const elapsed = now - start;
  // ?­?³?§?¨ ?†?³?¨?© ?§?„???‚?¯?…
  const progress =
    totalDuration > 0
      ? Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100)
      : 0;

  // ?¬?„?¨ ?…?„?®?µ ???‚?????…?§?? ?µ?§?­?¨ ?§?„?…?²?§?¯
  useEffect(() => {
    const sellerId =
      typeof auction.owner === "string"
        ? auction.owner
        : auction.owner?._id;

    if (!sellerId) return;

    api
      .get(`/ratings/user/${sellerId}/summary`)
      .then((res) => setRating(res.data))
      .catch(() => { });
  }, [auction.owner]);

  // ?­?³?§?¨ ?§?„?ˆ?‚?? ?§?„?…???¨?‚??
  useEffect(() => {
    if (auction.status !== AUCTION_STATUS.ACTIVE) {
      setIsEnded(true);
      return;
    }

    setIsEnded(false);
    const timer = setInterval(() => {
      const now = Date.now();
      const end = new Date(auction.endTime).getTime();

      if (end - now <= 0) {
        setIsEnded(true);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [auction.endTime, auction.status]);

  const getStatusColor = () => {
    if (isScheduled) return "bg-blue-600";
    if (isActive) return "bg-emerald-600";
    if (isEndedByTime) return "bg-gray-800";

    switch (auction.status) {
      case AUCTION_STATUS.PENDING:
        return "bg-yellow-600";
      case AUCTION_STATUS.REJECTED:
        return "bg-red-600";
      default:
        return "bg-gray-500";
    }
  };


  const getStatusLabel = () => {
    if (isScheduled) return "يبدأ قريباً";
    if (isActive) return "مباشر";
    if (isEndedByTime) return "منتهي";

    switch (auction.status) {
      case AUCTION_STATUS.PENDING:
        return "مراجعة";
      case AUCTION_STATUS.REJECTED:
        return "مرفوض";
      default:
        return "";
    }
  };

  const remaining = getRemainingTime();
  const isUrgent =
    remaining &&
    (remaining.days === 0 &&
      remaining.hours === 0 &&
      remaining.minutes <= 5);
  const isVeryUrgent =
    remaining &&
    remaining.days === 0 &&
    remaining.hours === 0 &&
    remaining.minutes === 0 &&
    remaining.seconds <= 30;
  const badge = getStatusBadge(auction.status);

  //?…?†?·?‚ ?§?„???…?????² 

  const endTime = new Date(auction.endTime).getTime();
  const createdAt = auction.createdAt ? new Date(auction.createdAt).getTime() : 0;
  const minutesLeft = (endTime - now) / 60000;
  const isEndingSoon = minutesLeft > 0 && minutesLeft <= 10;
  const isNew = createdAt > 0 && now - createdAt < 24 * 60 * 60 * 1000;
  const HOT_BIDS_THRESHOLD = 5;
  const isHot = (auction.bidsCount ?? 0) >= HOT_BIDS_THRESHOLD;

  //HotAucations 

  const AuctionBadge = ({ type }: { type: "hot" | "ending" | "new" }) => {
    const styles = {
      hot: "bg-red-500 text-white",
      ending: "bg-amber-500 text-white",
      new: "bg-emerald-500 text-white",
    };

    const labels = {
      hot: "ساخن",
      ending: "ينتهي قريبًا",
      new: "جديد",
    };

    return (
      <span
        className={`px-3 py-1 text-[11px] font-black tracking-wide rounded-full shadow-sm backdrop-blur-md border border-white/20 ${styles[type]}`}
      >
        {labels[type]}
      </span>
    );
  };



  return (
    <div
      className={`bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] transition-all duration-500 overflow-hidden border-2 border-slate-100 hover:border-primary/20 flex flex-col h-full group hover:-translate-y-1.5 ${archived ? "opacity-75" : "cursor-pointer"}`}
      dir="rtl"
      role={archived ? undefined : "button"}
      tabIndex={archived ? -1 : 0}
      onClick={() => {
        if (!archived) navigate(`/auction/${auction._id}`);
      }}
      onKeyDown={(e) => {
        if (archived) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/auction/${auction._id}`);
        }
      }}
    >

      <div className={`relative bg-slate-100 group overflow-hidden ${compact ? "h-36" : "h-48"}`}>
        <img
          src={getImageUrl(auction.images?.[0])}
          alt={auction.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        {/* Overlay gradient for bottom text readability */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none w-full z-0 text-center flex flex-col justify-end pb-2">
          <div className={`text-[11px] font-black text-white w-full ${getStatusColor()} bg-opacity-90 py-1.5`}>
            {getStatusLabel()}
          </div>
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          {isHot && <AuctionBadge type="hot" />}
          {!isHot && isEndingSoon && <AuctionBadge type="ending" />}
          {!isHot && !isEndingSoon && isNew && <AuctionBadge type="new" />}
        </div>
        {/* ?…?¤?´?± ?¹?¯?¯ ?§?„?µ?ˆ?± */}
        {auction.images?.length > 1 && (
          <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md text-white text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-white/10 font-medium z-10">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{auction.images?.length}</span>
          </div>
        )}

        <div className="absolute top-12 left-3 bg-black/40 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md font-bold border border-white/10 z-10">
          {auction.category}
        </div>
      </div>

      {badge && (
        <div className={`px-5 ${compact ? "mt-3" : "mt-4"}`}>
          <span
            className={`inline-block px-3 py-1 text-[11px] font-bold rounded-full border ${badge.className.includes("bg-green") ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              badge.className.includes("bg-red") ? "bg-rose-50 text-rose-700 border-rose-200" :
                "bg-amber-50 text-amber-700 border-amber-200"
              }`}
          >
            {badge.text}
          </span>
        </div>
      )}{auction.endTime && (
        <div className="mt-1 px-4">

        </div>
      )}
      <div className={`flex-grow flex flex-col ${compact ? "p-3" : "p-4"}`}>
        <h3 className={`font-bold text-slate-900 line-clamp-1 transition-colors group-hover:text-primary ${compact ? "text-sm mb-0.5" : "text-base mb-1"}`}>{auction.title}</h3>
        {!compact && auction.owner && (
          <div className="flex flex-col items-start mb-2">

            {/* ?§?³?… ?§?„?…?³???®?¯?… (?±?§?¨?·) */}
            <Link
              to={`/users/${typeof auction.owner === "string"
                ? auction.owner
                : auction.owner._id
                }`}
              className="text-primary font-bold hover:underline text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {typeof auction.owner === "string"
                ? "صاحب المزاد"
                : auction.owner.name}
            </Link>

            {/* ?§?„???‚?????… ???­?? ?§?„?§?³?… ?…?¨?§?´?±?© */}
            {rating && rating.count > 0 && (
              <div className="flex items-center gap-1.5 mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                <RatingStars value={rating.average} />
                <span className="text-xs font-bold text-amber-700">
                  {rating.average}
                </span>
              </div>
            )}
          </div>
        )}

        {!compact && (
          <p className="text-slate-500 text-sm line-clamp-2 mb-3 flex-grow font-medium leading-relaxed">{auction.description}</p>
        )}

        <div className={`mt-auto bg-slate-50/80 rounded-2xl border border-slate-100 ${compact ? "p-3 mt-3" : "p-4"}`}>
          <div className="flex flex-col gap-3">
            {/* Price Row */}
            <div className="flex justify-between items-end pb-3 border-b border-slate-200/60">
              <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold flex flex-col gap-1">
                <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-primary" /> السعر الحالي</span>
              </span>
              <span className="font-black text-emerald-600 text-lg sm:text-xl tracking-tight leading-none bg-emerald-50 px-3 py-1.5 rounded-xl text-right inline-block whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                {Number(auction.currentPrice || 0).toLocaleString()} <span className="text-[10px] text-emerald-600/70">د.ع</span>
              </span>
            </div>

            {/* Time / Progress Row */}
            <div>
              {/* Progress bar */}
              {!compact && !isEnded && !isScheduled && (
                <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${progress}%`,
                      backgroundColor:
                        progress > 90
                          ? "#f43f5e" // rose-500
                          : progress > 70
                            ? "#f59e0b" // amber-500
                            : "#10b981", // emerald-500
                    }}
                  />
                </div>
              )}

              <div className="flex justify-between items-center text-sm gap-2 mt-1">
                <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400 flex items-center gap-1.5">
                  <Clock className={`w-3.5 h-3.5 ${isScheduled ? "text-blue-500" : "text-rose-500"}`} />
                  {isScheduled ? "يبدأ بعد" : "الوقت المتبقي"}
                </span>

                {remaining && (
                  <div className="flex items-center justify-end">
                    <div
                      className={`flex items-baseline justify-center gap-[2px] px-2 py-1 rounded-lg border font-black tabular-nums transition-all duration-300
                        ${isVeryUrgent
                          ? "bg-red-50 text-red-700 border-red-200 animate-[pulse_1s_infinite]"
                          : isUrgent
                            ? "bg-rose-50/50 text-rose-600 border-rose-100"
                            : "bg-white text-slate-700 border-slate-200 shadow-sm"
                        }`}
                      style={{ fontSize: compact ? '11px' : '12px' }}
                    >
                      {remaining.days > 0 && (
                        <>
                          <span>{remaining.days}</span>
                          <span className="text-[9px] text-slate-400 mr-0.5 ml-1">ي</span>
                        </>
                      )}

                      <span>{remaining.hours.toString().padStart(2, "0")}</span>
                      <span className="text-[9px] opacity-70 mr-[1px] ml-[2px]">:</span>

                      <span>{remaining.minutes.toString().padStart(2, "0")}</span>
                      <span className="text-[9px] opacity-70 mr-[1px] ml-[2px]">:</span>

                      <span className={isUrgent ? "text-red-600" : "text-slate-500"}>{remaining.seconds.toString().padStart(2, "0")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {archived && (
          <div className="mt-5 block w-full text-center bg-slate-100 text-slate-500 py-3 rounded-xl text-[11px] uppercase tracking-widest font-black cursor-not-allowed border border-slate-200">
            مزاد مؤرشف
          </div>
        )}
      </div>
    </div>
  );
};

export default AuctionCard;
