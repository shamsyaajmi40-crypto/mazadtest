import React, { useEffect, useState, useContext, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Auction, Bid } from "../types";
import { getAuctionDetails } from "../services/auction";
import { AuthContext } from "../context/AuthContext";
import { Loader2, FileText, X, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { useSocket } from "../context/SocketContext";
import api from "../services/api";

// Sub-components
import RelatedAuctions from '../components/RelatedAuctions';
import { approveAuction, rejectAuction } from "../services/admin";
import AuctionImages from "../components/Auction/AuctionImages";
import AuctionBiddingPanel from "../components/Auction/AuctionBiddingPanel";
import AuctionDeliveryPanel from "../components/Auction/AuctionDeliveryPanel";
import AuctionRatingSection from "../components/Auction/AuctionRatingSection";

const AuctionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useContext(AuthContext);
  const { socket, isConnected: globalSocketConnected } = useSocket();

  // Core State
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI State
  const [ratings, setRatings] = useState<any[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [sellerRating, setSellerRating] = useState<any>(null);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [courierErr, setCourierErr] = useState<string | null>(null);
  const [courierLoading, setCourierLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [courierCompanies, setCourierCompanies] = useState<any[]>([]);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([]);
  const [rejectionNote, setRejectionNote] = useState("");

  const auctionRef = useRef(auction);
  useEffect(() => { auctionRef.current = auction; }, [auction]);

  // Data Fetching
  const refreshAuction = async () => {
    if (!id) return;
    try {
      const res = await getAuctionDetails(id);
      if (res?.data) {
        setAuction(res.data.auction);
        setBids(res.data.bids);
      }
    } catch (e: any) {
      if (e?.response?.status === 404) navigate("/");
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    refreshAuction().finally(() => setLoading(false));
    refreshUser?.();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setRatingsLoading(true);
    api.get(`/ratings/auction/${id}`).then(res => setRatings(res.data)).finally(() => setRatingsLoading(false));
  }, [id]);

  useEffect(() => {
    if (!auction?._id) return;
    api.get(`/ratings/check/${auction._id}`).then(res => setAlreadyRated(res.data.rated)).catch(() => setAlreadyRated(false));
    
    if (auction.owner) {
      const sId = typeof auction.owner === 'string' ? auction.owner : auction.owner._id;
      api.get(`/ratings/user/${sId}/summary`).then(res => setSellerRating(res.data)).catch(() => {});
    }
  }, [auction?._id, auction?.owner]);

  // Polling fallback if socket disconnected
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      if (!globalSocketConnected) refreshAuction();
    }, 15000);
    return () => clearInterval(interval);
  }, [id, globalSocketConnected]);

  // Handlers
  const handleApprove = async () => {
    if (!id || adminActionLoading) return;
    if (!window.confirm("هل أنت متأكد من الموافقة على الخبر ونشره؟")) return;
    try {
      setAdminActionLoading(true);
      await approveAuction(id);
      toast.success("تمت الموافقة بنجاح");
      refreshAuction();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "فشل القبول");
    } finally {
      setAdminActionLoading(false);
    }
  };

  const loadCourierCompanies = async () => {
    try {
      if (!auction || !auction.owner || !auction.winner) return;
      const sellerGov = (auction.owner as any).governorate || "";
      const winnerGov = (auction.winner as any).governorate || "";
      const res = await api.get("/courier/companies/available", { params: { from: sellerGov, to: winnerGov } });
      setCourierCompanies(res.data || []);
    } catch (e: any) {
      setCourierErr("فشل جلب شركات التوصيل");
    }
  };

  if (loading || !auction) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>;
  }

  // Layout Constants
  const now = Date.now();
  const startTime = new Date(auction.startTime || auction.createdAt).getTime();
  const endTime = new Date(auction.endTime).getTime();
  const normalizedStatus = String(auction.status || "").toLowerCase();
  
  const isPending = normalizedStatus === "pending";
  const isRejected = normalizedStatus === "rejected";
  const isActive = now >= startTime && now < endTime && normalizedStatus === "active";
  const isDealSuccess = normalizedStatus === "completed";
  const isDealFailed = ["cancelled_by_winner", "cancelled_by_seller", "cancelled_by_both"].includes(normalizedStatus) || auction.deliveryOrder?.status === "DELIVERY_FAILED";
  const isDealResolved = isDealSuccess || isDealFailed;
  const isEnded = (now >= endTime || normalizedStatus === "ended" || isDealResolved) && !isPending && !isRejected;

  const isWinner = String(auction.winner?._id || auction.winner) === String(user?._id);
  const isOwner = String(auction.owner?._id || auction.owner) === String(user?._id);
  const isMeWinner = isWinner;
  const isAdmin = user?.role === "admin" || user?.role === "superAdmin";

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-20 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        
        {/* Header Section */}
        <div className="mb-8 md:mb-12">
           <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="px-5 py-2 text-sm font-black tracking-wide rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-sm flex items-center gap-2">
              <FileText className="w-4 h-4" /> تفاصيل المزاد #{auction._id.slice(-6).toUpperCase()}
            </span>
            {auction.isFeatured && (
              <span className="px-5 py-2 text-sm font-black tracking-wide rounded-2xl bg-yellow-50 text-yellow-700 border border-yellow-200/60 shadow-sm flex items-center gap-2">
                ⭐ مزاد مميز
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-[1.15] mb-4 tracking-tight">
            {auction.title}
          </h1>
        </div>

        {/* Info Grid */}
        <div id="auction-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
          
          {/* Left: Images & Info */}
          <div className="lg:col-span-7 space-y-6">
            <AuctionImages auction={auction} />
            
            <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-white shadow-sm">
              <h2 className="text-xl sm:text-2xl font-black mb-6 flex items-center gap-3 text-slate-800">
                الوصف
              </h2>
              <p className="text-slate-600 leading-relaxed font-semibold text-base sm:text-lg whitespace-pre-wrap">
                {auction.description}
              </p>
            </div>
          </div>

          {/* Right: Bidding & Actions */}
          <div className="lg:col-span-5 space-y-6">
            <AuctionBiddingPanel 
              auction={auction}
              bids={bids}
              user={user}
              socket={socket}
              isConnected={globalSocketConnected}
              isAdmin={isAdmin}
              refreshAuction={refreshAuction}
              setAuction={setAuction}
              setBids={setBids}
              refreshUser={refreshUser as any}
              playSound={() => {}}
              triggerHaptic={() => {}}
              isMuted={false}
              toggleMute={() => {}}
              viewersCount={5}
              handleApprove={handleApprove}
              setRejectModalOpen={setRejectModalOpen}
              adminActionLoading={adminActionLoading}
            />

            {(isEnded || isDealResolved) && (
              <AuctionDeliveryPanel 
                auction={auction}
                user={user}
                isAdmin={isAdmin}
                isOwner={isOwner}
                isWinner={isWinner}
                isMeWinner={isMeWinner}
                isDealResolved={isDealResolved}
                isDealFailed={isDealFailed}
                setShowCourierModal={setShowCourierModal}
                setCourierErr={setCourierErr}
                loadCourierCompanies={loadCourierCompanies}
                normalizedStatus={normalizedStatus}
              />
            )}
          </div>
        </div>

        {/* Rating Section */}
        <AuctionRatingSection 
          auction={auction}
          user={user}
          alreadyRated={alreadyRated}
          setAlreadyRated={setAlreadyRated}
          ratings={ratings}
          ratingsLoading={ratingsLoading}
          sellerRating={sellerRating}
        />

        {/* Related Auctions */}
        <div className="mt-20">
          <RelatedAuctions currentAuctionId={auction._id} categoryId={auction.category?._id || auction.category} />
        </div>
      </div>

      {/* Courier Modal */}
      {showCourierModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-[2.5rem] bg-white p-8 shadow-2xl relative overflow-hidden border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div className="text-xl font-black text-slate-800 flex items-center gap-2">اختيار شركة التوصيل</div>
              <button onClick={() => setShowCourierModal(false)} className="bg-slate-100 p-2 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            {courierErr && <div className="mb-4 text-rose-500 font-bold">{courierErr}</div>}
            <div className="space-y-4">
              <select 
                value={selectedCompanyId} 
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full p-4 rounded-2xl border-2 border-slate-200 font-bold"
              >
                <option value="">اختر شركة...</option>
                {courierCompanies.map(c => (
                  <option key={c._id} value={c._id}>{c.name} - {Number(c.deliveryFee || 0).toLocaleString()} د.ع</option>
                ))}
              </select>
              <button 
                onClick={async () => {
                  setCourierLoading(true);
                  try {
                    await api.post(`/courier/orders/${auction._id}/create`, { companyId: selectedCompanyId });
                    setShowCourierModal(false);
                    refreshAuction();
                  } catch (e) {
                    setCourierErr("فشل إنشاء الطلب");
                  } finally {
                    setCourierLoading(false);
                  }
                }}
                disabled={!selectedCompanyId || courierLoading}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black disabled:opacity-50"
              >
                تأكيد الطلب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuctionDetails;
