import React, { useEffect, useState, useContext, useRef } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { Auction, Bid, } from "../types";
import { getAuctionDetails, placeBid, featureAuction } from "../services/auction";
import { AuthContext } from "../context/AuthContext";
import {
  ArrowRight, Loader2, Gavel, FileText, AlertTriangle, History, Clock, ChevronLeft,
  ChevronRight, Image, Star, Check, MessageSquare, Package, X, ChevronDown, Eye,
  Volume2, VolumeX, XCircle, CheckCircle, Settings, MapPin
} from "lucide-react";
import toast from "react-hot-toast";


import { getImageUrl } from "@/utils/getImageUrl";
import maskUsername from "@/utils/maskUsername.ts";
import { RATING_REASONS } from "../utils/ratingReasons";
import { rateAuctionUser, getAuctionRatings } from "../services/rating";
import { getRemainingTime } from "../utils/helpers";
import api from "../services/api";
import { io, Socket } from "socket.io-client";

import TermsModal from "../components/TermsModal";
import { useSocket } from "../context/SocketContext";
import { canUserRate } from "../utils/canUserRate";

import RelatedAuctions from '../components/RelatedAuctions';
import confetti from "canvas-confetti";
import { approveAuction, rejectAuction } from "../services/admin";

const RatingStars = ({ value }: { value: number }) => {
  const clampedValue = Math.max(0, Math.min(5, value));
  return (
    <div className="flex items-center gap-0.5" dir="rtl">
      {[1, 2, 3, 4, 5].map((index) => {
        const fillPercentage = Math.max(0, Math.min(1, clampedValue - (index - 1))) * 100;
        return (
          <div key={index} className="relative w-[14px] h-[14px]">
            <svg className="absolute inset-0 text-slate-200" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            {fillPercentage > 0 && (
              <svg
                className="absolute inset-0 text-amber-400"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ clipPath: `polygon(100% 0, ${100 - fillPercentage}% 0, ${100 - fillPercentage}% 100%, 100% 100%)` }}
              >
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
};

const deliveryFailureReasonLabel: Record<string, string> = {
  BUYER_NO_SHOW: "المشتري غير متواجد",
  BUYER_REFUSED: "المشتري رفض الاستلام",
  BUYER_DID_NOT_RECEIVE: "المشتري لم يستلم البضاعة",
  BUYER_UNREACHABLE: "المشتري لا يرد",
  WRONG_ADDRESS: "عنوان غير صحيح/غير واضح",
  SELLER_NO_SHOW: "البائع غير متواجد",
  SELLER_NOT_READY: "البائع غير جاهز",
  COURIER_ISSUE: "مشكلة لوجستية",
};

const AuctionDetails = () => {

  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useContext(AuthContext);
  const [score, setScore] = useState<number>(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratings, setRatings] = useState<any[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidLoading, setBidLoading] = useState(false);
  const [optimisticBid, setOptimisticBid] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // التمرير مباشرة إلى واجهة المزايدة بدلاً من أعلى الصفحة إذا تم تحميل المزاد
    if (!loading) {
      setTimeout(() => {
        const grid = document.getElementById("auction-grid");
        if (grid) {
          const y = grid.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top: y, behavior: 'smooth' });
        } else {
          window.scrollTo(0, 0);
        }
      }, 400); // زيادة الوقت لضمان بناء الواجهة وعناصر الـ DOM
    }

    if (location.hash === "#rating-section" && !loading) {
      setTimeout(() => {
        const el = document.getElementById("rating-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 500);
    }
  }, [id, location.hash, loading]);

  const [timeLeft, setTimeLeft] = useState("");
  const timeRef = React.useRef<HTMLSpanElement | null>(null);
  const [sellerRating, setSellerRating] = useState<{
    average: number;
    count: number;
  } | null>(null);
  const [bidCooldown, setBidCooldown] = useState<number>(0);
  const { socket, isConnected: globalSocketConnected } = useSocket();
  const optimisticBidRef = useRef<number | null>(null);
  const auctionRef = useRef<Auction | null>(null);
  const [courierCompanies, setCourierCompanies] = useState<{ _id: string; name: string; phone?: string; deliveryFee?: number; coverage?: any[]; branches?: { governorate: string; name: string; address: string }[] }[]>([]);
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState("");
  const [courierNotes, setCourierNotes] = useState("");
  const [courierLoading, setCourierLoading] = useState(false);
  const [courierErr, setCourierErr] = useState<string | null>(null);

  // شروط المزايدة
  const [showBidTermsModal, setShowBidTermsModal] = useState(false);

  // تمييز المزاد
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [featureDuration, setFeatureDuration] = useState('1d');
  const [featureLoading, setFeatureLoading] = useState(false);
  const [featureErr, setFeatureErr] = useState<string | null>(null);

  const handleFeatureAuctionAction = async () => {
    if (!id || featureLoading) return;
    setFeatureLoading(true);
    setFeatureErr(null);
    try {
      await featureAuction(id, featureDuration);
      toast.success("تم تمييز المزاد بنجاح!");
      setShowFeatureModal(false);
      refreshAuction();
      refreshUser?.(); // To update wallet balance if present
    } catch (e: any) {
      setFeatureErr(e?.response?.data?.message || "فشل عملية الدفع والتمييز");
    } finally {
      setFeatureLoading(false);
    }
  };
  // نظام النزاع (Dispute)
  const [disputeReasonText, setDisputeReasonText] = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeSuccessMessage, setDisputeSuccessMessage] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [priceFlash, setPriceFlash] = useState(false);
  const [isHotAuction, setIsHotAuction] = useState(false);
  const lastBidTimesRef = useRef<number[]>([]);
  const hasCelebratedRef = useRef(false);
  const [viewersCount, setViewersCount] = useState(() => Math.floor(Math.random() * 8) + 3);

  // --- Admin Review Actions ---
  const isAdmin = user?.role === "admin" || user?.role === "superAdmin";
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([]);
  const [rejectionNote, setRejectionNote] = useState("");

  const handleApprove = async () => {
    if (!id || adminActionLoading) return;
    if (!window.confirm("هل أنت متأكد من الموافقة على هذا المزاد ونشره؟")) return;

    try {
      setAdminActionLoading(true);
      await approveAuction(id);
      toast.success("تمت الموافقة على المزاد بنجاح");
      // تحديث حالة المزاد محلياً أو إعادة التحميل
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "فشل قبول المزاد");
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id || adminActionLoading) return;
    if (rejectionReasons.length === 0 && !rejectionNote.trim()) {
      toast.error("يرجى اختيار سبب واحد على الأقل للرفض");
      return;
    }

    try {
      setAdminActionLoading(true);
      await rejectAuction(id, {
        rejectionReasons,
        rejectionNote,
      });
      toast.success("تم رفض المزاد وإعادة العربون للبائع");
      setRejectModalOpen(false);
      // توجيه للخلف أو تحديث
      navigate("/admin/dashboard");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "فشل رفض المزاد");
    } finally {
      setAdminActionLoading(false);
    }
  };
  const loadCourierCompanies = async () => {
    try {
      if (!auction || !auction.owner || !auction.winner) return;

      const sellerGov = typeof auction.owner === 'object' ? (auction.owner as any).governorate : '';
      const winnerGov = typeof auction.winner === 'object' ? (auction.winner as any).governorate : '';

      const res = await api.get("/courier/companies/available", {
        params: {
          from: sellerGov,
          to: winnerGov
        }
      });
      setCourierCompanies(res.data || []);
    } catch (e: any) {
      setCourierErr(e?.response?.data?.message || "فشل جلب شركات التوصيل المتاحة لمحافظتك");
    }
  };
  useEffect(() => {
    optimisticBidRef.current = optimisticBid;
  }, [optimisticBid]);

  useEffect(() => {
    auctionRef.current = auction;
  }, [auction]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const bidsRef = useRef(bids);
  useEffect(() => {
    bidsRef.current = bids;
  }, [bids]);
  // حالة عرض الصورة النشطة
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  useEffect(() => {
    if (!auction?.images?.length) {
      setActiveImageIndex(0);
      return;
    }
    setActiveImageIndex((prev) => Math.min(prev, auction.images.length - 1));
  }, [auction?.images?.length]);

  // مكون لعرض نجوم التقييم
  // The RatingStars component is now defined at the top of the file.

  //دالة ويب سوكيت 
  const applyAuctionUpdate = (data: {
    auction: Auction;
    bids: Bid[];
  }) => {
    setAuction((prev) => {
      if (!prev) return data.auction;

      // 🔒 إذا في مزايدة optimistic لا نلمس السعر
      if (optimisticBid !== null) {
        return {
          ...prev,

          endTime: data.auction.endTime,
        };
      }

      return data.auction;
    });

    setBids(data.bids);
  };

  // تحديث بيانات المزاد
  const refreshAuction = async () => {
    if (!id) return;
    try {
      const res = await getAuctionDetails(id);
      if (!res?.data) return;
      applyAuctionUpdate(res.data);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        navigate("/");
      } else {
        console.error("Auction refresh poll failed", e);
      }
    }
  };
  useEffect(() => {
    if (!id) return;

    setRatingsLoading(true);

    getAuctionRatings(id)
      .then(res => setRatings(res.data))
      .finally(() => setRatingsLoading(false));
  }, [id]);

  useEffect(() => {
    if (!auction?._id) return;

    api
      .get(`/ratings/check/${auction._id}`)
      .then((res) => {
        setAlreadyRated(res.data.rated);
      })
      .catch(() => {
        setAlreadyRated(false);
      });
  }, [auction?._id]);

  useEffect(() => {
    if (!id) return;

    // تحميل أولي
    refreshUser().catch(() => { });
    refreshAuction().finally(() => setLoading(false));

    // ⏱️ عدّاد الوقت (لا نلمسه أبداً)
    const timer = setInterval(() => {
      const a = auctionRef.current;
      if (!a || !timeRef.current) return;

      const now = Date.now();

      const start = a.startTime
        ? new Date(a.startTime).getTime()
        : new Date(a.createdAt).getTime();

      const end = new Date(a.endTime).getTime();

      let targetTime: number;
      let label: string;

      // ✅ الحالة 1 — لم يبدأ بعد
      if (now < start) {
        targetTime = start;
        label = "upcoming";
      }
      // ✅ الحالة 2 — المزاد جارٍ
      else if (now >= start && now < end) {
        targetTime = end;
        label = "active";
      }
      // ✅ الحالة 3 — انتهى
      else {
        timeRef.current.textContent = "منتهي";
        if (!hasPlayedGavelRef.current) {
          playSound('gavel');
          hasPlayedGavelRef.current = true;

          // الاحتفال بالفائز
          const isWinner = auctionRef.current?.winner && user && String((auctionRef.current.winner as any)._id || auctionRef.current.winner) === String(user._id);
          if (isWinner && !hasCelebratedRef.current) {
            hasCelebratedRef.current = true;
            playSound('winner');
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#10b981', '#3b82f6', '#f59e0b', '#ffffff']
            });
          }
        }
        return;
      }

      const diff = targetTime - now;

      if (diff <= 0) {
        timeRef.current.textContent =
          label === "upcoming" ? "بدأ الآن" : "منتهي";
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      // 🔊 Countdown Sounds
      if (label === "active") {
        if (diff <= 10000 && diff > 0) {
          playSound('tick');
        }
      }

      timeRef.current.textContent = `${h}س ${m}د ${s}ث`;
    }, 1000);


    // 🔁 polling (نوقفه فقط أثناء المزايدة)
    let interval: NodeJS.Timeout | null = null;

    if (optimisticBid === null) {
      const POLL_INTERVAL = globalSocketConnected ? 30000 : 15000;

      interval = setInterval(refreshAuction, POLL_INTERVAL);
    }

    return () => {
      if (interval) clearInterval(interval);
      clearInterval(timer);
    };
  }, [id, optimisticBid, globalSocketConnected]);

  useEffect(() => {
    if (!auction?.owner) return;

    const sellerId =
      typeof auction.owner === "string"
        ? auction.owner
        : auction.owner._id;

    if (!sellerId) return;

    api
      .get(`/ratings/user/${sellerId}/summary`)
      .then((res) => {
        if (res.data && res.data.count > 0) {
          setSellerRating(res.data);
        }
      })
      .catch(() => { });
  }, [auction?.owner]);

  //bidCooldown
  useEffect(() => {
    if (bidCooldown <= 0) return;

    const t = setInterval(() => {
      setBidCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(t);
  }, [bidCooldown]);
  useEffect(() => {
    if (bidCooldown === 0) {
      setError(""); // ✅ امسح رسالة الانتظار تلقائيًا
    }
  }, [bidCooldown]);
  //handlePlaceBid
  const handlePlaceBid = async () => {

    if (!user) {
      alert("يجب تسجيل الدخول للمزايدة");
      return;
    }

    if (!auction || bidLoading) return;

    // ⛔ لا تسمح أثناء العداد
    if (bidCooldown > 0) {
      setError(`انتظر ${bidCooldown} ثانية ثم أعد المحاولة`);
      return;
    }

    // ⛔ تحقق من الرصيد محلياً قبل إظهار نافذة الشروط
    try {
      await refreshUser();
    } catch (e) {
      console.error("Failed to refresh user before bid:", e);
    }

    // ⛔ تحقق من الرصيد فقط إذا كان المستخدم يزايد للمرة الأولى في هذا المزاد
    // إذا سبق له المزايدة فعربونه محجوز مسبقاً ولا حاجة لرصيد إضافي
    const hasAlreadyBid = bids.some(
      (b) => b.bidder && String((b.bidder as any)?._id || b.bidder) === String(user?._id)
    );

    if (!hasAlreadyBid && (user?.balance || 0) < (auction.depositAmount || 0)) {
      setError(`رصيدك غير كافٍ. يتطلب المزاد عربوناً بقيمة ${(auction.depositAmount || 0).toLocaleString()} د.ع.`);
      return;
    }

    // Always require terms confirmation before the first bid in this auction.
    if (!hasAlreadyBid) {
      setShowBidTermsModal(true);
      return;
    }

    await executeBid(true);
  };

  const executeBid = async (termsAccepted = false) => {
    if (!auction || bidLoading) return;

    const hasAlreadyBid = bids.some(
      (b) => b.bidder && String((b.bidder as any)?._id || b.bidder) === String(user?._id)
    );

    // Server also enforces this, but keep UX guard here.
    if (!hasAlreadyBid && !termsAccepted) {
      setShowBidTermsModal(true);
      return;
    }

    const basePrice =
      optimisticBid !== null ? optimisticBid : auction.currentPrice;

    const nextBid = basePrice + auction.increment;

    // Optimistic update
    setOptimisticBid(nextBid);
    setBidLoading(true);
    setError("");
    playSound('bid'); // التغذية السمعية الفورية
    triggerHaptic(50); // اهتزاز خفيف للضغطة

    try {
      const optimisticBidEntry: Bid = {
        _id: "optimistic",
        amount: nextBid,
        bidder: user._id,
        createdAt: new Date().toISOString(),
      };

      setBids((prev) => [optimisticBidEntry, ...prev]);

      await placeBid(auction._id, nextBid, hasAlreadyBid ? true : termsAccepted);
      playSound('success');
      await refreshAuction();
    } catch (err: any) {
      setOptimisticBid(null);

      const status = err?.response?.status;
      if (status === 429) {
        const retryAfter =
          err?.response?.data?.retryAfter ??
          Number(err?.response?.headers?.["retry-after"]) ??
          5;

        setBidCooldown(Number(retryAfter));
        setError(`يرجى الانتظار ${Number(retryAfter)} ثانية ثم أعد المحاولة`);

        return;
      }

      setError(err?.response?.data?.message || "فشلت المزايدة");
    } finally {
      setBidLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!id || !disputeReasonText.trim()) return;
    setDisputeLoading(true);
    setDisputeSuccessMessage("");
    setError("");

    try {
      const res = await api.post(`/auctions/${id}/dispute`, { reason: disputeReasonText });
      setDisputeSuccessMessage(res.data.message || "تم إرسال الاعتراض بنجاح.");
      setDisputeReasonText("");
      refreshAuction(); // تحديث المزاد لإظهار حالة isDisputed
    } catch (err: any) {
      setError(err?.response?.data?.message || "فشل إرسال الاعتراض");
    } finally {
      setDisputeLoading(false);
    }
  };
  useEffect(() => {
    if (
      optimisticBid !== null &&
      auction &&
      auction.currentPrice >= optimisticBid
    ) {
      setOptimisticBid(null);
    }
  }, [auction?.currentPrice, optimisticBid]);

  useEffect(() => {
    if (!auction) return;
    const now = Date.now();
    const start = new Date(auction.startTime || auction.createdAt).getTime();
    const end = new Date(auction.endTime).getTime();
    if (now < start || now >= end) return;
    const t = setInterval(() => {
      setViewersCount(prev => Math.max(2, Math.min(prev + (Math.random() > 0.4 ? 1 : -1), 30)));
    }, 7000);
    return () => clearInterval(t);
  }, [auction?._id]);


  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // نوقف polling فورًا
        setOptimisticBid((prev) => prev);
      }

      if (document.visibilityState === "visible") {
        // نحدّث المزاد فور العودة
        refreshAuction();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);


  // --- نظام الأصوات ---
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem("mazad_muted") === "true");
  const soundsRef = useRef<{ [key: string]: HTMLAudioElement }>({});
  const hasPlayedGavelRef = useRef(false);

  useEffect(() => {
    soundsRef.current = {
      bid: new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"), // Click
      outbid: new Audio("https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3"), // Alert/Buzzer
      success: new Audio("https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3"), // Chime
      tick: new Audio("https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3"), // Tick
      gavel: new Audio("https://assets.mixkit.co/active_storage/sfx/967/967-preview.mp3"), // Strike
      winner: new Audio("https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3"), // Fanfare
      fire: new Audio("https://assets.mixkit.co/active_storage/sfx/1483/1483-preview.mp3"), // Sizzle
      competition: new Audio("https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3"), // Light Ping
    };
    (Object.values(soundsRef.current) as HTMLAudioElement[]).forEach(s => { s.load(); s.volume = 0.5; });
  }, []);

  const playSound = (type: 'bid' | 'outbid' | 'success' | 'tick' | 'gavel' | 'winner' | 'fire' | 'competition') => {
    if (isMuted) return;
    const s = soundsRef.current[type];
    if (s) { s.currentTime = 0; s.play().catch(() => { }); }
  };

  const triggerHaptic = (pattern: number | number[] = 50) => {
    if (window.navigator?.vibrate) {
      window.navigator.vibrate(pattern);
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem("mazad_muted", String(next));
      return next;
    });
  };
  //ويب سوكيت
  useEffect(() => {
    if (!id || !socket || !globalSocketConnected) return;

    console.log("🟢 Joining auction room:", id);
    socket.emit("auction:join", id);

    return () => {
      console.log("🟡 Leaving auction room:", id);
      socket.emit("auction:leave", id);
    };
  }, [id, socket, globalSocketConnected]);

  //Listener ويب سوكيت
  useEffect(() => {
    if (!socket || !globalSocketConnected) return;

    const handleBidNew = (data: { auction: Auction; bids?: Bid[] }) => {
      // إذا الباكند ما بعث bids، خذ auction فقط وخلِّ polling/refresh يجيب bids
      if (!data?.bids) {
        setAuction((prev) => {
          if (!prev) return data.auction;
          if (optimisticBidRef.current !== null) return { ...prev, endTime: data.auction.endTime };
          return data.auction;
        });
        return;
      }

      // تحديد إذا تم تجاوز المستخدم (Outbid)
      const getSafeId = (val: any) => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        const id = val._id || val.id;
        if (id) return String(id);
        if (val.toString && val.toString() !== "[object Object]") return val.toString();
        return null;
      };

      const myId = getSafeId(userRef.current);
      const currentHighestId = getSafeId(data.bids?.[0]?.bidder);
      const prevWinnerId = getSafeId(auctionRef.current?.winner);
      const prevTopBidderId = bidsRef.current.length > 0 ? getSafeId(bidsRef.current[0].bidder) : null;

      const isMeNow = !!(myId && currentHighestId && String(myId) === String(currentHighestId));
      const wasMePrev = !!(myId && (String(prevWinnerId) === String(myId) || String(prevTopBidderId) === String(myId)));

      console.log("Audio Debug:", { myId, currentHighestId, prevWinnerId, wasMePrev, isMeNow });

      if (wasMePrev && !isMeNow) {
        // شخص آخر سحب منك الصدارة
        playSound('outbid');
        triggerHaptic([60, 40, 60]);
      } else if (isMeNow) {
        // المزايدة لي (ربما من نافذة أخرى)
        // إذا لم تكن المزايدة من هذه النافذة تحديداً (optimistic)
        if (optimisticBidRef.current === null) {
          playSound('success');
        }
      } else {
        // مزايدة بين طرفين غريبين أو أول مزايدة في المزاد
        playSound('competition');
      }

      // حساب الـ Hot Auction (3 مزايدات في 10 ثواني)
      const nowTs = Date.now();
      lastBidTimesRef.current = [...lastBidTimesRef.current.filter(ts => nowTs - ts < 10000), nowTs];
      if (lastBidTimesRef.current.length >= 3 && !isHotAuction) {
        setIsHotAuction(true);
        playSound('fire');
        setTimeout(() => setIsHotAuction(false), 12000); // يستمر 12 ثانية
      }

      applyAuctionUpdate(data as any);

      // Flash the price
      setPriceFlash(true);
      setTimeout(() => setPriceFlash(false), 900);

      // Toast for bids from others
      if (optimisticBidRef.current === null && data.auction?.currentPrice) {
        toast(`⚡ ${data.auction.currentPrice.toLocaleString()} د.ع`, {
          duration: 3000,
          style: { fontWeight: 'bold', direction: 'rtl' },
        });
      }

      // ⏱️ Extension toast — shows when anti-sniping logic kicks in
      if ((data as any).extensionApplied) {
        const secs = (data as any).extensionSeconds ?? 60;
        toast(`⏱️ تم تمديد وقت المزاد بـ ${secs} ثانية بسبب مزايدة في اللحظات الأخيرة!`, {
          duration: 5000,
          icon: '🔔',
          style: {
            fontWeight: 'bold',
            direction: 'rtl',
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #f59e0b',
          },
        });
      }
    };

    socket.on("bid:new", handleBidNew);

    return () => {
      socket.off("bid:new", handleBidNew);
    };
  }, [socket, globalSocketConnected]);
  if (loading || !auction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-10 h-10 text-primary" />
      </div>
    );
  }


  const isMeWinner =
    auction.winner &&
    user &&
    String(auction.winner._id || auction.winner) === String(user._id);
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
  const isDealResolved = isDealSuccess || isDealFailed;
  const isEnded = (now >= endTime || normalizedStatus === "ended" || isDealResolved) && !isPending && !isRejected;

  // إنشاء خريطة للأسباب لسهولة الوصول إليها
  const ratingReasonMap: Record<string, string> = {};

  Object.values(RATING_REASONS).forEach((group: any) => {
    if (group.positive) {
      group.positive.forEach((r: any) => {
        ratingReasonMap[r.key.toLowerCase()] = r.label;
      });
    }
    if (group.negative) {
      group.negative.forEach((r: any) => {
        ratingReasonMap[r.key.toLowerCase()] = r.label;
      });
    }
  });

  const isWinner =
    String(auction.winner?._id || auction.winner) ===
    String(user?._id);

  const isOwner =
    String(auction.owner?._id || auction.owner) ===
    String(user?._id);
  const hasWinner = !!auction.winner;

  // 🔑 Fault-based rating permissions (mirrors backend canUserRate logic)
  const SELLER_FAULT_REASONS = ["SELLER_NO_SHOW", "SELLER_NOT_READY"];
  const BUYER_FAULT_REASONS = ["BUYER_NO_SHOW", "BUYER_REFUSED", "BUYER_DID_NOT_RECEIVE", "BUYER_UNREACHABLE", "WRONG_ADDRESS"];
  const failureReason = auction.deliveryPenaltyReason || (auction.deliveryOrder as any)?.failureReason || "";

  const canRate = canUserRate(auction, user?._id);

  const role = isWinner
    ? "buyer_to_seller"
    : "seller_to_buyer";

  const submitRating = async () => {
    if (ratingLoading) return; // 🔒 قفل فوري

    try {
      setRatingLoading(true);

      await rateAuctionUser({
        auctionId: auction._id,
        score,
        reasons,
        comment,
      });

      setAlreadyRated(true);
      alert("تم إرسال التقييم بنجاح");
    } catch (err: any) {
      alert(err?.response?.data?.message || "Rating failed");
    } finally {
      setRatingLoading(false);
    }
  };
  // تحديد الأنماط للأسباب الإيجابية والسلبية
  const positiveReasons = new Set([
    "good_communication",
    "fast_payment",
    "accurate_description",
    "commitment",
    "quick_response",
  ]);

  const negativeReasons = new Set([
    "late_payment",
    "no_response",
    "bad_behavior",
    "item_not_as_described",
    "delay_delivery",
  ]);

  const getReasonStyle = (key: string) => {
    const k = key.toLowerCase();

    if (positiveReasons.has(k)) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (negativeReasons.has(k)) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }

    return "bg-slate-100 text-slate-700 border-slate-200";
  };
  const averageRating =
    ratings.length > 0
      ? (
        ratings.reduce(
          (sum, r) => sum + (r.score || 0),
          0
        ) / ratings.length
      ).toFixed(1)
      : null;

  let targetTime = auction.endTime;

  if (auction.status === "upcoming" && auction.startTime) {
    targetTime = auction.startTime;
  }

  const diff =
    new Date(targetTime).getTime() - Date.now();


  const isLastMinutes =
    diff > 0 && diff <= 5 * 60 * 1000;

  const isExtensionWindow =
    diff > 0 && diff <= 60 * 1000; // Max extension window is 60s

  // ✅ منع المتصدر من المزايدة فوق مزايدته
  const isCurrentLeader = !!(user && auction?.winner &&
    String(auction.winner?._id || auction.winner) === String(user._id));
  const displayedPrice =
    optimisticBid !== null
      ? optimisticBid
      : auction.currentPrice;

  const sortedBids = [...bids].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );

  const uniqueBidsMap = new Map<
    string,
    { bid: any; count: number }
  >();
  const normalizeId = (value: any): string => {
    if (!value) return "";

    // ObjectId أو Object فيه _id
    if (typeof value === "object") {
      if (value._id) return String(value._id);
      if (value.id) return String(value.id);
    }

    // string
    return String(value);
  };
  bids.forEach((bid) => {
    const bidderId = normalizeId(bid.bidder);

    const existing = uniqueBidsMap.get(bidderId);

    if (!existing) {
      // أول مزايدة لهذا المزايد
      uniqueBidsMap.set(bidderId, {
        bid,
        count: 1,
      });
    } else {
      // زيادة عدد المزايدات
      existing.count += 1;

      // الاحتفاظ بأعلى مزايدة فقط
      if (bid.amount > existing.bid.amount) {
        existing.bid = bid;
      }
    }
  });

  const uniqueBids = Array.from(
    uniqueBidsMap.entries()
  )
    .map(([bidderId, data]) => ({
      bidderId,
      bid: data.bid,
      count: data.count,
    }))
    .sort((a, b) => b.bid.amount - a.bid.amount);



  const getUserId = (u: any): string => {
    if (!u) return "";
    return String(u._id ?? u.id ?? "");
  };

  const totalImages = auction.images?.length || 0;
  const hasImages = totalImages > 0;
  const nextImage = () =>
    setActiveImageIndex((idx) => (idx < totalImages - 1 ? idx + 1 : 0));
  const prevImage = () =>
    setActiveImageIndex((idx) => (idx > 0 ? idx - 1 : totalImages - 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndXRef.current = e.changedTouches[0]?.clientX ?? null;
    const startX = touchStartXRef.current;
    const endX = touchEndXRef.current;
    if (startX == null || endX == null || totalImages <= 1) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX < 0) nextImage();
    else prevImage();
  };


  /// Recent Feed (آخر 5 مزايدات)

  // 🚚 حسابات التوصيل المطلوبة لنظام الاعتراض
  const deliveryReason = auction.deliveryOrder?.failureReason || auction.deliveryPenaltyReason || "";
  const sellerReasons = ["SELLER_NO_SHOW", "SELLER_NOT_READY"];
  const buyerReasons = ["BUYER_NO_SHOW", "BUYER_REFUSED", "BUYER_DID_NOT_RECEIVE", "BUYER_UNREACHABLE", "WRONG_ADDRESS"];
  const isSellerFault = sellerReasons.includes(deliveryReason);
  const isBuyerFault = buyerReasons.includes(deliveryReason);
  const isSeller = isOwner; // توحيد المتغيرات لتجنب الأخطاء

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50 relative overflow-hidden pb-12" dir="rtl">
      {/* Glow Effects in Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[-10%] w-[30%] h-[30%] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-slate-500 hover:text-slate-800 font-bold mb-6 sm:mb-8 transition-colors bg-white/50 backdrop-blur px-4 py-2 rounded-2xl w-fit shadow-sm"
        >
          <ArrowRight className="w-5 h-5 ml-2" />
          العودة
        </button>

        {/* 🔴 الهيدر الرئيسي: العنوان ومعلومات البائع (كامل العرض بالـ Desktop) */}
        <div className="mb-6 sm:mb-8 md:mb-10">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black mb-3 md:mb-5 tracking-tight text-slate-900 leading-[1.3]">
            {auction.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs sm:text-sm text-slate-500 font-medium bg-white/60 px-3 py-1.5 rounded-xl">بواسطة:</span>
            <Link
              to={`/users/${typeof auction.owner === "string" ? auction.owner : auction.owner._id}`}
              className="text-primary hover:text-primary-dark font-black hover:underline px-2 py-1"
            >
              {typeof auction.owner === "string" ? "صاحب المزاد" : auction.owner.name}
            </Link>

            {(() => {
              const displayRating = sellerRating || auction.owner?.rating;
              if (displayRating && displayRating.count > 0) {
                return (
                  <div className="flex items-center gap-1.5 mr-auto sm:mr-4 bg-gradient-to-r from-amber-50 to-yellow-50/50 px-3 py-1.5 rounded-xl border border-amber-200/50 shadow-sm">
                    <RatingStars value={displayRating.average} />
                    <span className="text-sm font-black text-amber-700">{Number(displayRating.average).toFixed(1)}</span>
                    <span className="text-xs font-bold text-amber-600/60">({displayRating.count})</span>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* ⭐ Banner for Featuring Action */}
        {isOwner && (isActive || isUpcoming) && !(auction.isFeatured && new Date(auction.featuredUntil || 0).getTime() > now) && (
          <div className="mb-8 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl p-4 sm:p-6 border border-yellow-200/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">زد فرص بيع مزادك</h3>
                <p className="text-sm font-medium text-slate-600">قم بتمييز المزاد ليظهر لعدد أكبر من المشترين في الصفحة الرئيسية.</p>
              </div>
            </div>
            <button
              onClick={() => setShowFeatureModal(true)}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-l from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-black rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap"
            >
              ميّز المزاد الآن
            </button>
          </div>
        )}

        <div id="auction-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
          {/* القسم الأيمن: الصور والوصف */}
          <div className="lg:col-span-7 space-y-6">
            <div
              className="relative w-full aspect-[4/3] md:aspect-video rounded-3xl overflow-hidden bg-slate-100 shadow-xl group touch-pan-x"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {hasImages ? (
                <img
                  src={getImageUrl(auction.images?.[activeImageIndex] || auction.images?.[0])}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 cursor-zoom-in"
                  alt={auction.title}
                  onClick={() => setLightboxOpen(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Image className="w-10 h-10" />
                    <span className="text-sm font-bold">لا توجد صور</span>
                  </div>
                </div>
              )}

              {totalImages > 1 && (
                <>
                  <div className="absolute top-4 left-4 bg-slate-900/40 text-white text-xs font-black px-3.5 py-1.5 rounded-full backdrop-blur-md shadow-lg">
                    {activeImageIndex + 1} / {totalImages}
                  </div>
                  <button
                    onClick={prevImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/40 hover:bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg transition-all text-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-95 border border-white/40"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/40 hover:bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg transition-all text-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-95 border border-white/40"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>

                  {/* نقط مؤشرات الصور Pagination Dots */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full truncate">
                    {auction.images.map((_, idx) => (
                      <span
                        key={idx}
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeImageIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {totalImages > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x hide-scrollbar">
                {auction.images.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all duration-300 snap-center ${idx === activeImageIndex ? "border-primary shadow-md scale-105 z-10" : "border-slate-200/60 opacity-70 hover:opacity-100"
                      }`}
                  >
                    <img
                      src={getImageUrl(img)}
                      alt={`${auction.title}-${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h2 className="text-xl sm:text-2xl font-black mb-6 flex items-center gap-3 text-slate-800">
                <span className="p-2 sm:p-2.5 bg-gradient-to-br from-primary/10 to-primary/5 text-primary rounded-xl shadow-inner border border-primary/10">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                </span>
                الوصف
              </h2>
              <p className="text-slate-600 leading-relaxed font-semibold text-base sm:text-lg whitespace-pre-wrap">{auction.description}</p>
            </div>
          </div>

          {/* القسم الأيسر: المزايدة والحالة */}
          <div id="bidding-panel" className="lg:col-span-5 relative mt-4 md:mt-0">
            <div className="bg-white/90 backdrop-blur-2xl p-5 sm:p-8 rounded-3xl border border-white shadow-[0_10px_40px_rgb(0,0,0,0.08)] sticky top-24 h-fit flex flex-col z-20">
              {/* ===== PREMIUM ACTION PANEL ===== */}
              <div className="bg-white border border-slate-100 rounded-[2rem] p-5 sm:p-6 shadow-xl shadow-slate-200/30 relative overflow-hidden mb-6">
                {/* LIVE Indicator & Viewers */}
                <div className="flex items-center justify-between mb-5">
                  {isPending ? (
                    <div className="flex items-center gap-2 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">تحت المراجعة</span>
                    </div>
                  ) : isRejected ? (
                    <div className="flex items-center gap-2 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                      <X className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">تم الرفض</span>
                    </div>
                  ) : !isEnded ? (
                    <div className="flex items-center gap-2 bg-red-50 px-3 py-1 rounded-lg border border-red-100/50">
                      <div className="relative flex items-center justify-center w-2 h-2">
                        {isActive && <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping"></span>}
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isActive ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-slate-300'}`}></span>
                      </div>
                      <span className={`text-[10px] font-black tracking-widest uppercase ${isActive ? 'text-red-600' : 'text-slate-400'}`}>
                        {isActive ? "LIVE" : "UPCOMING"}
                      </span>
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

                {/* Price & Time Row */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {/* Price Box (Premium Indigo) */}
                  <div className={`flex flex-col justify-center rounded-2xl p-2.5 sm:p-3.5 relative overflow-hidden transition-all duration-300 ${isHotAuction ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-500/20 shadow-lg shadow-orange-500/10' : 'bg-indigo-50/50 border-indigo-100'} ${priceFlash ? 'bg-indigo-100 border-indigo-300 shadow-inner scale-105' : ''}`}>
                    {(priceFlash || isHotAuction) && <div className={`absolute inset-0 blur-xl ${isHotAuction ? 'bg-orange-400/20' : 'bg-indigo-400/10'}`}></div>}

                    <div className="flex justify-between items-start mb-1 relative z-10">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${isHotAuction ? 'text-orange-700' : 'text-indigo-700/60'}`}>
                          {isEnded ? "السعر النهائي" : "أعلى عرض حالي"}
                        </span>
                        {isHotAuction && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 text-[8px] font-black text-orange-600 rounded-md animate-pulse border border-orange-200">
                            <span>🔥</span>
                            <span>مشتعل!</span>
                          </div>
                        )}
                      </div>
                      {!isEnded && (
                        <span className="text-[9px] font-black bg-white px-1.5 py-0.5 rounded border shadow-sm ${isHotAuction ? 'text-orange-600 border-orange-100' : 'text-indigo-600 border-indigo-100'}">
                          +{auction.increment.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1 relative z-10">
                      <span className={`text-xl sm:text-2xl font-black tracking-tight leading-none whitespace-nowrap ${isHotAuction ? 'text-orange-900' : 'text-indigo-900'}`}>{displayedPrice.toLocaleString()}</span>
                      <span className={`text-[9px] sm:text-[10px] font-bold shrink-0 ${isHotAuction ? 'text-orange-400' : 'text-indigo-400'}`}>د.ع</span>
                    </div>

                    {!isEnded && (
                      <div className={`mt-1 text-[8px] font-bold relative z-10 italic ${isHotAuction ? 'text-orange-500/80' : 'text-indigo-400/70'}`}>الحد الأدنى للمزايدة القادمة</div>
                    )}
                  </div>

                  {/* Time Box (Urgency Red/Orange Gradient) */}
                  {isPending || isRejected ? (
                    <div className={`flex flex-col justify-center rounded-2xl p-2.5 sm:p-3.5 border ${isPending ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                      <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1 ${isPending ? 'text-amber-600' : 'text-rose-600'}`}>حالة المراجعة</span>
                      <span className={`text-xs sm:text-sm font-black ${isPending ? 'text-amber-900' : 'text-rose-900'}`}>
                        {isPending ? "في انتظار الموافقة" : "تم رفض المزاد"}
                      </span>
                    </div>
                  ) : !isDealResolved && auction.status !== "ENDED" ? (
                    <div className={`flex flex-col justify-center rounded-2xl p-2.5 sm:p-3.5 relative overflow-hidden transition-all shadow-sm ${isLastMinutes ? 'bg-gradient-to-br from-orange-500 to-red-600 border-none shadow-orange-500/20' : 'bg-slate-900 border border-slate-800'}`}>
                      <div className="flex justify-between items-start mb-1 relative z-10">
                        <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${isLastMinutes ? 'text-white/80' : 'text-slate-400'}`}>
                          {isLastMinutes ? "فرصة أخيرة!" : "الوقت المتبقي"}
                        </span>
                        {isExtensionWindow && (
                          <span className="text-[8px] font-black bg-white/20 text-white px-1 rounded animate-pulse">
                            تمديد تلقائي 🔄
                          </span>
                        )}
                      </div>

                      <div
                        ref={timeRef}
                        className={`text-[1.1rem] sm:text-[1.25rem] font-black tabular-nums tracking-tight leading-none relative z-10 whitespace-nowrap min-w-0 ${isLastMinutes ? 'text-white drop-shadow-md animate-pulse' : 'text-emerald-400'}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      ></div>

                      {isExtensionWindow && (
                        <div className="mt-1.5 text-[7px] sm:text-[8px] font-bold text-white/90 relative z-10 leading-tight">
                          المزايدة الآن ستمدد الوقت تلقائياً ⏱️
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col justify-center bg-slate-50 border border-slate-100 rounded-2xl p-2.5 sm:p-3.5">
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">حالة المزاد</span>
                      <span className="text-xs sm:text-sm font-black text-slate-700">انتهى الوقت</span>
                    </div>
                  )}
                </div>

                {/* Action Button (The "Winning" Action - High Contrast) */}
                {!isEnded && !isOwner && (
                  <button
                    onClick={handlePlaceBid}
                    disabled={isUpcoming || isPending || isRejected || bidLoading || bidCooldown > 0 || isCurrentLeader}
                    className="w-full py-4 sm:py-5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white rounded-2xl sm:rounded-3xl font-black text-sm sm:text-base flex flex-col items-center justify-center gap-1 sm:gap-1.5
                    shadow-[0_10px_25px_-5px_rgba(16,185,129,0.5)] hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.6)] hover:-translate-y-1 active:translate-y-0.5 active:scale-[0.98] transition-all duration-300
                    disabled:bg-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed border-transparent disabled:border-slate-200 border group relative overflow-hidden"
                  >
                    {/* Glass Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] animate-[shimmer_3s_infinite] group-hover:animate-none group-disabled:hidden"></div>

                    {bidLoading ? (
                      <Loader2 className="animate-spin w-6 h-6 sm:w-7 sm:h-7" />
                    ) : (
                      <>
                        {!isUpcoming && !isPending && !isRejected && !isCurrentLeader && bidCooldown <= 0 && (
                          <span className="text-[10px] sm:text-[11px] font-black opacity-90 uppercase tracking-[0.2em] mb-0.5 group-hover:scale-110 transition-transform">
                            زايد الآن واربح! 🚀
                          </span>
                        )}
                        {isCurrentLeader && (
                          <span className="text-[10px] sm:text-[11px] font-black opacity-90 tracking-widest mb-0.5">
                            أنت في الصدارة! انتظر مزايداً آخر 🏆
                          </span>
                        )}
                        <div className="flex items-center gap-2.5">
                          <Gavel className="w-5 h-5 sm:w-6 sm:h-6 group-hover:rotate-12 transition-transform" />
                          <span className="text-lg sm:text-xl tracking-wide">
                            {isPending
                              ? "في انتظار المراجعة"
                              : isRejected
                                ? "مرفوض"
                                : isUpcoming
                                  ? "لم يبدأ بعد"
                                  : isCurrentLeader
                                    ? "أنت المتصدر 🏆"
                                    : bidCooldown > 0
                                      ? `انتظر ${bidCooldown}ث`
                                      : `${(displayedPrice + auction.increment).toLocaleString()} د.ع`}
                          </span>
                        </div>
                      </>
                    )}
                  </button>
                )}
                {!isEnded && isOwner && (
                  <div className="w-full py-3.5 bg-slate-50 text-slate-500 rounded-2xl font-black text-xs flex items-center justify-center border border-slate-200 shadow-inner">
                    أنت صاحب هذا المزاد
                  </div>
                )}

                {/* Admin Actions Panel (Floating or Static) */}
                {isPending && isAdmin && (
                  <div className="mt-6 p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden group">
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

                {/* Deposit Info Footer - Only show if user hasn't bid or is not logged in */}
                {!isEnded && (!user || !uniqueBids.some(b => b.bidderId === getUserId(user))) && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 mb-0.5">عربون الدخول</span>
                      <span className="text-sm font-black text-slate-700 leading-none">{(auction.depositAmount || 0).toLocaleString()} <span className="text-[9px] text-slate-400">د.ع</span></span>
                    </div>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-bold text-slate-400 mb-0.5">الزيادة الثابتة</span>
                      <span className="text-sm font-black text-slate-700 leading-none">{(auction.increment || 0).toLocaleString()} <span className="text-[9px] text-slate-400">د.ع</span></span>
                    </div>
                  </div>
                )}

                {/* COMPACT BIDS FEED & WINNER */}
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
                      {uniqueBids.slice(0, 5).map((b, idx) => {
                        const isMe = b.bidderId === getUserId(user);
                        const isFirst = idx === 0;
                        return (
                          <div key={b.bidderId} className={`flex items-center justify-between p-3.5 sm:p-4 rounded-[1.25rem] border transition-all duration-300 ${isFirst ? 'bg-gradient-to-r from-amber-50 to-yellow-50/30 border-amber-200/60 shadow-[0_4px_20px_rgb(251,191,36,0.15)] scale-[1.02] origin-right z-10' : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100/80 hover:border-slate-200'}`}>
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
                  </div>
                )}

                {isEnded && auction.winner && !isDealFailed && (
                  <div className="mt-6 border-t border-emerald-100 pt-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏆</span>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black tracking-wider text-emerald-600 uppercase">الفائز بالمزاد</span>
                        <span className="text-lg font-black text-emerald-900">
                          {(isMeWinner || isOwner) ? (isMeWinner ? "أنت الفائز!" : (auction.winner.name || "مستخدم")) : maskUsername(auction.winner.name || "مستخدم")}
                        </span>
                      </div>
                    </div>
                    {isOwner && !isMeWinner && auction.winner.phone && (
                      <div className="pt-3 border-t border-emerald-200/50 flex gap-2">
                        <a href={`https://wa.me/${auction.winner.phone.replace(/^0/, "964")}`} target="_blank" className="flex-1 bg-[#25D366] hover:bg-[#20b358] text-white text-[11px] font-black py-2 rounded-xl text-center transition-colors">💬 واتساب</a>
                        <a href={`tel:${auction.winner.phone}`} className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-black py-2 rounded-xl text-center transition-colors">📞 اتصال</a>
                      </div>
                    )}
                    {isMeWinner && auction.seller?.phone && (
                      <div className="pt-3 border-t border-emerald-200/50">
                        <p className="text-[11px] font-bold text-emerald-800 mb-2">تواصل مع البائع لإتمام الصفقة:</p>
                        <div className="flex gap-2">
                          <a href={`https://wa.me/${auction.seller.phone.replace(/\D/g, "")}`} target="_blank" className="flex-1 bg-[#25D366] hover:bg-[#20b358] text-white text-[11px] font-black py-2 rounded-xl text-center transition-colors">💬 واتساب</a>
                          <a href={`tel:${auction.seller.phone}`} className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-black py-2 rounded-xl text-center transition-colors">📞 اتصال</a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 text-rose-600 bg-rose-50 p-3 rounded-xl flex items-center gap-2 text-sm">

                  <AlertTriangle />
                  {error}
                </div>
              )}

              {normalizedStatus === "ended" && isOwner && auction.winner && auction.deliveryMode !== "courier" && !isDealResolved && (
                <button
                  onClick={() => { setShowCourierModal(true); setCourierErr(null); loadCourierCompanies(); }}
                  className="block w-full text-center mt-3 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-black"
                >
                  طلب توصيل (COD + OTP)
                </button>
              )}

              {/* رسالة للبائع قبل ظهور OTP الدفع */}
              {isOwner &&
                normalizedStatus === "ended" &&
                auction.deliveryMode === "courier" &&
                !auction.payoutOtpCode && !isDealResolved && (
                  <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 flex items-start gap-3">
                    <span className="text-2xl shrink-0 mt-0.5">📦</span>
                    <div>
                      <p className="font-black text-amber-900 text-sm mb-1">الطلب في طريقه إلى المشتري</p>
                      <p className="text-xs text-amber-700 leading-relaxed font-medium">
                        راح يطلعلك بعد ما يستلم االمشتري البضاعة رمز استلام الفلوس من شركة التوصيل، تروح للشركة تستلم فلوسك بالبداية بعدين تنطي الرقم.
                      </p>
                      <div className="mt-2 p-2 bg-rose-50 border border-rose-100 rounded-lg">
                        <p className="text-[11px] text-rose-600 font-black">
                          ⚠️ تحذير: لاتنطي الرقم بدون ماتتاكد من فلوسك، غير هيج المنصة مو مسؤولة.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* ===== Courier OTP (ظهر فقط لصاحبه من الباكند) ===== */}
              {normalizedStatus === "ended" &&
                auction.deliveryMode === "courier" &&
                (isOwner || isWinner) && !isDealResolved && (
                  <div className="mt-4 rounded-2xl overflow-hidden border border-blue-100">
                    {/* Header */}
                    <div className="bg-gradient-to-l from-blue-600 to-indigo-600 px-4 py-3 flex items-center gap-2">
                      <div className="p-1.5 bg-white/20 rounded-lg">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <span className="text-white font-black text-sm">كود التسليم عبر شركة (OTP)</span>
                    </div>

                    {/* OTP codes */}
                    <div className="bg-white p-4 space-y-3">
                      {!isDealResolved && (
                        <>
                          {/* OTP المشتري */}
                          {isWinner && auction.deliveryOtpCode && (
                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                              <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">كود الاستلام — اعطه للمندوب</p>
                              <div className="text-3xl font-black tracking-[0.3em] text-slate-900 select-all text-center py-2 bg-white rounded-lg border border-slate-100">
                                {auction.deliveryOtpCode}
                              </div>
                            </div>
                          )}

                          {/* OTP البائع */}
                          {isOwner && auction.payoutOtpCode && (
                            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                              <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">كود COD — اعطه لموظف الشركة</p>
                              <div className="text-3xl font-black tracking-[0.3em] text-slate-900 select-all text-center py-2 bg-white rounded-lg border border-slate-100">
                                {auction.payoutOtpCode}
                              </div>
                            </div>
                          )}

                          {!auction.deliveryOtpCode && !auction.payoutOtpCode && (
                            <p className="text-sm text-slate-500 text-center py-2">لا يوجد كود متاح حالياً.</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              {auction.deliveryMode === "courier" && auction.deliveryOrder && (
                <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200">
                  {/* Header */}
                  <div className="bg-gradient-to-l from-slate-800 to-slate-700 px-4 py-3 flex items-center gap-2">
                    <div className="p-1.5 bg-white/10 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-white font-black text-sm">حالة التوصيل</span>
                  </div>
                  <div className="bg-white p-4 space-y-2.5">

                    <div className="text-sm font-bold">
                      {(() => {
                        const order = auction.deliveryOrder;
                        const status = order?.status;

                        const reason =
                          order?.failureReason ||
                          auction.deliveryPenaltyReason ||
                          "";

                        const label =
                          deliveryFailureReasonLabel[reason] ||
                          reason ||
                          "سبب الفشل غير محدد";

                        const sellerReasons = ["SELLER_NO_SHOW", "SELLER_NOT_READY"];
                        const buyerReasons = [
                          "BUYER_NO_SHOW",
                          "BUYER_REFUSED",
                          "BUYER_DID_NOT_RECEIVE",
                          "BUYER_UNREACHABLE",
                          "WRONG_ADDRESS",
                        ];

                        const isSellerFault = sellerReasons.includes(reason);
                        const isBuyerFault = buyerReasons.includes(reason);

                        const isSeller =
                          user &&
                          auction.seller &&
                          String(auction.seller._id || auction.seller) === String(user._id);

                        const isWinner =
                          user &&
                          auction.winner &&
                          String(auction.winner._id || auction.winner) === String(user._id);

                        switch (status) {
                          case "READY_FOR_PICKUP":
                            return (
                              <span className="text-blue-600">
                                📦 بانتظار استلام الطلب من البائع
                              </span>
                            );

                          case "PICKED_UP":
                            return (
                              <span className="text-indigo-600">
                                🚚 تم استلام الطلب من البائع
                                {order?.agentUser && " وتحديد مندوب التوصيل"}
                              </span>
                            );

                          case "DELIVERED":
                            return (
                              <span className="text-green-600">
                                ✅ تم تسليم الطلب للمشتري
                              </span>
                            );

                          case "COD_PAID_TO_SELLER":
                            return (
                              <span className="text-emerald-600">
                                💰 تم تسليم المبلغ للبائع — الصفقة مكتملة
                              </span>
                            );

                          case "DELIVERY_FAILED": {
                            // ===== البائع مخطئ =====
                            if (isSellerFault) {
                              if (isSeller) {
                                return (
                                  <span className="text-red-600">
                                    ❌ فشل التوصيل بسببك ({label}) — {auction.penaltyApplied ? "تم تطبيق العقوبة" : "قد يتم تطبيق عقوبة"}
                                  </span>
                                );
                              }

                              if (isWinner) {
                                return (
                                  <span className="text-orange-600">
                                    ⚠️ فشل التوصيل بسبب البائع ({label}) — {auction.penaltyApplied ? "تم إعادة عربونك" : "سيتم إرجاع عربونك"}
                                  </span>
                                );
                              }
                            }

                            // ===== المشتري مخطئ =====
                            if (isBuyerFault) {
                              if (isWinner) {
                                return (
                                  <span className="text-red-600">
                                    ❌ فشل التوصيل بسببك ({label}) — {auction.penaltyApplied ? "تم تطبيق العقوبة" : "قد يتم تطبيق عقوبة"}
                                  </span>
                                );
                              }

                              if (isSeller) {
                                return (
                                  <span className="text-orange-600">
                                    ⚠️ فشل التوصيل بسبب المشتري ({label}) — {auction.penaltyApplied ? "تم إعادة عربونك" : "سيتم إرجاع عربونك"}
                                  </span>
                                );
                              }
                            }

                            // ===== شركة التوصيل =====
                            if (reason === "COURIER_ISSUE") {
                              return (
                                <span className="text-yellow-600">
                                  🚚 مشكلة لوجستية — سيتم إعادة المحاولة بدون عقوبات
                                </span>
                              );
                            }

                            return (
                              <span className="text-red-600">
                                ❌ {label}
                              </span>
                            );
                          }

                          default:
                            return status;
                        }
                      })()}
                    </div>
                    {auction.penaltyApplied && (auction.deliveryOrder?.status === "DELIVERY_FAILED") ? (
                      // ✅ رسالة ما بعد تطبيق العقوبة
                      (() => {
                        const reason = auction.deliveryPenaltyReason || (auction.deliveryOrder as any)?.failureReason || "";
                        const SELLER_FAULTS = ["SELLER_NO_SHOW", "SELLER_NOT_READY"];
                        const BUYER_FAULTS = ["BUYER_NO_SHOW", "BUYER_REFUSED", "BUYER_DID_NOT_RECEIVE", "BUYER_UNREACHABLE", "WRONG_ADDRESS"];
                        const iAmFault = (SELLER_FAULTS.includes(reason) && isSeller) || (BUYER_FAULTS.includes(reason) && isWinner);

                        return iAmFault ? (
                          <div className="mt-3 rounded-xl bg-slate-800 text-white p-4 flex items-start gap-3">
                            <span className="text-2xl shrink-0">📋</span>
                            <div>
                              <p className="font-black text-sm mb-0.5">تم إغلاق هذا المزاد</p>
                              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                تُذكّرك المنصة بأهمية الالتزام بالصفقات بعد الفوز. الانسحاب أو التغيب يضرّ بالثقة ويؤدي إلى عقوبات. نأمل أن تكون التجربة القادمة أفضل.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex items-start gap-3">
                            <span className="text-2xl shrink-0">✅</span>
                            <div>
                              <p className="font-black text-sm text-emerald-800 mb-0.5">تم معالجة الصفقة</p>
                              <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                                تم إغلاق هذا المزاد وإعادة عربونك. شكراً لالتزامك — هذا ما يبني الثقة في المنصة.
                              </p>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="space-y-2">
                        {Number(auction.deliveryOrder.deliveryFee || 0) > 0 && (
                          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                            <span className="text-xs font-bold text-slate-500">🚚 أجرة التوصيل</span>
                            <span className="text-xs font-black text-slate-800">{Number(auction.deliveryOrder.deliveryFee || 0).toLocaleString()} د.ع</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                          <span className="text-xs font-bold text-slate-500">💰 مستحق البائع</span>
                          <span className="text-xs font-black text-slate-800">{Number(auction.currentPrice || 0).toLocaleString()} د.ع</span>
                        </div>
                        <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-3 py-2 border border-emerald-100">
                          <span className="text-xs font-bold text-emerald-700">🧾 إجمالي المشتري</span>
                          <span className="text-xs font-black text-emerald-800">{(Number(auction.currentPrice || 0) + Number(auction.deliveryOrder.deliveryFee || 0)).toLocaleString()} د.ع</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* نظام الاعتراض الذكي (Dispute System) */}
              {auction.deliveryOrder?.status === "DELIVERY_FAILED" && !auction.penaltyApplied && (
                <>
                  {/* 1. للمتهم قبل الاعتراض (إظهار النموذج) */}
                  {!auction.isDisputed && ((isSellerFault && isSeller) || (isBuyerFault && isWinner)) && (
                    <div className="mt-6 rounded-2xl border-2 border-rose-200 bg-rose-50/50 p-5 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-1.5 h-full bg-rose-500"></div>
                      <div className="flex items-start gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-black text-rose-800 text-lg">تنبيه عاجل: فشل التوصيل بسببك</h4>
                          <p className="text-sm text-rose-700 mt-1 font-medium leading-relaxed">
                            أفاد مندوب التوصيل بأن فشل إتمام الصفقة كان بسببك. سيتم مصادرة عربونك وإلغاء المزاد نهائياً خلال 24 ساعة. إذا كان هذا الإدعاء غير صحيح أو حدث خطأ، يرجى تقديم اعتراضك فوراً.
                          </p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-1 border border-rose-100">
                        <textarea
                          value={disputeReasonText}
                          onChange={(e) => setDisputeReasonText(e.target.value)}
                          placeholder="اكتب سبب اعتراضك بوضوح (مثال: المندوب لم يتصل بي، البائع لم يسلم القطعة...)"
                          className="w-full text-sm font-medium p-3 resize-none outline-none bg-transparent min-h-[80px]"
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs font-bold text-rose-500 bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> المهلة: 24 ساعة فقط
                        </span>

                        <button
                          onClick={handleDispute}
                          disabled={disputeLoading || disputeReasonText.trim().length < 5}
                          className="flex-1 sm:flex-none px-6 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                        >
                          {disputeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "تقديم الاعتراض ✋"}
                        </button>
                      </div>

                      {disputeSuccessMessage && (
                        <div className="mt-3 text-sm font-bold text-emerald-600 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                          {disputeSuccessMessage}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. للمتهم بعد الاعتراض (رسالة قيد المراجعة) */}
                  {auction.isDisputed && ((isSellerFault && isSeller) || (isBuyerFault && isWinner)) && (
                    <div className="mt-6 rounded-2xl border bg-amber-50 p-4 flex items-center gap-3">
                      <div className="p-2 bg-amber-100 rounded-xl shrink-0">
                        <FileText className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-black text-amber-800 text-sm">اعتراضك قيد المراجعة</h4>
                        <p className="text-xs text-amber-700 mt-0.5 font-bold">
                          تم إيقاف الغرامة مؤقتاً. الإدارة تقوم حالياً بمراجعة الشكوى مع مندوب التوصيل وسنرسل لك النتيجة قريباً.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              {/* COMPACT BIDS FEED WAS MOVED TO ACTION PANEL */}
            </div>
          </div>
        </div> {/* نهاية الشبكة الثنائية (الصور + صندوق المزايدة) */}

        {canRate && !alreadyRated && (
          <div id="rating-section" className="mt-12 lg:mt-16 bg-white/70 backdrop-blur-md p-8 rounded-[2.5rem] border border-slate-200/50 shadow-xl shadow-slate-200/30 scroll-mt-32">
            <div className="flex items-center gap-3 mb-8">
              <span className="p-3 bg-gradient-to-br from-yellow-100 to-amber-50 rounded-2xl text-amber-500 shadow-sm border border-yellow-200/50">
                <Star className="w-6 h-6 fill-current" />
              </span>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                قيّم الصفقة
              </h3>
            </div>

            <div className="space-y-8">
              {/* النجوم */}
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

              {/* الأسباب */}
              <div>
                <p className="text-sm font-bold text-slate-500 mb-3">ما هي أبرز الأسباب؟</p>
                <div className="flex flex-wrap gap-2.5">
                  {(() => {
                    const group = (RATING_REASONS as any)[role];
                    if (!group) return null;

                    let available: any[] = [];
                    if (score >= 4) available = group.positive || [];
                    else if (score <= 2) available = group.negative || [];
                    else available = [...(group.positive || []), ...(group.negative || [])];

                    return available.map((r: any) => {

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

              {/* التعليق */}
              <div className={`transition-all duration-500 overflow-hidden ${score <= 2 || comment ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                <p className="text-sm font-bold text-slate-500 mb-2">تعليق إضافي {(score <= 2 && reasons.length === 0) && <span className="text-rose-500 text-xs bg-rose-50 px-2 py-0.5 rounded-md ml-2">مطلوب</span>}</p>
                <textarea
                  className="w-full border-2 border-slate-200 bg-white p-4 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none text-sm font-medium h-28"
                  placeholder="اكتب تعليقك هنا لمعرفة سبب تجربتك..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>

              {/* زر الإرسال */}
              <div className="pt-4">
                <button
                  disabled={
                    ratingLoading ||
                    score < 1 ||
                    (reasons.length === 0 && comment.trim().length < 5)
                  }
                  onClick={submitRating}
                  className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-primary to-primary-light text-white font-black rounded-xl hover:shadow-lg hover:shadow-primary/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  {ratingLoading ? "جارٍ الإرسال..." : "تأكيد وإرسال التقييم"}
                </button>
              </div>
            </div>
          </div>
        )}



        {/* ===== الأوسمة السفلية والتقييمات ===== */}
        <div className="mt-12 bg-surface p-8 rounded-[2.5rem] border border-slate-200/60 shadow-md shadow-slate-200/30">

          {/* badges block */}
          <div className={`flex flex-wrap gap-3 ${isEnded ? "mb-8 pb-6 border-b border-slate-100" : ""}`}>
            {/* المزاد جارٍ */}
            {auction.status === "ACTIVE" && (
              <div className="flex items-center gap-4 bg-yellow-50/50 p-2 pl-4 rounded-2xl border border-yellow-100/60 w-full sm:w-auto shadow-sm">
                <span className="flex items-center gap-2 text-sm font-black text-yellow-700">
                  <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                  المزاد جارٍ
                </span>
                <span className="text-sm font-black text-slate-700 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-yellow-100/50 tabular-nums">
                  ⏳ {timeLeft}
                </span>
              </div>
            )}

            {/* تمت الصفقة */}
            {normalizedStatus === "ended" && auction.winner && (
              <span className="px-5 py-2 text-sm font-black tracking-wide rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> المزاد انتهى بانتظار حسم الصفقة
              </span>
            )}

            {isDealSuccess && auction.winner && (
              <span className="px-5 py-2 text-sm font-black tracking-wide rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> تمت الصفقة
              </span>
            )}

            {isDealFailed && auction.winner && (
              <span className="px-5 py-2 text-sm font-black tracking-wide rounded-2xl bg-rose-50 text-rose-700 border border-rose-200/60 shadow-sm flex items-center gap-2">
                <Check className="w-4 h-4" /> فشلت الصفقة
              </span>
            )}

            {/* الفائز */}
            {isEnded && auction.winner && (
              <span className="px-5 py-2 text-sm font-bold rounded-2xl bg-slate-50 text-slate-700 border border-slate-200 shadow-sm">
                الفائز: <span className="font-black text-slate-900">
                  {(isMeWinner || isOwner) ? (isMeWinner ? "أنت الفائز! 👑" : (auction.winner.name || "مستخدم")) : maskUsername(auction.winner.name || "مستخدم")}
                </span>
              </span>
            )}
          </div>

          {/* قائمة التقييمات مع التعليقات (تُخفى أو تظهر حسب حالة المزاد) */}
          {isDealResolved && (
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-slate-400" /> التقييمات
              </h3>

              {ratingsLoading && (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-400 rounded-full animate-spin"></div>
                </div>
              )}

              {!ratingsLoading && ratings.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <div className="text-slate-400 mb-2"><MessageSquare className="w-8 h-8 mx-auto opacity-50" /></div>
                  <h4 className="font-bold text-slate-600">لا توجد تقييمات</h4>
                  <p className="text-xs text-slate-400 mt-1">لم يقم أحد بتقييم هذه الصفقة حتى الآن.</p>
                </div>
              )}

              {!ratingsLoading && ratings.length > 0 && averageRating && (
                <div className="flex items-center gap-4 mb-8 bg-amber-50/50 p-4 rounded-2xl w-fit border border-amber-100/50">
                  <div className="flex gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-6 h-6 ${i < Math.round(Number(averageRating)) ? "fill-current" : "fill-slate-200 text-slate-200"}`} />
                    ))}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-3xl text-slate-800 tracking-tight">
                      {averageRating}
                    </span>
                    <span className="text-slate-500 text-sm font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-sm">
                      {ratings.length} تقييم
                    </span>
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
                      <Link
                        to={`/users/${typeof auction.owner === 'object' ? auction.owner._id : auction.owner}`}
                        className="text-slate-800 font-bold hover:text-primary transition-colors hover:underline block mb-1"
                      >
                        {auction.owner?.name || 'مستخدم غير معروف'}
                      </Link>

                      {(() => {
                        const displayRating = sellerRating || auction.owner?.rating;
                        if (displayRating && displayRating.count > 0) {
                          return (
                            <div className="flex items-center gap-1.5 mt-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 w-fit shadow-sm">
                              <RatingStars value={displayRating.average} />
                              <span className="text-[11px] font-black text-slate-700">
                                {Number(displayRating.average).toFixed(1)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">({displayRating.count})</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
                {ratings.map((r) => (
                  <div
                    key={r._id}
                    className="bg-white border border-slate-100 rounded-[1.5rem] p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
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

                    {r.comment && (
                      <p className="text-slate-600 text-sm font-medium mb-4 pr-1">
                        "{r.comment}"
                      </p>
                    )}

                    {r.reasons?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {r.reasons.map((rs: string, i: number) => {
                          const key = rs.toLowerCase();
                          const label = ratingReasonMap[key] || rs;
                          return (
                            <span
                              key={i}
                              className={`px-3 py-1 text-[11px] font-bold rounded-lg border bg-slate-50 text-slate-600 border-slate-200`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* ===== نهاية عرض التقييمات ===== */}
        {/* ===== Courier Modal ===== */}
        {showCourierModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-md rounded-[2.5rem] bg-white p-8 shadow-2xl relative overflow-hidden border border-slate-100">

              <div className="flex items-center justify-between mb-8">
                <div className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                    <Package className="w-5 h-5" />
                  </span>
                  اختيار شركة التوصيل
                </div>
                <button
                  onClick={() => setShowCourierModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {courierErr && (
                <div className="mb-6 rounded-2xl border border-rose-200/50 bg-rose-50/80 backdrop-blur-sm p-4 text-rose-600 text-sm font-bold flex gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>{courierErr}</span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">الشركة المتاحة للتوصيل (من محافظتك إلى المشتري)</label>
                  <div className="relative">
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-4 font-bold text-slate-800 appearance-none focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
                    >
                      <option value="" disabled>اختر شركة توصيل...</option>
                      {courierCompanies.map(c => (
                        <option key={c._id} value={c._id}>
                          {c.name}{c.phone ? ` - ${c.phone}` : ""}{` - أجرة: ${Number(c.deliveryFee || 0).toLocaleString()} د.ع`}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </div>



                <button
                  disabled={!selectedCompanyId || courierLoading}
                  onClick={async () => {
                    setCourierLoading(true);
                    setCourierErr(null);
                    try {
                      await api.post(`/courier/orders/${auction._id}/create`, { companyId: selectedCompanyId });
                      setShowCourierModal(false);
                      setSelectedCompanyId("");
                      await refreshAuction();
                    } catch (e: any) {
                      setCourierErr(e?.response?.data?.message || "فشل إنشاء طلب التوصيل");
                    } finally {
                      setCourierLoading(false);
                    }
                  }}
                  className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 text-white py-4 font-black transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:scale-95 flex items-center justify-center gap-2"
                >
                  {courierLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Check className="w-5 h-5" /> <span>تأكيد إنشاء طلب التوصيل</span>
                    </>
                  )}
                </button>

                <div className="text-center">
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg inline-block border border-slate-100">
                    🔒 سيتم إنشاء رموز OTP آمنة للمشتري وللبائع لضمان الاستلام.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {lightboxOpen && hasImages && (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>

            {totalImages > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </>
            )}

            <img
              src={getImageUrl(auction.images?.[activeImageIndex] || auction.images?.[0])}
              alt={auction.title}
              className="max-h-[88vh] max-w-[94vw] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-5 right-1/2 translate-x-1/2 text-white/90 text-sm font-black bg-white/10 px-3 py-1.5 rounded-full">
              {activeImageIndex + 1} / {totalImages}
            </div>
          </div>
        )}

        {/* نافذة الموافقة على شروط المزايدة */}
        {auction && (
          <TermsModal
            isOpen={showBidTermsModal}
            onClose={() => setShowBidTermsModal(false)}
            title="تأكيد شروط المزايدة"
            description={
              <>
                بمجرد وضع المزايدة، سيتم اقتطاع وحجز <strong>عربون دخول</strong> بقيمة ({(auction.depositAmount || 0).toLocaleString()} د.ع) من محفظتك لضمان جديتك في هذا المزاد.
                {" "}
                <a href="#/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline font-bold">
                  اطلع على سياسة الرسوم والأسعار
                </a>
              </>
            }
            termsList={[
              "المزايدة تعتبر التزاماً قاطعاً بالشراء في حال رسو المزاد عليك.",
              "سيتم خصم مبلغ العربون فور المزايدة ولن يتم استرداده إذا انسحبت بعد فوزك أو تهربت من إتمام عملية الدفع والتسليم عبر المنصة.",
              "في حال خسارتك للمزاد، سيتم فك الحجز وإرجاع العربون إلى محفظتك فوراً.",
              "يجب عليك الرد وإتمام الصفقة مع البائع خلال المدة المحددة بعد فوزك وإلا سيتم حظر حسابك ومصادرة العربون.",
              "رسوم خدمة المنصة: تُستقطع عمولة من 1.5% إلى 5% من السعر النهائي للمزاد (بحد أدنى 1,000 د.ع وحد أقصى 50,000 د.ع) وتُخصم من مبلغ الدفع عند إتمام الصفقة. بمزايدتك فإنك تقر بعلمك وموافقتك على هذه الرسوم."
            ]}
            actionLabel={`موافق ومزايدة بـ ${(
              (optimisticBid !== null ? optimisticBid : auction.currentPrice) + auction.increment
            ).toLocaleString()} د.ع`}
            onAccept={async () => {
              setShowBidTermsModal(false);
              await executeBid(true);
            }}
          />
        )}
        {/* ===== Feature Auction Modal ===== */}
        {showFeatureModal && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <div className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="bg-yellow-100 p-2 rounded-xl text-yellow-600">
                    ⭐
                  </span>
                  تمييز المزاد
                </div>
                <button
                  onClick={() => setShowFeatureModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {featureErr && (
                <div className="mb-6 rounded-2xl border border-rose-200/50 bg-rose-50/80 backdrop-blur-sm p-4 text-rose-600 text-sm font-bold flex gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>{featureErr}</span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <p className="text-sm font-bold text-slate-600 mb-4 text-center leading-loose">
                    اجعل مزادك يظهر في:
                    <br />
                    • الصفحة الرئيسية
                    <br />
                    • أعلى نتائج البحث
                    <br />
                    • قسم المزادات المدعومة
                  </p>

                  <div className="space-y-3">
                    {[
                      { id: '1d', label: '24 ساعة', price: 3000 },
                      { id: '3d', label: '3 أيام', price: 7000 },
                      { id: '7d', label: '7 أيام', price: 15000 },
                    ].map(tier => (
                      <label
                        key={tier.id}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${featureDuration === tier.id ? 'border-amber-500 bg-amber-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="featureDuration"
                            value={tier.id}
                            checked={featureDuration === tier.id}
                            onChange={(e) => setFeatureDuration(e.target.value)}
                            className="w-5 h-5 text-amber-500 focus:ring-amber-500 focus:ring-2"
                          />
                          <span className="font-bold text-slate-700">{tier.label}</span>
                        </div>
                        <span className="font-black text-slate-900">{tier.price.toLocaleString()} د.ع</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  disabled={featureLoading}
                  onClick={handleFeatureAuctionAction}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-black rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {featureLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تفعيل التمييز الآن'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rejection Modal for Admins */}
        {rejectModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-slate-100 flex flex-col max-h-[90vh]">
              <div className="p-8 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center border border-rose-100">
                    <XCircle className="w-6 h-6 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">تحديد أسباب الرفض</h3>
                    <p className="text-sm font-medium text-slate-500">سيتم إبلاغ البائع وإعادة العربون له</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {[
                    "المزاد لا يصلح للنشر",
                    "الصور غير واضحة أو غير كافية",
                    "تفاصيل المزاد غير كاملة",
                    "سعر المزاد غير منطقي",
                    "محتوى مخالف للشروط والأحكام"
                  ].map((reason) => (
                    <label key={reason} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                        checked={rejectionReasons.includes(reason)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRejectionReasons([...rejectionReasons, reason]);
                          } else {
                            setRejectionReasons(rejectionReasons.filter(r => r !== reason));
                          }
                        }}
                      />
                      <span className="font-bold text-slate-700">{reason}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-2 mb-8">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">ملاحظة إضافية (اختياري)</label>
                  <textarea
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700 h-24 resize-none"
                    placeholder="اكتب ملاحظات إضافية للبائع هنا..."
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleReject}
                    disabled={adminActionLoading || (rejectionReasons.length === 0 && !rejectionNote.trim())}
                    className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black shadow-lg shadow-rose-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {adminActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    تأكيد الرفض وإعادة العربون
                  </button>
                  <button
                    onClick={() => setRejectModalOpen(false)}
                    disabled={adminActionLoading}
                    className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black transition-all active:scale-95 disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Related Auctions Section (Bottom) ===== */}
      <RelatedAuctions currentAuctionId={auction._id} category={auction.category} />

    </div>
  );
};

export default AuctionDetails;

