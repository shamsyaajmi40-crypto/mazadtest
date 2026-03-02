import { Link } from "react-router-dom";
import Countdown from "./Countdown";
import { getImageUrl } from "@/utils/getImageUrl";
import React from "react";
import type { Auction } from "../types";

const AuctionSidebarCard: React.FC<{ auction: Auction }> = ({ auction }) => {
  return (
    <Link
      to={`/auction/${auction._id}`}
      className="block group outline-none"
    >
      <div className="bg-surface border border-slate-200/60 p-2 rounded-2xl flex items-center gap-3 hover:shadow-lg hover:shadow-slate-200/50 hover:border-primary/20 transition-all duration-300 transform group-hover:-translate-y-0.5 overflow-hidden relative">
        {/* الصورة */}
        <div className="relative flex-shrink-0">
          <img
            src={getImageUrl(auction.images?.[0])}
            alt={auction.title}
            className="w-[84px] h-[84px] rounded-xl object-cover bg-slate-100 shadow-inner group-hover:scale-105 transition-transform duration-500"
          />

          {/* عدّاد (يظهر فقط للقريب) */}
          {auction.endTime && (
            <div className="absolute -bottom-1 inset-x-0 mx-auto w-11/12 bg-white/90 backdrop-blur text-center py-0.5 rounded shadow-sm text-[10px] font-bold text-rose-600 border border-white/50">
              <Countdown
                endTime={auction.endTime}
                showBeforeMinutes={60}
              />
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div className="flex flex-col justify-center flex-grow min-w-0 pr-1 py-1">
          <h3 className="text-sm font-black text-slate-800 line-clamp-2 leading-snug group-hover:text-primary transition-colors mb-2">
            {auction.title}
          </h3>

          <div className="flex flex-col gap-0.5 mt-auto">
            <span className="text-[10px] font-bold text-slate-500">
              السعر الحالي
            </span>
            <span className="font-extrabold text-emerald-600 text-sm tracking-tight leading-none">
              {(auction.currentPrice || 0).toLocaleString()} <span className="text-[9px] text-emerald-600/70">د.ع</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default AuctionSidebarCard;
