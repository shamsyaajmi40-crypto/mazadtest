import { Link, useLocation } from "react-router-dom";
import { Plus, Wallet, User, LogOut, LayoutDashboard, Archive, Menu, X, ChevronDown, Diamond, PackageCheck, Star } from "lucide-react";
import NotificationManager from "./NotificationManager";
import { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import LoginModal from "./LoginModal";
import { getAdminCounters } from "@/services/admin";
import { getMyOpenDeals, getPendingCourierAuctions } from "@/services/auction";
import { getPendingRatings } from "@/services/rating";

// عداد الإشعارات
const CounterBadge = ({ count, className = "" }: { count: number; className?: string }) => {
  if (count <= 0) return null;

  return (
    <span
      className={`absolute flex items-center justify-center bg-rose-500 text-white text-[10px] font-black px-1.5 min-w-[18px] h-[18px] rounded-full shadow-sm ring-2 ring-white animate-in zoom-in ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
};

export default function TopBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [counters, setCounters] = useState({
    pendingAuctions: 0,
    pendingBalanceRequests: 0,
    openDeals: 0,
  });
  const [pendingRatings, setPendingRatings] = useState(0);
  const [ratingBannerDismissed, setRatingBannerDismissed] = useState(false);
  const [pendingCouriers, setPendingCouriers] = useState(0);
  const [courierBannerDismissed, setCourierBannerDismissed] = useState(false);

  // إغلاق المودال والقوائم عند تغيير المسار
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // إغلاق قائمة المستخدم عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { socket, isConnected } = useSocket();

  // جلب العدادات للإدمن (و ربط الـ Socket.io)
  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "superAdmin")) return;

    const fetchCounters = () => {
      getAdminCounters()
        .then((res) => setCounters((prev) => ({ ...prev, ...res.data })))
        .catch(() =>
          setCounters((prev) => ({ ...prev, pendingAuctions: 0, pendingBalanceRequests: 0 }))
        );
    };

    fetchCounters(); // جلب في البداية

    // تحديث إضافي عند العودة للنافذة
    const onFocus = () => fetchCounters();
    window.addEventListener("focus", onFocus);

    let refreshHandler = () => {
      fetchCounters();
    };

    if (socket && isConnected) {
      socket.emit("admin:join");
      socket.on("admin_refresh", refreshHandler);
    }

    return () => {
      window.removeEventListener("focus", onFocus);
      if (socket) {
        socket.off("admin_refresh", refreshHandler);
      }
    };
  }, [user, socket, isConnected]);

  // جلب الصفقات الجارية (و ربط الـ Socket.io)
  useEffect(() => {
    if (!user) {
      setCounters((prev) => ({ ...prev, openDeals: 0 }));
      return;
    }

    const fetchOpenDeals = () => {
      getMyOpenDeals()
        .then((res) => {
          const total = Number(res.data?.pagination?.total ?? 0);
          setCounters((prev) => ({ ...prev, openDeals: Number.isFinite(total) ? total : 0 }));
        })
        .catch(() => {
          setCounters((prev) => ({ ...prev, openDeals: 0 }));
        });
    };

    fetchOpenDeals();

    const refreshDealsHandler = () => {
      fetchOpenDeals();
    };

    if (socket && isConnected) {
      // SocketProvider logic already handles user:join, but we just need the listener here
      socket.on("user_refresh", refreshDealsHandler);
    }

    return () => {
      if (socket) {
        socket.off("user_refresh", refreshDealsHandler);
      }
    };
  }, [user, socket, isConnected]);

  // جلب التقييمات المعلقة
  useEffect(() => {
    if (!user) { setPendingRatings(0); return; }
    const fetch = () =>
      getPendingRatings()
        .then((res) => setPendingRatings(res.data?.count ?? 0))
        .catch(() => setPendingRatings(0));
    fetch();
    // أعد التحقق عند كل تحديث للمستخدم (بعد تقييم)
    window.addEventListener("focus", fetch);
    return () => window.removeEventListener("focus", fetch);
  }, [user]);

  // جلب المزادات التي تحتاج لشركة توصيل (للبائع)
  useEffect(() => {
    if (!user) { setPendingCouriers(0); return; }
    const fetch = () =>
      getPendingCourierAuctions()
        .then((res) => setPendingCouriers(res.data?.count ?? 0))
        .catch(() => setPendingCouriers(0));
    fetch();
    window.addEventListener("focus", fetch);
    return () => window.removeEventListener("focus", fetch);
  }, [user]);

  const isAdmin = user?.role === "admin" || user?.role === "superAdmin";

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-sm shadow-slate-200/20 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 h-[4.5rem] flex items-center justify-between">

          {/* القسم الأيمن (اللوجو وزر إنشاء) */}
          <div className="flex items-center gap-6">
            <Link to="/" className="text-[1.75rem] font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tighter hover:scale-105 transition-transform">
              MAZAD
            </Link>
          </div>

          {/* القسم الأوسط (الروابط الأساسية) */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/archived"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${location.pathname === "/archived"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
            >
              <Archive className="w-4 h-4" />
              الأرشيف
            </Link>



            {user && (
              <Link
                to="/deals/open"
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${location.pathname === "/deals/open"
                  ? "bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200/50"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
              >
                <PackageCheck className="w-4 h-4" />
                الصفقات الجارية
                <CounterBadge count={counters.openDeals} className="-top-1.5 -right-1.5" />
              </Link>
            )}

            {isAdmin && (
              <div className="h-6 w-px bg-slate-200 mx-2"></div>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${location.pathname.startsWith("/admin")
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm"
                  : "text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-600"
                  }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                لوحة التحكم
                <CounterBadge count={counters.pendingAuctions} className="-top-1.5 -right-1.5" />
              </Link>
            )}

            {user?.role === "superAdmin" && (
              <Link
                to="/admin/completed-auctions"
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 transition-all"
              >
                المكتملة
              </Link>
            )}
          </div>

          {/* القسم الأيسر (بروفايل + نوتفكيشن) */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <Link
                to="/create"
                className="flex items-center gap-2 bg-gradient-to-r from-primary-dark to-primary text-white px-5 py-2.5 rounded-[1rem] text-sm font-black hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5 active:scale-95 border border-primary-light/20"
              >
                <Plus className="w-4 h-4" />
                إنشاء مزاد
              </Link>
            </div>

            {user ? (
              <div className="flex items-center gap-2">
                {/* الإشعارات */}
                <NotificationManager />

                {/* القائمة المنسدلة للمستخدم */}
                <div className="relative hidden md:block" ref={dropdownRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2.5 bg-white border border-slate-200/60 p-1.5 pl-4 rounded-full shadow-sm hover:shadow-md hover:border-slate-300 transition-all active:scale-95"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-700 max-w-[100px] truncate">{user.name}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${userMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* محتوى القائمة المنسدلة */}
                  <div className={`absolute left-0 top-full mt-3 w-64 bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-[1.5rem] shadow-2xl p-2 transition-all duration-200 origin-top-left ${userMenuOpen ? "opacity-100 scale-100 visible" : "opacity-0 scale-95 invisible"
                    }`}>
                    <div className="px-4 py-3 border-b border-slate-100 mb-2">
                      <p className="text-xs font-bold text-slate-400 mb-1">حسابك</p>
                      <p className="text-sm font-black text-slate-800 truncate">{user.name}</p>
                    </div>

                    <div className="space-y-1">
                      <Link
                        to="/profile"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500"><User className="w-4 h-4" /></div>
                        الملف الشخصي
                      </Link>

                      <Link
                        to="/wallet"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                      >
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600"><Wallet className="w-4 h-4" /></div>
                        المحفظة
                      </Link>
                    </div>

                    <div className="h-px bg-slate-100 my-2"></div>

                    <button
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <div className="p-1.5 rounded-lg bg-rose-100"><LogOut className="w-4 h-4" /></div>
                      تسجيل الخروج
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden md:block">
                <button
                  onClick={() => setShowLogin(true)}
                  className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10 active:scale-95"
                >
                  تسجيل الدخول
                </button>
              </div>
            )}

            {/* زر الموبايل */}
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden flex items-center justify-center bg-slate-50 border border-slate-200/60 w-10 h-10 rounded-xl text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ===== Courier Selection Reminder Banner ===== */}
      {user && pendingCouriers > 0 && !courierBannerDismissed && (
        <div className="sticky top-[4.5rem] z-40 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-gradient-to-l from-indigo-500 to-blue-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg shadow-indigo-500/20">
            <div className="flex items-center gap-2.5 flex-1">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <PackageCheck className="w-4 h-4 shrink-0" />
              <span className="text-sm font-black">
                لديك {pendingCouriers === 1 ? "طلب واحد" : `${pendingCouriers} طلبات`} بانتظار تحديد شركة التوصيل — اختر شركة التوصيل الآن لإتمام البيع!
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/profile?tab=PENDING_COURIER"
                className="text-xs font-black bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors border border-white/30"
                onClick={() => setCourierBannerDismissed(true)}
              >
                إدارة الطلبات
              </Link>
              <button
                onClick={() => setCourierBannerDismissed(true)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors border border-transparent hover:border-white/30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Rating Reminder Banner ===== */}
      {user && pendingRatings > 0 && !ratingBannerDismissed && (
        <div className="sticky top-[4.5rem] z-40 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-gradient-to-l from-amber-500 to-orange-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg shadow-amber-500/20">
            <div className="flex items-center gap-2.5 flex-1">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <Star className="w-4 h-4 shrink-0" />
              <span className="text-sm font-black">
                لديك {pendingRatings === 1 ? "صفقة واحدة" : `${pendingRatings} صفقات`} بانتظار تقييمك — ساهم في بناء الثقة!
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/archived"
                className="text-xs font-black bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors border border-white/30"
                onClick={() => setRatingBannerDismissed(true)}
              >
                قيّم الآن
              </Link>
              <button
                onClick={() => setRatingBannerDismissed(true)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* قائمة الموبايل بأسلوب Glassmorphism */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-all duration-300 ${mobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
      >
        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>

        <div className={`absolute top-0 right-0 w-4/5 max-w-xs h-full bg-white shadow-2xl transition-transform duration-300 transform ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="p-6 flex flex-col h-full overflow-y-auto">

            <div className="flex items-center justify-between mb-8">
              <span className="text-2xl font-black text-slate-900">MAZAD</span>
              <button onClick={() => setMobileMenuOpen(false)} className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {user && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex flex-shrink-0 items-center justify-center font-black text-slate-600 text-lg">
                  {user.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <div className="font-bold text-slate-800 truncate">{user.name}</div>
                  <div className="text-xs font-bold text-primary mt-0.5">عضو موثوق</div>
                </div>
              </div>
            )}

            <div className="space-y-2 flex-1">
              <Link to="/create" className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold bg-primary/10 text-primary mb-4">
                <Plus className="w-5 h-5" /> إنشاء مزاد
              </Link>

              <Link to="/archived" className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-slate-700 hover:bg-slate-50">
                <Archive className="w-5 h-5 opacity-60" /> الأرشيف
              </Link>



              {user && (
                <Link to="/deals/open" className="flex items-center justify-between px-4 py-3 rounded-xl font-bold text-slate-700 hover:bg-emerald-50">
                  <div className="flex items-center gap-3">
                    <PackageCheck className="w-5 h-5 text-emerald-600" /> الصفقات الجارية
                  </div>
                  {counters.openDeals > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      {counters.openDeals > 99 ? "99+" : counters.openDeals}
                    </span>
                  )}
                </Link>
              )}

              {isAdmin && (
                <Link to="/admin" className="flex items-center justify-between px-4 py-3 rounded-xl font-bold text-slate-700 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="w-5 h-5 opacity-60" /> لوحة التحكم
                  </div>
                  {counters.pendingAuctions > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{counters.pendingAuctions}</span>
                  )}
                </Link>
              )}

              {user && (
                <>
                  <div className="h-px bg-slate-100 my-4 mx-4"></div>
                  <Link to="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-slate-700 hover:bg-slate-50">
                    <User className="w-5 h-5 opacity-60" /> الملف الشخصي
                  </Link>
                  <Link to="/wallet" className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-slate-700 hover:bg-slate-50">
                    <Wallet className="w-5 h-5 opacity-60" /> المحفظة
                  </Link>
                </>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              {user ? (
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="flex items-center justify-center w-full gap-2 px-4 py-3 rounded-xl font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                >
                  <LogOut className="w-5 h-5" /> تسجيل الخروج
                </button>
              ) : (
                <button
                  onClick={() => { setShowLogin(true); setMobileMenuOpen(false); }}
                  className="flex items-center justify-center w-full bg-slate-900 text-white px-4 py-3 rounded-xl font-black shadow-lg shadow-slate-900/20 active:scale-95 transition-all"
                >
                  تسجيل الدخول
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
