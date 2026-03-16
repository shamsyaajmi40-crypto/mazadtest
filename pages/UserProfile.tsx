import { useEffect, useState, useContext, FormEvent } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import { getAuctions, getWonAuctions, getMyBids } from "../services/auction";
import type { Auction, User } from "../types";
import AuctionCard from "../components/AuctionCard";
import {
  MapPin,
  Star,
  Gavel,
  Package,
  Trophy,
  Loader2,
  CalendarDays,
  Award,
  ShieldCheck,
  ChevronRight,
  PackageCheck,
  Settings,
  Save,
  Heart,
  Volume2,
  FileCode,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { rateAuctionUser } from "../services/rating";
import { getMyAuctions } from "../services/auction";
import { updateProfile, getMyFavorites, changePassword, submitVerification } from "../services/user";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { AuthContextType } from "../context/AuthContext";

const ProfileSkeleton = () => (
  <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 animate-pulse">
    <div className="bg-white rounded-[2rem] h-64 mb-12 border border-slate-100 flex flex-col md:flex-row p-8 gap-8 items-center">
      <div className="w-32 h-32 md:w-40 md:h-40 bg-slate-100 rounded-[2rem]"></div>
      <div className="flex-1 space-y-4 w-full">
        <div className="h-10 bg-slate-100 rounded-xl w-1/3"></div>
        <div className="h-6 bg-slate-100 rounded-xl w-1/4"></div>
        <div className="flex gap-4 mt-6">
          <div className="h-20 bg-slate-100 rounded-2xl w-32"></div>
          <div className="h-20 bg-slate-100 rounded-2xl w-32"></div>
        </div>
      </div>
    </div>
    <div className="flex gap-3 mb-8 overflow-hidden">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-12 bg-slate-50 rounded-2xl w-32 shrink-0 border border-slate-100"></div>
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-80 bg-white rounded-[2rem] border border-slate-100"></div>
      ))}
    </div>
  </div>
);

