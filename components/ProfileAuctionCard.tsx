import React from "react";
import { Auction } from "../types";
import { getImageUrl } from "../utils/getImageUrl";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Tag, Clock, Gavel, Trophy, Package, ChevronRight } from "lucide-react";

interface Props {
  auction: Auction;
}

const getStatusBadge = (status: string) => {
  const s = String(status).toUpperCase();
  switch (s) {
    case "ACTIVE":
      return { text: "مباشر", className: "bg-emerald-50 text-emerald-700 border-emerald-100" };
    case "ENDED":
    case "COMPLETED":
      return { text: "منتهي", className: "bg-slate-50 text-slate-700 border-slate-100" };
    case "PENDING":
      return { text: "قيد المراجعة", className: "bg-amber-50 text-amber-700 border-amber-100" };
    case "REJECTED":
      return { text: "مرفوض", className: "bg-rose-50 text-rose-700 border-rose-100" };
    default:
      return { text: status, className: "bg-slate-50 text-slate-600 border-slate-100" };
  }
};

const ProfileAuctionCard: React.FC<Props> = ({ auction }) => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const badge = getStatusBadge(auction.status);
  const now = new Date().getTime();
  const endTime = new Date(auction.endTime).getTime();
  const isEnded = auction.status === "ENDED" || auction.status === "completed" || now > endTime;

  return (
    <div
      onClick={() => navigate(`/auction/${auction._id}`)}
      className="group flex flex-col sm:flex-row gap-4 bg-white rounded-2xl p-4 border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all duration-300 cursor-pointer relative overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="w-full sm:w-24 h-32 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 group-hover:border-primary/20 transition-colors">
        <img
          src={getImageUrl(auction.images?.[0])}
          alt={auction.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>

      {/* Info Content */}
      <div className="flex-1 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${badge.className}`}>
              {badge.text}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-lg">
              {auction.category}
            </span>
          </div>
          <h3 className="font-black text-slate-800 group-hover:text-primary transition-colors line-clamp-1 mb-1">
            {auction.title}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2">
          {/* Price */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 rounded-lg">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">السعر الحالي</span>
              <span className="text-sm font-black text-emerald-600 tabular-nums">
                {Number(auction.currentPrice || 0).toLocaleString()} <span className="text-[10px]">د.ع</span>
              </span>
            </div>
          </div>

          {/* Time or Bids */}
          {!isEnded ? (
             <div className="flex items-center gap-2">
             <div className="p-1.5 bg-rose-50 rounded-lg">
               <Clock className="w-3.5 h-3.5 text-rose-600" />
             </div>
             <div className="flex flex-col">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">المتبقي</span>
               <span className="text-sm font-black text-slate-700 tabular-nums">
                 {/* Simplified time display for brevity */}
                 انتهى في {new Date(auction.endTime).toLocaleDateString("ar-IQ")}
               </span>
             </div>
           </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-100 rounded-lg">
                <Gavel className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">المزايدات</span>
                <span className="text-sm font-black text-slate-700 tabular-nums">
                  {auction.bidsCount || 0} مزايدة
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decorative arrow on hover (Desktop) */}
      <div className="hidden sm:flex items-center justify-center w-10 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
        <ChevronRight className="w-5 h-5 text-primary" />
      </div>
    </div>
  );
};

export default ProfileAuctionCard;
