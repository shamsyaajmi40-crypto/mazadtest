import React, { useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import { Auction } from "../../types";
import { RATING_REASONS } from "../../utils/ratingReasons";
import { rateAuctionUser } from "../../services/rating";
import RatingStars from "../RatingStars";
import { Link } from "react-router-dom";
import maskUsername from "../../utils/maskUsername";

interface AuctionRatingSectionProps {
  auction: Auction;
  user: any;
  alreadyRated: boolean;
  setAlreadyRated: (val: boolean) => void;
  ratings: any[];
  ratingsLoading: boolean;
  sellerRating: any;
}

const AuctionRatingSection: React.FC<AuctionRatingSectionProps> = ({
  auction,
  user,
  alreadyRated,
  setAlreadyRated,
  ratings,
  ratingsLoading,
  sellerRating
}) => {
  const [score, setScore] = useState<number>(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);

  const isWinner = String(auction.winner?._id || auction.winner) === String(user?._id);
  const role = isWinner ? "buyer_to_seller" : "seller_to_buyer";

  const submitRating = async () => {
    if (ratingLoading) return;
    try {
      setRatingLoading(true);
      await rateAuctionUser({
        auctionId: auction._id,
        score,
        reasons,
        comment,
      });
      setAlreadyRated(true);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Rating failed");
    } finally {
      setRatingLoading(false);
    }
  };

  const ratingReasonMap: Record<string, string> = {};
  Object.values(RATING_REASONS).forEach((group) => {
    [...group.positive, ...group.negative].forEach((r) => {
      ratingReasonMap[r.key.toLowerCase()] = r.label;
    });
  });

  const normalizedStatus = String(auction.status || "").toLowerCase();
  const isDealResolved = ["completed", "cancelled_by_winner", "cancelled_by_seller", "cancelled_by_both"].includes(normalizedStatus) || auction.deliveryOrder?.status === "DELIVERY_FAILED";

  const averageRating = ratings.length > 0
    ? (ratings.reduce((acc, r) => acc + r.score, 0) / ratings.length).toFixed(1)
    : null;

  return (
    <div className="mt-12 space-y-12">
      {!alreadyRated && (
        <div id="rating-section" className="bg-white/70 backdrop-blur-md p-8 rounded-[2.5rem] border border-slate-200/50 shadow-xl shadow-slate-200/30 scroll-mt-32">
          <div className="flex items-center gap-3 mb-8">
            <span className="p-3 bg-gradient-to-br from-yellow-100 to-amber-50 rounded-2xl text-amber-500 shadow-sm border border-yellow-200/50">
              <Star className="w-6 h-6 fill-current" />
            </span>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">قيّم الصفقة</h3>
          </div>

          <div className="space-y-8">
            {/* Stars */}
            <div>
              <p className="text-sm font-bold text-slate-500 mb-3">حدد التقييم (من 1 إلى 5)</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setScore(n)}
                    className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-300 transform hover:-translate-y-1 ${score === n
                      ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-amber-500/30 border-none scale-105"
                      : score >= n
                        ? "bg-yellow-50 text-amber-400 border border-yellow-200 hover:bg-yellow-100"
                        : "bg-slate-50 text-slate-300 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Reasons */}
            <div>
              <p className="text-sm font-bold text-slate-500 mb-3">ما هي أبرز الأسباب؟</p>
              <div className="flex flex-wrap gap-2.5">
                {(() => {
                  const group = RATING_REASONS[role];
                  let available: { key: string; label: string }[] = [];
                  if (score >= 4) available = group.positive;
                  else if (score <= 2) available = group.negative;
                  else available = [...group.positive, ...group.negative];

                  return available.map((r) => {
                    const isChecked = reasons.includes(r.key);
                    return (
                      <label
                        key={r.key}
                        className={`cursor-pointer select-none px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 border ${isChecked
                          ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/20"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setReasons((prev) => [...prev, r.key]);
                            else setReasons((prev) => prev.filter((x) => x !== r.key));
                          }}
                        />
                        {r.label}
                      </label>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Comment */}
            <div className={`transition-all duration-500 overflow-hidden ${score <= 2 || comment ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
              <p className="text-sm font-bold text-slate-500 mb-2">تعليق إضافي {(score <= 2) && <span className="text-rose-500 text-xs bg-rose-50 px-2 py-0.5 rounded-md ml-2">مطلوب</span>}</p>
              <textarea
                className="w-full border-2 border-slate-200 bg-white p-4 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none text-sm font-medium h-28"
                placeholder="اكتب تعليقك هنا لمعرفة سبب تجربتك..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button
                disabled={
                  ratingLoading || score < 1 || reasons.length === 0 || (score <= 2 && comment.trim().length < 5)
                }
                onClick={submitRating}
                className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-primary to-primary-light text-white font-black rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ratingLoading ? "جارٍ الإرسال..." : "تأكيد وإرسال التقييم"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDealResolved && (
        <div className="bg-surface p-8 rounded-[2.5rem] border border-slate-200/60 shadow-md shadow-slate-200/30">
          <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-400" /> التقييمات
          </h3>

          {ratingsLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin"></div>
            </div>
          ) : ratings.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <div className="text-slate-400 mb-2"><MessageSquare className="w-8 h-8 mx-auto opacity-50" /></div>
              <h4 className="font-bold text-slate-600">لا توجد تقييمات</h4>
              <p className="text-xs text-slate-400 mt-1">لم يقم أحد بتقييم هذه الصفقة حتى الآن.</p>
            </div>
          ) : (
            <>
              {averageRating && (
                <div className="flex items-center gap-4 mb-8 bg-amber-50/50 p-4 rounded-2xl w-fit border border-amber-100/50">
                  <div className="flex gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-6 h-6 ${i < Math.round(Number(averageRating)) ? "fill-current" : "fill-slate-200 text-slate-200"}`} />
                    ))}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-3xl text-slate-800 tracking-tight">{averageRating}</span>
                    <span className="text-slate-500 text-sm font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">{ratings.length} تقييم</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100/60">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center font-black text-slate-500 shrink-0">
                      {(auction.owner?.name?.[0] || 'ب').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 mb-1">صاحب المزاد</p>
                      <Link to={`/users/${typeof auction.owner === 'object' ? (auction.owner as any)._id : auction.owner}`} className="text-slate-800 font-bold hover:text-primary transition-colors hover:underline block mb-1">
                        {auction.owner?.name || 'مستخدم غير معروف'}
                      </Link>
                      {sellerRating && sellerRating.count > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 w-fit shadow-sm">
                          <RatingStars value={sellerRating.average} />
                          <span className="text-[11px] font-black text-slate-700">{Number(sellerRating.average).toFixed(1)}</span>
                          <span className="text-[10px] text-slate-400 font-medium">({sellerRating.count})</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {ratings.map((r) => (
                  <div key={r._id} className="bg-white border border-slate-100 rounded-[1.5rem] p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-500 uppercase">
                          {(r.fromUser?.name || "U")[0]}
                        </div>
                        <div>
                          <div className="font-black text-slate-800 flex items-center gap-2">
                            {r.fromUser?.name || "مستخدم"}
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${r.role === "buyer_to_seller" ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-purple-50 text-purple-600 border border-purple-100"}`}>
                              {r.role === "buyer_to_seller" ? "مشتري" : "بائع"}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">إلى: {r.toUser?.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < r.score ? "fill-current" : "fill-slate-200 text-slate-200"}`} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-slate-600 text-sm font-medium mb-4 pr-1">"{r.comment}"</p>}
                    {r.reasons?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {r.reasons.map((rs: string, i: number) => (
                          <span key={i} className="px-3 py-1 text-[11px] font-bold rounded-lg border bg-slate-50 text-slate-600 border-slate-200">
                            {ratingReasonMap[rs.toLowerCase()] || rs}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AuctionRatingSection;