const UserProfile = () => {
  const { user, setUser } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const isOwnProfile = !id;
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = (queryParams.get("tab") as "LISTINGS" | "BIDS" | "WINS" | "PENDING_COURIER" | "SETTINGS" | "FAVORITES" | "RATINGS") || "LISTINGS";

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] =
    useState<"LISTINGS" | "BIDS" | "WINS" | "PENDING_COURIER" | "SETTINGS" | "FAVORITES" | "RATINGS">(initialTab);

  const [data, setData] = useState<{
    listings: Auction[];
    bids: Auction[];
    wins: Auction[];
    favorites: Auction[];
  }>({
    listings: [],
    bids: [],
    wins: [],
    favorites: [],
    ratings: [],
  });

  //
  const [ratingSummary, setRatingSummary] = useState<{
    average: number | null;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (!profileUser?._id) return;

    api
      .get(`/ratings/user/${profileUser._id}/summary`)
      .then((res) => setRatingSummary(res.data));
  }, [profileUser?._id]);

  // Filter ended auctions with winners
  const myEndedAuctions = data.listings.filter(
    (a) =>
      String(a.status).toUpperCase() === "ENDED" &&
      a.winner != null
  );

  // Filter for pending courier selections
  const pendingCourierAuctions = data.listings.filter(
    (a) =>
      ["ENDED", "completed"].includes(String(a.status).toUpperCase()) &&
      a.winner &&
      (!a.deliveryOrder)
  );



  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setProfileUser(null);
    setData({ listings: [], bids: [], wins: [], favorites: [] });

    // صفحتي
    if (!id) {
      if (!user) return;

      Promise.all([
        getMyAuctions(),
        getMyBids(),
        getWonAuctions(),
        getMyFavorites().catch(() => []),
        api.get(`/ratings/user/${user._id}`).then(res => res.data).catch(() => []),
      ])
        .then(([a, b, w, favs, rats]) => {
          console.log("Logged In User:", user);
          setProfileUser(user);
          setData({
            listings: a.data,
            bids: b.data,
            wins: w.data,
            favorites: favs,
            ratings: rats,
          });
        })
        .finally(() => setLoading(false));

      return;
    }

    // صفحة مستخدم آخر
    api
      .get(`/users/${id}/profile`)
      .then((res) => {
        if (res.data?.user) {
          setProfileUser(res.data.user);
          setData((prev) => ({
            ...prev,
            listings: res.data.auctions,
            ratings: res.data.ratings || [],
          }));
        }
      })
      .finally(() => setLoading(false));
  }, [id]); // 🔥 فقط id

  // Settings form local state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    governorate: "",
    address: "",
    zainCashNumber: "",
    notificationPrefs: {
      outbid: true,
      favoriteEnding: true,
      platformUpdates: true
    }
  });
  const [submittingSettings, setSubmittingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsError, setSettingsError] = useState("");

  // Change Password state
  const [pwdFormData, setPwdFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [submittingPwd, setSubmittingPwd] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [pwdError, setPwdError] = useState("");

  // Account Verification state
  const [verificationFiles, setVerificationFiles] = useState<File[]>([]);
  const [uploadingVerify, setUploadingVerify] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(user?.verification?.status || "none");
  const [verifySuccess, setVerifySuccess] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const handleVerifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (verificationFiles.length === 0) {
      setVerifyError("يرجى اختيار صور الهوية أولاً");
      return;
    }

    setUploadingVerify(true);
    setVerifyError("");
    setVerifySuccess("");

    const formData = new FormData();
    verificationFiles.forEach((file) => {
      formData.append("images", file);
    });

    try {
      const res = await (submitVerification as any)(formData);
      setVerifySuccess(res.message);
      setVerifyStatus("pending");
      setVerificationFiles([]);
      toast.success("تم تقديم طلب التوثيق");
    } catch (err: any) {
      setVerifyError(err.response?.data?.message || "فشل تقديم طلب التوثيق");
    } finally {
      setUploadingVerify(false);
    }
  };

  // Populate settings form when user data loads
  useEffect(() => {
    if (user && isOwnProfile) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        governorate: user.governorate || "",
        address: user.address || "",
        zainCashNumber: (user as any).zainCashNumber || "",
        notificationPrefs: (user as any).notificationPrefs || {
          outbid: true,
          favoriteEnding: true,
          platformUpdates: true
        }
      });
    }
  }, [user, isOwnProfile]);

  const handleUpdateSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSubmittingSettings(true);
    setSettingsSuccess("");
    setSettingsError("");
    try {
      const updatedUser = await updateProfile(formData);
      setSettingsSuccess("تم تحديث البيانات بنجاح");
      setProfileUser(updatedUser);
      // Update AuthContext user state locally without reload
      if (setUser) {
        setUser(updatedUser);
      }
      toast.success("تم تحديث البيانات بنجاح");
    } catch (err: any) {
      setSettingsError(err.response?.data?.message || "حدث خطأ أثناء التحديث");
    } finally {
      setSubmittingSettings(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdSuccess("");
    setPwdError("");

    if (pwdFormData.newPassword !== pwdFormData.confirmPassword) {
      setPwdError("كلمات المرور الجديدة غير متطابقة");
      return;
    }

    if (pwdFormData.newPassword.length < 6) {
      setPwdError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setSubmittingPwd(true);
    try {
      await changePassword({
        currentPassword: pwdFormData.currentPassword,
        newPassword: pwdFormData.newPassword,
      });
      setPwdSuccess("تم تغيير كلمة المرور بنجاح");
      setPwdFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("تم تغيير كلمة المرور بنجاح");
    } catch (err: any) {
      setPwdError(err.response?.data?.message || "فشل تغيير كلمة المرور");
    } finally {
      setSubmittingPwd(false);
    }
  };


  const handleRate = (auctionId: string) => {
    console.log("RATE AUCTION:", auctionId);
    // لاحقًا نفتح Modal أو ننتقل لصفحة التقييم
  };
  if (!user && isOwnProfile) {
    return (
      <div className="p-10 text-center">
        يرجى تسجيل الدخول
      </div>
    );
  }

  if (loading)
    return <ProfileSkeleton />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 animate-in fade-in duration-500">

      {/* Hero Section */}
      <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden mb-12 relative flex flex-col md:flex-row">

        {/* Cover Pattern & Gradient */}
        <div className="absolute inset-0 z-0 opacity-40 mix-blend-multiply pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 10% 20%, rgb(239, 246, 255) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgb(250, 250, 250) 0%, transparent 40%)'
        }}></div>
        <div className="absolute top-0 left-0 w-full h-32 md:h-full md:w-48 bg-gradient-to-br from-primary/10 to-primary/5 z-0"></div>

        <div className="relative z-10 w-full p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8">

          {/* Avatar */}
          <div className="relative group shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-br from-primary to-blue-300 rounded-[2rem] blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
            <div className="relative w-32 h-32 md:w-40 md:h-40 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-center text-5xl md:text-6xl font-black text-primary overflow-hidden">
              <span className="bg-gradient-to-br from-primary to-blue-400 bg-clip-text text-transparent">
                {profileUser?.name?.[0] || "?"}
              </span>
            </div>
            {isOwnProfile && (
              <div className="absolute -bottom-3 -right-3 bg-white p-1.5 rounded-2xl shadow-md border border-slate-100">
                <div className="bg-emerald-500 w-4 h-4 rounded-xl border-2 border-white"></div>
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1 text-center md:text-right flex flex-col justify-center h-full pt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight flex items-center justify-center md:justify-start gap-3">
                  {profileUser?.name || "—"}
                  {profileUser?.verification?.status === "verified" && (
                    <ShieldCheck className="w-8 h-8 text-blue-500 drop-shadow-sm" />
                  )}
                </h1>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-3 text-slate-500 font-medium">
                  {profileUser?.governorate && (
                    <span className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                      <MapPin className="w-4 h-4 text-primary" /> {profileUser.governorate}
                    </span>
                  )}
                  {profileUser?.createdAt && (
                    <span className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                      <CalendarDays className="w-4 h-4 text-slate-400" />
                      عضو منذ {new Date(profileUser.createdAt).getFullYear()}
                    </span>
                  )}
                </div>

                {/* Quick Stats Bar */}
                <div className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-4 no-print border-t border-slate-100/50 pt-5">
                  <div className="flex flex-col items-center md:items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">مزاداتي</span>
                    <span className="text-lg font-black text-slate-900">{data.listings.length}</span>
                  </div>
                  <div className="w-px h-8 bg-slate-100 mx-2 hidden md:block"></div>
                  <div className="flex flex-col items-center md:items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">مزايداتي</span>
                    <span className="text-lg font-black text-slate-900">{data.bids.length}</span>
                  </div>
                  <div className="w-px h-8 bg-slate-100 mx-2 hidden md:block"></div>
                  <div className="flex flex-col items-center md:items-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">انضمام</span>
                    <span className="text-lg font-black text-slate-900">{profileUser?.createdAt ? new Date(profileUser.createdAt).toLocaleDateString("ar-IQ") : "—"}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 min-w-[200px]">
                {ratingSummary && ratingSummary.count > 0 ? (
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/50 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1 mb-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${i < Math.round(Number(ratingSummary.average))
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-300 fill-slate-200"
                            }`}
                        />
                      ))}
                    </div>
                    <div className="text-xl font-black text-amber-900 mt-1">{ratingSummary.average}</div>
                    <span className="text-xs font-bold text-amber-700/70">
                      من أصل {ratingSummary.count} تقييم
                    </span>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center justify-center">
                    <span className="text-slate-400 text-sm font-bold">عضو جديد</span>
                    <span className="text-xs text-slate-400">لا يوجد تقييمات بعد</span>
                  </div>
                )}


              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-8 snap-x hide-scrollbar">
        <button
          onClick={() => setActiveTab("LISTINGS")}
          className={`shrink-0 snap-start px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all duration-300 ${activeTab === "LISTINGS"
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100"
            : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 scale-95 hover:scale-100"
            }`}
        >
          <Package className={`w-5 h-5 ${activeTab === "LISTINGS" ? "text-blue-400" : ""}`} />
          مزاداتي
          <span className={`ml-1.5 px-2 py-0.5 rounded-lg text-xs font-black ${activeTab === "LISTINGS" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {data.listings.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("BIDS")}
          className={`shrink-0 snap-start px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all duration-300 ${activeTab === "BIDS"
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100"
            : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 scale-95 hover:scale-100"
            }`}
        >
          <Gavel className={`w-5 h-5 ${activeTab === "BIDS" ? "text-emerald-400" : ""}`} />
          مزايداتي
          <span className={`ml-1.5 px-2 py-0.5 rounded-lg text-xs font-black ${activeTab === "BIDS" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {data.bids.length}
          </span>
        </button>

        {isOwnProfile && (
          <button
            onClick={() => setActiveTab("WINS")}
            className={`shrink-0 snap-start px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all duration-300 ${activeTab === "WINS"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100"
              : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 scale-95 hover:scale-100"
              }`}
          >
            <Trophy className={`w-5 h-5 ${activeTab === "WINS" ? "text-amber-400" : ""}`} />
            المكتسبة
            <span className={`ml-1.5 px-2 py-0.5 rounded-lg text-xs font-black ${activeTab === "WINS" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
              {data.wins.length}
            </span>
          </button>
        )}

        {isOwnProfile && pendingCourierAuctions.length > 0 && (
          <button
            onClick={() => setActiveTab("PENDING_COURIER")}
            className={`shrink-0 snap-start px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all duration-300 ${activeTab === "PENDING_COURIER"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100"
              : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 scale-95 hover:scale-100"
              }`}
          >
            <PackageCheck className={`w-5 h-5 ${activeTab === "PENDING_COURIER" ? "text-indigo-400" : ""}`} />
            تحديد توصيل
            <span className={`ml-1.5 px-2 py-0.5 rounded-lg text-xs font-black ${activeTab === "PENDING_COURIER" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
              {pendingCourierAuctions.length}
            </span>
          </button>
        )}

        {isOwnProfile && (
          <button
            onClick={() => setActiveTab("FAVORITES")}
            className={`shrink-0 snap-start px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all duration-300 ${activeTab === "FAVORITES"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100"
              : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 scale-95 hover:scale-100"
              }`}
          >
            <Heart className={`w-5 h-5 ${activeTab === "FAVORITES" ? "text-rose-400" : ""}`} />
            المفضلة
            <span className={`ml-1.5 px-2 py-0.5 rounded-lg text-xs font-black ${activeTab === "FAVORITES" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
              {data.favorites.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("RATINGS")}
          className={`shrink-0 snap-start px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all duration-300 ${activeTab === "RATINGS"
            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100"
            : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 scale-95 hover:scale-100"
            }`}
        >
          <Star className={`w-5 h-5 ${activeTab === "RATINGS" ? "text-amber-400" : ""}`} />
          التقييمات
          <span className={`ml-1.5 px-2 py-0.5 rounded-lg text-xs font-black ${activeTab === "RATINGS" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}>
            {data.ratings.length}
          </span>
        </button>

        {isOwnProfile && (
          <button
            onClick={() => setActiveTab("SETTINGS")}
            className={`shrink-0 snap-start px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all duration-300 ${activeTab === "SETTINGS"
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100"
              : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100 scale-95 hover:scale-100"
              }`}
          >
            <Settings className={`w-5 h-5 ${activeTab === "SETTINGS" ? "text-slate-400" : ""}`} />
            إعدادات الحساب
          </button>
        )}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === "LISTINGS" && (
          data.listings.length > 0 ? (
            data.listings.map((auction) => {
              const isEnded =
                String(auction.status).toUpperCase() === "ENDED";

              const isOwner =
                String(auction.owner?._id || auction.owner) ===
                String(user?._id);

              return (
                <div key={auction._id} className="relative group">
                  <AuctionCard auction={auction} />

                  {isOwner && isEnded && auction.winner && (
                    <button
                      className="absolute top-4 left-4 z-20 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-colors"
                      onClick={() =>
                        navigate(`/auctions/${auction._id}`)
                      }
                    >
                      <Star className="w-4 h-4 text-emerald-400" />
                      قيّم المشتري
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-slate-100 border-dashed">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Package className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">لا توجد مزادات بعد</h3>
              <p className="text-slate-500 text-center max-w-sm">
                لم تقم بنشر أي مزاد حتى الآن. ابدأ في عرض سلعك للمزايدة الآن وسيقوم النظام بتسجيلها هنا.
              </p>
            </div>
          )
        )}

        {activeTab === "BIDS" && (
          data.bids.length > 0 ? (
            data.bids.map((a) => (
              <AuctionCard key={a._id} auction={a} />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-slate-100 border-dashed">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Gavel className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">لا توجد مزايدات بعد</h3>
              <p className="text-slate-500 text-center max-w-sm">
                لم تشارك في أي مزاد حتى الآن. تصفح أحدث المزادات وضع زايدتك لتظهر هنا.
              </p>
            </div>
          )
        )}

        {activeTab === "FAVORITES" && (
          data.favorites.length > 0 ? (
            data.favorites.map((a) => (
              <AuctionCard key={a._id} auction={a} />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-slate-100 border-dashed">
              <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                <Heart className="w-10 h-10 text-rose-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">قائمة المفضلة فارغة</h3>
              <p className="text-slate-500 text-center max-w-sm">
                لم تقم بإضافة أي مزادات إلى قائمتك المفضلة حتى الآن. تصفح المزادات وضع علامة ❤️ على ما يثير اهتمامك.
              </p>
            </div>
          )
        )}
        {activeTab === "WINS" && (
          data.wins.length > 0 ? (
            data.wins.map((auction) => (
              <div key={auction._id} className="relative group">
                <AuctionCard auction={auction} />

                <button
                  className="absolute top-4 left-4 z-20 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-emerald-600 transition-colors"
                  onClick={() => handleRate(auction._id)}
                >
                  <Trophy className="w-4 h-4 text-white" />
                  قيّم الصفقة
                </button>

                <button
                  className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-md text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-white transition-all border border-slate-200"
                  onClick={() => navigate(`/wallet?search=${auction._id}`)}
                >
                  <FileCheck className="w-4 h-4 text-indigo-500" />
                  عرض الوصل
                </button>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-slate-100 border-dashed">
              <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                <Trophy className="w-10 h-10 text-amber-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">لم تفز بأي مزاد بعد</h3>
              <p className="text-slate-500 text-center max-w-sm">
                ضاعف من فرصك في الفوز من خلال المزايدة المستمرة في المزادات النشطة.
              </p>
            </div>
          )
        )
        }

        {
          activeTab === "PENDING_COURIER" && (
            pendingCourierAuctions.length > 0 ? (
              pendingCourierAuctions.map((auction) => (
                <div key={auction._id} className="relative group">
                  <AuctionCard auction={auction} />

                  <button
                    className="absolute top-4 left-4 z-20 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                    onClick={() => navigate(`/auctions/${auction._id}`)}
                  >
                    <PackageCheck className="w-4 h-4 text-white" />
                    حدد شركة توصيل
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-slate-100 border-dashed">
                <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <PackageCheck className="w-10 h-10 text-indigo-300" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">لا توجد طلبات توصيل معلقة</h3>
                <p className="text-slate-500 text-center max-w-sm">
                  رائع! جميع مزاداتك المباعة تم تحديد شركات التوصيل لها.
                </p>
              </div>
            )
          )
        }

        {
          activeTab === "SETTINGS" && isOwnProfile && (
            <div className="col-span-full max-w-2xl mx-auto w-full bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                  <Settings className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">المعلومات الشخصية</h3>
                  <p className="text-slate-500 text-sm">تحديث بيانات حسابك والتواصل الخاص بك</p>
                </div>
              </div>

              {settingsSuccess && (
                <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl mb-6 font-bold text-sm border border-emerald-100 text-center">
                  {settingsSuccess}
                </div>
              )}
              {settingsError && (
                <div className="bg-rose-50 text-rose-600 p-4 rounded-xl mb-6 font-bold text-sm border border-rose-100 text-center">
                  {settingsError}
                </div>
              )}

              <form onSubmit={handleUpdateSettings} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">الاسم الكامل</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 focus:bg-white transition-colors outline-none font-medium"
                    placeholder="اسمك الكامل"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 focus:bg-white transition-colors outline-none font-medium text-left dir-ltr"
                    placeholder="07XX XXX XXXX"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">المحافظة</label>
                  <input
                    type="text"
                    value={formData.governorate}
                    onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 focus:bg-white transition-colors outline-none font-medium"
                    placeholder="مثال: بغداد"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">تفاصيل العنوان</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 focus:bg-white transition-colors outline-none font-medium min-h-[100px] resize-y"
                    placeholder="المدينة، المنطقة، أقرب نقطة دالة، رقم المنزل المخصص لك لكي يسهل على شركة التوصيل استلام وتسليم البضائع..."
                  />
                </div>

                <div className="pt-10 border-t border-slate-100 mt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">إعدادات الدفع والفوترة</h3>
                      <p className="text-slate-500 text-sm">تحديد معلومات استلام المبالغ</p>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl mb-6">
                    <div className="flex gap-3">
                      <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-amber-800 leading-relaxed">
                        نظام المزايد يعتمد الفوترة كوثيقة رسمية. جميع الحركات المالية والوصولات مسجلة في سجلاتنا لضمان حقوقك في حال حدوث أي نزاع.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">رقم زين كاش الافتراضي (للاستلام)</label>
                    <input
                      type="tel"
                      value={formData.zainCashNumber}
                      onChange={(e) => setFormData({ ...formData, zainCashNumber: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 focus:bg-white transition-colors outline-none font-medium text-left dir-ltr"
                      placeholder="07XX XXX XXXX"
                    />
                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                      * سيتم استخدام هذا الرقم لإرسال مستحقاتك من المزادات المباعة تلقائياً.
                    </p>
                  </div>
                </div>

                <div className="pt-10 border-t border-slate-100 mt-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                      <Volume2 className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">إعدادات التنبيهات</h3>
                      <p className="text-slate-500 text-sm">تخصيص نوع وحالة التنبيهات المستلمة</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white group cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, notificationPrefs: { ...prev.notificationPrefs, outbid: !prev.notificationPrefs.outbid } }))}>
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl transition-colors ${formData.notificationPrefs.outbid ? "bg-indigo-100 text-indigo-600" : "bg-slate-200 text-slate-400"}`}>
                          <Gavel className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm">تنبيهات المزايدة</p>
                          <p className="text-xs text-slate-500 font-medium">عندما يقوم شخص آخر بالمزايدة على عرضك</p>
                        </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${formData.notificationPrefs.outbid ? "bg-indigo-600" : "bg-slate-300"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${formData.notificationPrefs.outbid ? "translate-x-6" : "translate-x-0"}`} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white group cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, notificationPrefs: { ...prev.notificationPrefs, favoriteEnding: !prev.notificationPrefs.favoriteEnding } }))}>
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl transition-colors ${formData.notificationPrefs.favoriteEnding ? "bg-amber-100 text-amber-600" : "bg-slate-200 text-slate-400"}`}>
                          <Heart className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm">المزادات المفضلة</p>
                          <p className="text-xs text-slate-500 font-medium">عند اقتراب انتهاء مزاد أضفته للمفضلة</p>
                        </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${formData.notificationPrefs.favoriteEnding ? "bg-amber-600" : "bg-slate-300"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${formData.notificationPrefs.favoriteEnding ? "translate-x-6" : "translate-x-0"}`} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white group cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, notificationPrefs: { ...prev.notificationPrefs, platformUpdates: !prev.notificationPrefs.platformUpdates } }))}>
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl transition-colors ${formData.notificationPrefs.platformUpdates ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"}`}>
                          <Settings className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm">تحديثات المنصة</p>
                          <p className="text-xs text-slate-500 font-medium">أخبار المزايد والميزات الجديدة</p>
                        </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${formData.notificationPrefs.platformUpdates ? "bg-emerald-600" : "bg-slate-300"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${formData.notificationPrefs.platformUpdates ? "translate-x-6" : "translate-x-0"}`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Verification (KYC) */}
                <div className="pt-10 border-t border-slate-100 mt-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">توثيق الحساب (KYC)</h3>
                      <p className="text-slate-500 text-sm">ارفع وثائق الهوية للحصول على شارة "بائع موثوق"</p>
                    </div>
                  </div>

                  {verifyStatus === "verified" ? (
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <FileCheck className="w-8 h-8 text-emerald-600" />
                      </div>
                      <h4 className="text-lg font-black text-emerald-800 mb-1">حسابك موثق بنجاح!</h4>
                      <p className="text-emerald-600 text-sm font-medium">أنت الآن تحمل شارة "بائع موثوق" وتتمتع بثقة كاملة من المشترين.</p>
                    </div>
                  ) : verifyStatus === "pending" ? (
                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                      </div>
                      <h4 className="text-lg font-black text-amber-800 mb-1">طلبك قيد المراجعة</h4>
                      <p className="text-amber-600 text-sm font-medium">يقوم فريقنا حالياً بمراجعة وثائقك، سيتم تحديث حالتك قريباً.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {verifyStatus === "rejected" && (
                        <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3 text-rose-600">
                          <AlertCircle className="w-5 h-5 shrink-0" />
                          <div>
                            <p className="text-sm font-bold">تم رفض طلبك السابق</p>
                            <p className="text-xs font-medium opacity-80">{user?.verification?.rejectionReason || "الوثائق المرفوعة غير واضحة"}</p>
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-50 border border-slate-100 border-dashed p-8 rounded-[2rem] flex flex-col items-center">
                        <input
                          type="file"
                          id="kyc-upload"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) {
                              setVerificationFiles(Array.from(e.target.files));
                            }
                          }}
                        />
                        <label htmlFor="kyc-upload" className="cursor-pointer flex flex-col items-center">
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-4 group-hover:scale-110 transition-transform">
                            <FileCode className="w-8 h-8 text-slate-400" />
                          </div>
                          <span className="text-sm font-black text-slate-800">اضغط هنا لرفع صور الهوية</span>
                          <span className="text-xs text-slate-400 mt-1">البطاقة الموحدة أو جواز السفر (وجه وظهر)</span>
                        </label>

                        {verificationFiles.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {verificationFiles.map((file, idx) => (
                              <div key={idx} className="bg-white px-3 py-1 rounded-lg text-[10px] font-bold text-slate-600 border border-slate-200">
                                {file.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {verifyError && <p className="text-center text-rose-500 text-xs font-bold">{verifyError}</p>}
                      {verifySuccess && <p className="text-center text-emerald-500 text-xs font-bold">{verifySuccess}</p>}

                      <button
                        onClick={handleVerifySubmit}
                        disabled={uploadingVerify || verificationFiles.length === 0}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        {uploadingVerify ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                        {uploadingVerify ? "جاري الرفع..." : "تقديم الوثائق للتوثيق"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingSettings}
                    className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {submittingSettings ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {submittingSettings ? "جاري الحفظ..." : "حفظ التغييرات"}
                  </button>
                </div>
              </form>

              {/* Security - Change Password */}
              <div className="mt-12 pt-10 border-t border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">الأمان وكلمة المرور</h3>
                    <p className="text-slate-500 text-sm">تغيير كلمة المرور الخاصة بحسابك</p>
                  </div>
                </div>

                {pwdSuccess && (
                  <div className="bg-emerald-50 text-emerald-600 p-4 rounded-xl mb-6 font-bold text-sm border border-emerald-100 text-center">
                    {pwdSuccess}
                  </div>
                )}
                {pwdError && (
                  <div className="bg-rose-50 text-rose-600 p-4 rounded-xl mb-6 font-bold text-sm border border-rose-100 text-center">
                    {pwdError}
                  </div>
                )}

                <form onSubmit={handleUpdatePassword} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">كلمة المرور الحالية</label>
                    <input
                      type="password"
                      value={pwdFormData.currentPassword}
                      onChange={(e) => setPwdFormData({ ...pwdFormData, currentPassword: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 focus:bg-white transition-colors outline-none font-medium"
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">كلمة المرور الجديدة</label>
                      <input
                        type="password"
                        value={pwdFormData.newPassword}
                        onChange={(e) => setPwdFormData({ ...pwdFormData, newPassword: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 focus:bg-white transition-colors outline-none font-medium"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">تأكيد كلمة المرور</label>
                      <input
                        type="password"
                        value={pwdFormData.confirmPassword}
                        onChange={(e) => setPwdFormData({ ...pwdFormData, confirmPassword: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-400 focus:bg-white transition-colors outline-none font-medium"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-6 flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingPwd}
                      className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      {submittingPwd ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-5 h-5" />
                      )}
                      {submittingPwd ? "جاري التحديث..." : "تحديث كلمة المرور"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        }

        {activeTab === "RATINGS" && (
          <div className="col-span-full space-y-4">
            {data.ratings.length > 0 ? (
              data.ratings.map((r: any) => (
                <div key={r._id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex flex-col items-center md:items-start min-w-[120px]">
                    <div className="flex mb-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-4 h-4 ${s <= r.score ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-100"}`} />
                      ))}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">
                      {new Date(r.createdAt).toLocaleDateString("ar-IQ")}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-black text-slate-800">{r.fromUser?.name || "مستخدم مزايد"}</span>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                        {r.role === "buyer_to_seller" ? "مشتري" : "بائع"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                      {r.comment || "لا يوجد تعليق إضافي"}
                    </p>
                    {r.reasons && r.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {r.reasons.map((reason: string) => (
                          <span key={reason} className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-slate-100 border-dashed">
                <Star className="w-12 h-12 text-slate-200 mb-4" />
                <h3 className="text-xl font-black text-slate-800 mb-2">لا يوجد تقييمات بعد</h3>
                <p className="text-slate-500 text-center">لم يتلقى هذا المستخدم أي تقييمات حتى الآن.</p>
              </div>
            )}
          </div>
        )}
      </div >
    </div >
  );
};

export default UserProfile;
