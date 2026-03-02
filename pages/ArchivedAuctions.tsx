import { useEffect, useState, useContext, useMemo } from "react";
import api from "../services/api";
import { Auction } from "../types";
import ArchivedAuctionCard from "../components/ArchivedAuctionCard";
import { AuthContext } from "../context/AuthContext";

/* ================= Types ================= */

type ArchiveFilter = "all" | "sold" | "won" | "participated";

/* ================= Component ================= */

const ArchivedAuctions = () => {
  const { user } = useContext(AuthContext);

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<ArchiveFilter>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchArchived = async (pageNum: number, append: boolean = false) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const res = await api.get("/auctions/archived/my", {
        params: { page: pageNum, limit: 12 }
      });

      const newAuctions = res.data.auctions || [];
      const pagination = res.data.pagination;

      if (append) {
        setAuctions(prev => [...prev, ...newAuctions]);
      } else {
        setAuctions(newAuctions);
      }

      setHasMore(pagination.page < pagination.totalPages);
      setPage(pagination.page);
    } catch (err) {
      console.error("Failed to load archived auctions", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchArchived(1);
  }, []);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchArchived(page + 1, true);
    }
  };

  /* ================= Filtering ================= */

  const filteredAuctions = useMemo(() => {
    return auctions.filter((auction) => {
      const ownerId = typeof auction.owner === "string" ? auction.owner : auction.owner?._id;
      const winnerId = typeof auction.winner === "string" ? auction.winner : auction.winner?._id;
      const isOwner = ownerId === user?._id;
      const isWinner = winnerId === user?._id;
      const status = String(auction.status);

      switch (filter) {
        case "sold":
          return isOwner && status === "completed";
        case "won":
          return isWinner && status === "completed";
        case "participated":
          return !isOwner && !isWinner;
        default:
          return true;
      }
    });
  }, [auctions, filter, user?._id]);

  /* ================= Render ================= */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        <span className="ml-3 text-slate-600 font-bold">جارٍ التحميل...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white/70 backdrop-blur-xl rounded-[2rem] border border-slate-200/60 shadow-sm">
      <h1 className="text-2xl font-black text-slate-900 mb-4">أرشيف المزادات</h1>

      {/* ===== Filters ===== */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1 rounded-full text-sm transition ${filter === "all" ? "bg-primary-600 text-white" : "bg-white/70 border border-slate-200/60 text-slate-700 hover:bg-white/90"}`}
        >
          الكل
        </button>
        <button
          onClick={() => setFilter("sold")}
          className={`px-4 py-1 rounded-full text-sm transition ${filter === "sold" ? "bg-primary-600 text-white" : "bg-white/70 border border-slate-200/60 text-slate-700 hover:bg-white/90"}`}
        >
          بعتها
        </button>
        <button
          onClick={() => setFilter("won")}
          className={`px-4 py-1 rounded-full text-sm transition ${filter === "won" ? "bg-primary-600 text-white" : "bg-white/70 border border-slate-200/60 text-slate-700 hover:bg-white/90"}`}
        >
          ربحتها
        </button>
        <button
          onClick={() => setFilter("participated")}
          className={`px-4 py-1 rounded-full text-sm transition ${filter === "participated" ? "bg-primary-600 text-white" : "bg-white/70 border border-slate-200/60 text-slate-700 hover:bg-white/90"}`}
        >
          شاركت بها
        </button>
      </div>

      {/* ===== List ===== */}
      {filteredAuctions.length === 0 ? (
        <div className="text-center py-10 text-slate-500 bg-white/70 backdrop-blur-xl rounded-[1.5rem] border border-slate-200/60">
          لا توجد مزادات مطابقة
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAuctions.map((auction) => (
              // @ts-ignore
              <ArchivedAuctionCard key={auction._id} auction={auction} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جارٍ التحميل...
                  </>
                ) : (
                  "عرض المزيد من المزادات"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArchivedAuctions;
