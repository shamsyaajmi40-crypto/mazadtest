import { Auction } from "../types";
import { getImageUrl } from "../utils/getImageUrl";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { canUserRate } from "../utils/canUserRate";

/* ================= Utils ================= */

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return { text: "مكتمل", className: "bg-green-100 text-green-800" };

    case "ENDED":
      return { text: "منتهي", className: "bg-gray-100 text-gray-800" };

    case "rejected":
      return { text: "مرفوض", className: "bg-red-100 text-red-800" };

    case "cancelled_by_winner":
    case "cancelled_by_seller":
    case "cancelled_by_both":
      return { text: "ملغي", className: "bg-red-100 text-red-800" };

    default:
      return {
        text: status || "غير معروف",
        className: "bg-yellow-100 text-yellow-800",
      };
  }
};

/* ================= Component ================= */

interface Props {
  auction: Auction;
}

const ArchivedAuctionCard = ({ auction }: Props) => {
  const { user } = useContext(AuthContext);

  const ownerId =
    typeof auction.owner === "string"
      ? auction.owner
      : auction.owner?._id;

  const winnerId =
    typeof auction.winner === "string"
      ? auction.winner
      : auction.winner?._id;

  const isOwner = user && ownerId && String(ownerId) === String(user._id);
  const isWinner = user && winnerId && String(winnerId) === String(user._id);

  const otherUser =
    isOwner
      ? auction.winner
      : isWinner
        ? auction.owner
        : null;

  const otherUserId =
    typeof otherUser === "string"
      ? otherUser
      : otherUser?._id;

  const otherUserName =
    typeof otherUser === "object" ? otherUser?.name : null;

  const normalizedStatus = String(auction.status);
  const badge = getStatusBadge(normalizedStatus);

  const isDealSuccess = normalizedStatus === "completed";
  const isDealFailed = [
    "rejected",
    "cancelled_by_winner",
    "cancelled_by_seller",
    "cancelled_by_both",
  ].includes(normalizedStatus);
  const isEnded = isDealSuccess || isDealFailed || normalizedStatus === "ENDED";

  const canRate = canUserRate(auction, user?._id);

  let alreadyRated = false;
  if (canRate && auction.ratings) {
    alreadyRated = auction.ratings.some(
      (r) => String(r.from) === String(user?._id)
    );
  }

  return (
    <Link
      to={`/auction/${auction._id}${canRate && !alreadyRated ? "#rating-section" : ""}`}
      className="flex gap-4 bg-white rounded-xl p-4 border hover:border-primary/30 hover:shadow-md transition group block relative overflow-hidden"
    >
      {canRate && !alreadyRated && (
        <div className="absolute top-2 left-2 z-20">
          <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[10px] font-black px-2.5 py-1 rounded-xl shadow-lg shadow-amber-500/30 flex items-center gap-1 hover:scale-105 transition-transform animate-pulse">
            <Star className="w-3 h-3 fill-white" />
            بانتظار تقييمك
          </div>
        </div>
      )}
      {/* Decorative gradient on hover */}
      <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-primary to-primary-dark opacity-0 group-hover:opacity-100 transition-opacity"></div>

      {/* صورة */}
      {auction.images?.[0] && (
        <img
          src={getImageUrl(auction.images[0])}
          loading="lazy"
          alt={auction.title}
          className="w-20 h-20 object-cover rounded-lg shrink-0 border border-slate-100 group-hover:border-primary/20 transition-colors"
        />
      )}

      {/* المحتوى */}
      <div className="flex-1">
        <h3 className="font-bold text-sm mb-1 text-slate-900 group-hover:text-primary transition-colors">{auction.title}</h3>

        <p className="text-xs font-bold mb-1 text-slate-700">
          {normalizedStatus === "completed" &&
            isOwner &&
            otherUserId &&
            otherUserName && (
              <>
                🟦 بعت هذا المزاد إلى{" "}
                <Link
                  to={`/users/${otherUserId}`}
                  className="text-blue-600 hover:underline relative z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {otherUserName}
                </Link>
              </>
            )}

          {normalizedStatus === "completed" &&
            isWinner &&
            otherUserId &&
            otherUserName && (
              <>
                🟢 ربحت هذا المزاد من{" "}
                <Link
                  to={`/users/${otherUserId}`}
                  className="text-blue-600 hover:underline relative z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {otherUserName}
                </Link>
              </>
            )}

          {normalizedStatus !== "completed" && !isOwner && !isWinner && (
            <>⚪ شاركت ولم تفز</>
          )}
        </p>

        <p className="text-xs text-gray-600 mb-1">
          السعر النهائي:{" "}
          <span className="font-black text-slate-800">
            {auction.currentPrice?.toLocaleString()} د.ع
          </span>
        </p>

        <p className="text-xs text-gray-400 font-medium">
          انتهى في:{" "}
          {new Date(auction.updatedAt).toLocaleDateString()}
        </p>
      </div>

      {/* الحالة */}
      <div className="flex items-start">
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full whitespace-nowrap ${badge.className}`}
        >
          {badge.text}
        </span>
      </div>
    </Link>
  );
};

export default ArchivedAuctionCard;
