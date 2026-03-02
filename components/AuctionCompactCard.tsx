import { Link } from "react-router-dom";
import Countdown from "./Countdown";
import { getImageUrl } from "@/utils/getImageUrl";
import type { Auction } from "../types";

const AuctionCompactCard = ({ auction }: { auction: Auction }) => {
  return (
    <Link
      to={`/auction/${auction._id}`}
      className="block bg-white border rounded-lg p-3 hover:shadow-sm transition"
    >
      <div className="flex items-center gap-3">
        {/* صورة صغيرة */}
        <img
          src={getImageUrl(auction.images?.[0])}
          alt={auction.title}
          className="w-14 h-14 rounded-md object-cover"
        />

        {/* المحتوى */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 truncate">
            {auction.title}
          </h3>

          <div className="text-xs text-slate-500 mt-0.5">
            السعر الحالي:
            <span className="font-bold text-slate-700 ml-1">
              {(auction.currentPrice ?? 0).toLocaleString()}
            </span>
          </div>

          {/* عدّاد (يظهر فقط للقريب) */}
          {auction.endTime && (
            <Countdown endTime={auction.endTime} showBeforeMinutes={60} />
          )}
        </div>
      </div>
    </Link>
  );
};

export default AuctionCompactCard;
