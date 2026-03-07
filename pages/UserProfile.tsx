import { useEffect, useState, useContext, FormEvent } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../services/api";
import { getAuctions, getWonAuctions, getMyBids } from "../services/auction";
import { fetchMyBillingMe } from "../services/billing.service";
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
} from "lucide-react";
import { rateAuctionUser } from "../services/rating";
import { getMyAuctions } from "../services/auction";
import { updateProfile } from "../services/user";
import { useParams, useNavigate, useLocation } from "react-router-dom";
const UserProfile = () => {
  const { user } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const isOwnProfile = !id;
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = (queryParams.get("tab") as "LISTINGS" | "BIDS" | "WINS" | "PENDING_COURIER" | "SETTINGS") || "LISTINGS";

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] =
    useState<"LISTINGS" | "BIDS" | "WINS" | "PENDING_COURIER" | "SETTINGS">(initialTab);

  const [data, setData] = useState<{
    listings: Auction[];
    bids: Auction[];
    wins: Auction[];
  }>({
    listings: [],
    bids: [],
    wins: [],
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
  const [myBilling, setMyBilling] = useState<any>(null);

  useEffect(() => {
    setLoading(true);

    // صفحتي
    if (!id) {
      if (!user) return;

      Promise.all([
        getMyAuctions(),
        getMyBids(),
        getWonAuctions(),
        fetchMyBillingMe().catch((err) => { console.error("Billing err:", err); return null; }),
      ])
        .then(([a, b, w, billing]) => {
          console.log("Logged In User:", user);
          console.log("Billing Data fetched:", billing);
          setProfileUser(user);
          setData({
            listings: a.data,
            bids: b.data,
            wins: w.data,
          });
          if (billing) setMyBilling(billing);
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
  });
  const [submittingSettings, setSubmittingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsError, setSettingsError] = useState("");

  // Populate settings form when user data loads
  useEffect(() => {
    if (user && isOwnProfile) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        governorate: user.governorate || "",
        address: user.address || "",
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
      // Option: update local storage session or rely on TopBar to fetch me on mount. We can trigger a quick window reload to update context if necessary, or better, the Context needs an update function. We'll simply let the user see it updated.
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setSettingsError(err.response?.data?.message || "حدث خطأ أثناء التحديث");
    } finally {
      setSubmittingSettings(false);
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
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );

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
              <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight flex items-center justify-center md:justify-start gap-3">
                  {profileUser?.name || "—"}
                  <ShieldCheck className="w-8 h-8 text-emerald-500 drop-shadow-sm" />
                </h1>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-3 text-slate-500 font-medium">
                  {profileUser?.governorate && (
                    <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                      <MapPin className="w-4 h-4 text-primary" /> {profileUser.governorate}
                    </span>
                  )}
                  {profileUser?.createdAt && (
                    <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                      <CalendarDays className="w-4 h-4 text-slate-400" />
                      عضو منذ {new Date(profileUser.createdAt).getFullYear()}
                    </span>
                  )}
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

                {isOwnProfile && (() => {
                  const planCode = myBilling?.subscription?.plan?.code || user?.subscription?.plan?.code || (user as any)?.planCode || "USER_FREE";

                  let planName = "FREE";
                  let badgeColors = "bg-slate-200 text-slate-700 border-slate-300";

                  if (planCode === "USER_MAX") {
                    planName = "MAX";
                    badgeColors = "bg-amber-100 text-amber-700 border-amber-200";
                  } else if (planCode === "USER_PLUS") {
                    planName = "PLUS";
                    badgeColors = "bg-indigo-100 text-indigo-700 border-indigo-200";
                  } else if (planCode.includes("TRADER")) {
                    planName = planCode.replace("TRADER_", "");
                    badgeColors = "bg-rose-100 text-rose-700 border-rose-200";
                  }

                  return (
                    <div className="flex flex-col gap-2 w-full mt-2">
                      <div className="flex justify-between items-center bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl">
                        <span className="text-xs font-bold text-slate-500">باقتك الحالية</span>
                        <span className={`text-xs font-black px-2.5 py-1 rounded-md border ${badgeColors}`}>
                          {planName}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate("/pricing")}
                        className="group relative overflow-hidden bg-slate-900 text-white rounded-2xl py-3 px-6 font-bold shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 transition-all active:scale-[0.98] w-full"
                      >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] skew-x-[-15deg] group-hover:animate-[shimmer_1.5s_infinite]"></div>
                        <span className="flex items-center justify-center gap-2 relative z-10">
                          <Award className="w-5 h-5 text-amber-400" />
                          إدارة الباقة
                        </span>
                      </button>
                    </div>
                  );
                })()}
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
        )}

        {activeTab === "PENDING_COURIER" && (
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
        )}

        {activeTab === "SETTINGS" && isOwnProfile && (
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
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
