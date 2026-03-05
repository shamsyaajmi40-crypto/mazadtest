
import React, { useEffect, useRef, useState } from 'react';

import { getAuctions, getUpcomingAuctions } from '../services/auction';
import { Auction, AuctionCategory, AUCTION_CATEGORIES, AuctionStatus } from '../types';
import AuctionCard from '../components/AuctionCard';
import AuctionSidebarCard from "../components/AuctionSidebarCard";
import {
  Car, Smartphone, Home as HomeIcon, LayoutGrid, Search,
  Filter, MapPin, Tag, ChevronDown, RefreshCw, Sparkles
} from 'lucide-react';
import { Link } from "react-router-dom";
import { AUCTION_STATUS } from "../types";
import { useSearchParams } from "react-router-dom";
import { set } from 'mongoose';

//تحديث الصفحة 
const HOME_POLL_INTERVAL = 60000; // 60 ثانية

//حماية بسيطة تمنع تكرار الطلب لو المستخدم رجع بسرعة عدة مرات خلال ثوانٍ.

const GOVERNORATES = [
  'الكل', 'بغداد', 'البصرة', 'نينوى', 'أربيل', 'السليمانية', 'دهوك', 'كركوك',
  'الأنبار', 'ديالى', 'بابل', 'كربلاء', 'النجف', 'صلاح الدين', 'واسط',
  'القادسية', 'ميسان', 'المثنى', 'ذي قار'
];

const HomeData = () => {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [upcoming, setUpcoming] = useState<Auction[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  // حالات الفلترة
  const [filters, setFilters] = useState({
    searchTerm: '',
    category: 'ALL' as AuctionCategory | 'ALL',
    governorate: 'الكل',
    minPrice: '',
    maxPrice: '',
    status: AUCTION_STATUS.ACTIVE as AuctionStatus | 'ALL'
  });

  const loadAuctions = async () => {
    setLoading(true);
    try {
      const res = await getAuctions({
        page,
        limit: 10,
        governorate: filters.governorate,
        category: filters.category,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        searchTerm: filters.searchTerm,
        status: filters.status === "ALL" ? undefined : filters.status,
      });

      setPagination(res.data.pagination);
      setAuctions(
        res.data.auctions.map((a: any) => ({
          ...a,
          endsAt: a.endsAt || a.endTime, // أمان
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  const refreshLiveAuctions = async () => {
    try {
      const res = await getAuctions({
        page,
        governorate: filters.governorate,
        category: filters.category,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        searchTerm: filters.searchTerm,
        status: filters.status === "ALL" ? undefined : filters.status,
      });
      if (!res?.data?.auctions) return;
      setAuctions((prev) =>
        prev.map((a) => {
          const updated = res.data.auctions.find((u: any) => u._id === a._id);
          if (!updated) return a;

          // نحدّث فقط القيم المتغيرة
          return {
            ...a,
            currentPrice: updated.currentPrice,
            bidsCount: updated.bidsCount,
            endsAt: updated.endsAt ?? updated.endTime ?? a.endsAt,

          };
        })
      );

    } catch (e) {
      console.error("Live update failed", e);
    }
  };
  //

  const lastFocusRefreshRef = useRef(0);
  const tick = () => {
    if (document.visibilityState !== "visible") return;

    const now = Date.now();
    if (now - lastFocusRefreshRef.current < 10000) return; // 10s
    lastFocusRefreshRef.current = now;

    refreshLiveAuctions();
  };

  // تحميل كامل عند تغيير الفلاتر فقط
  useEffect(() => {
    loadAuctions();
  }, [filters, page]);
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // تحديث صامت كل 15 ثانية
  useEffect(() => {
    let intervalId: number | undefined;

    const tick = () => {
      // لا نعمل تحديث إذا الصفحة غير ظاهرة
      if (document.visibilityState !== "visible") return;
      refreshLiveAuctions();
    };

    // تحديث فوري عند التركيز/الرجوع
    const handleFocus = () => tick();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };

    // تشغيل المؤقت
    intervalId = window.setInterval(tick, HOME_POLL_INTERVAL);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [filters]); // مهم: حتى يتحدث مع الفلاتر الجديدة

  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const data = await getUpcomingAuctions();
        setUpcoming(data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchUpcoming();
  }, []);


  // تحديث فوري عند تغيير الفئة أو الحالة
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAuctions();
  };
  // إعادة ضبط الفلاتر
  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      category: 'ALL',
      governorate: 'الكل',
      minPrice: '',
      maxPrice: '',
      status: AUCTION_STATUS.ACTIVE
    });
  };
  // تطبيق الفلاتر على المزادات


  // فئات سريعة
  const categories = [
    { id: 'ALL', name: 'الكل', icon: LayoutGrid },
    { id: AUCTION_CATEGORIES.CARS, name: 'السيارات', icon: Car },
    { id: AUCTION_CATEGORIES.ELECTRONICS, name: 'الإلكترونيات', icon: Smartphone },
    { id: AUCTION_CATEGORIES.REAL_ESTATE, name: 'العقارات', icon: HomeIcon },
  ];

  //hotAucation 
  const HOT_BIDS_THRESHOLD = 5;



  const hotAuctions = auctions.filter((a) => {
    const count =
      a.bids?.length ??
      a.bidsCount ??
      0;

    return count >= HOT_BIDS_THRESHOLD;
  });




  // منطق “ينتهي قريبًا”
  const now = Date.now();

  const endingSoonAuctions = auctions.filter((auction) => {
    if (!auction.endsAt) return false;

    const endTime = new Date(auction.endsAt).getTime();
    const diffMinutes = (endTime - now) / 60000;

    return diffMinutes > 0 && diffMinutes <= 30;
  });
  const [searchParams] = useSearchParams();
  const showEndingSoonOnly = searchParams.get("endingSoon") === "1";

  const displayedAuctions = showEndingSoonOnly
    ? endingSoonAuctions
    : auctions;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 animate-in fade-in duration-500">

      {/* ===== Premium Hero Section ===== */}
      <div className="relative pt-10 pb-32 sm:pt-16 sm:pb-40 overflow-hidden bg-white border-b border-slate-200/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-white to-white"></div>
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-rose-100/40 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-black text-sm mb-6 sm:mb-8 shadow-sm border border-primary/20 backdrop-blur-md">
            <Sparkles className="w-4 h-4" /> المنصة الأسرع نمواً
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black mb-6 tracking-tighter text-slate-900 leading-[1.1]">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-600">mazad - مزاد</span>
          </h1>
          <p className="text-slate-500 text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto font-medium leading-relaxed">
            الوجهة الموثوقة للمزايدة المباشرة في العراق. تصفح آلاف العروض وشارك في المزادات الحية الآن.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 -mt-24 sm:-mt-28 mb-16">
        {/* ===== Floating Search & Filter Island ===== */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white p-4 sm:p-6 mb-12 transform transition-all">
          <form onSubmit={handleSearchSubmit} className="space-y-4 sm:space-y-6">
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
              <div className="relative flex-grow group">
                <Search className="h-5 w-5 text-slate-400 absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  className="block w-full pr-14 pl-5 py-4 border-2 border-slate-100 rounded-[1.5rem] bg-slate-50/50 focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700 placeholder:text-slate-400 text-base shadow-inner"
                  placeholder="ابحث بالعنوان (مثال: تويوتا، آيفون، منزل...)"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                />
              </div>

              <div className="flex gap-2 sm:gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 sm:px-8 py-4 rounded-[1.5rem] font-black transition-all border-2 shadow-sm ${showFilters ? 'bg-primary/10 text-primary border-primary/20 shadow-primary/5' : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                  <Filter className="w-5 h-5" />
                  <span>تصفية</span>
                </button>
                <button
                  type="submit"
                  className="flex-1 md:flex-none bg-gradient-to-r from-primary to-indigo-600 text-white px-6 sm:px-10 py-4 rounded-[1.5rem] font-black hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-300 active:scale-95"
                >
                  بحث
                </button>
              </div>
            </div>

            {/* لوحة التصفية المتقدمة */}
            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
                {/* المحافظة */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                    <MapPin className="w-3.5 h-3.5" /> المحافظة
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-slate-700 transition-all cursor-pointer"
                      value={filters.governorate}
                      onChange={(e) => setFilters({ ...filters, governorate: e.target.value })}
                    >
                      {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* السعر */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                    <Tag className="w-3.5 h-3.5" /> نطاق السعر (د.ع)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="من"
                      className="w-1/2 px-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-sm transition-all"
                      value={filters.minPrice}
                      onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="إلى"
                      className="w-1/2 px-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-sm transition-all"
                      value={filters.maxPrice}
                      onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                    />
                  </div>
                </div>

                {/* حالة المزاد */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                    <RefreshCw className="w-3.5 h-3.5" /> حالة المزاد
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-slate-700 transition-all cursor-pointer"
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                    >
                      <option value={AUCTION_STATUS.ACTIVE}>نشط حالياً</option>
                      <option value={AUCTION_STATUS.UPCOMING}>تبدأ قريباً</option>
                      <option value="ALL">الكل</option>
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* أزرار الإجراءات */}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="w-full py-3.5 text-sm font-black text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border-2 border-transparent hover:border-rose-100"
                  >
                    إعادة ضبط الفلاتر
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* فئات سريعة */}
          <div className="flex overflow-x-auto gap-3 mt-4 sm:mt-6 no-scrollbar pb-2 pt-2 -mx-2 px-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilters({ ...filters, category: cat.id as any })}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-[1.25rem] whitespace-nowrap transition-all duration-300 border-2 snap-start ${filters.category === cat.id ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20 scale-[1.02]' : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300 hover:bg-slate-50 hover:-translate-y-0.5'
                  }`}
              >
                <cat.icon className={`w-4 h-4 ${filters.category === cat.id ? 'text-white' : 'text-slate-400'}`} />
                <span className="font-black text-sm">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== Mobile Alerts (Hot + Ending Soon) - يظهر فقط في الهاتف ===== */}
        <div className="lg:hidden space-y-10 mb-12">
          {/* 🔥 Hot */}
          {hotAuctions.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                  <span className="p-2 bg-red-100 text-red-600 rounded-xl">🔥</span> مزادات ساخنة
                </h3>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-2">
                {hotAuctions.map((auction) => (
                  <div key={auction._id} className="min-w-[260px] sm:min-w-[300px] snap-start">
                    <AuctionSidebarCard auction={auction} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ⏳ Ending Soon */}
          {endingSoonAuctions.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                  <span className="p-2 bg-amber-100 text-amber-600 rounded-xl">⏳</span> تنتهي قريبًا
                </h3>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-2">
                {endingSoonAuctions.map((auction) => (
                  <div key={auction._id} className="min-w-[260px] sm:min-w-[300px] snap-start">
                    <AuctionSidebarCard auction={auction} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 📅 Upcoming - يظهر دائما في الأعلى للكل */}
        {upcoming.length > 0 && filters.status !== AUCTION_STATUS.UPCOMING && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                <span className="p-2 bg-blue-100 text-blue-600 rounded-xl">📅</span> تبدأ قريباً
              </h3>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-2">
              {upcoming.map((auction) => (
                <div key={auction._id} className="min-w-[220px] sm:min-w-[260px] snap-start">
                  <AuctionCard auction={auction} compact />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ================= Layout ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* ===== العمود الرئيسي ===== */}
          <div className="lg:col-span-3">
            <div className="mb-8 flex items-center justify-between px-2">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
                المزادات المتاحة
                <span className="bg-slate-200 text-slate-600 text-sm px-3.5 py-1 rounded-full font-bold">
                  {auctions.length}
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-[2rem] h-[340px] animate-pulse border-2 border-slate-100 shadow-sm"
                  />
                ))}
              </div>
            ) : displayedAuctions.length === 0 ? (
              <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">عذراً، لم نجد ما تبحث عنه</h3>
                <p className="text-slate-500 font-medium">حاول تغيير كلمات البحث أو تخفيف الفلاتر المستخدمة</p>
                <button
                  onClick={resetFilters}
                  className="mt-6 font-bold text-primary hover:text-indigo-600 bg-primary/5 hover:bg-primary/10 px-6 py-2.5 rounded-full transition-colors"
                >
                  تحديث الفلاتر
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                {displayedAuctions.map((auction) => (
                  <AuctionCard key={auction._id} auction={auction} compact />
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex flex-wrap justify-center items-center gap-2 mt-16 pb-8">
                <button
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 sm:px-6 py-3 rounded-2xl border-2 border-slate-100 font-black text-sm sm:text-base disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  السابق
                </button>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .slice(
                    Math.max(0, pagination.page - 3),
                    pagination.page + 2
                  )
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`min-w-[48px] px-3 sm:px-4 py-3 rounded-2xl font-black border-2 border-transparent text-sm sm:text-base transition-all ${p === pagination.page
                        ? "bg-slate-900 text-white shadow-md hover:bg-slate-800"
                        : "bg-white text-slate-600 hover:bg-slate-50 border-slate-100 hover:border-slate-200"
                        }`}
                    >
                      {p}
                    </button>
                  ))}

                <button
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 sm:px-6 py-3 rounded-2xl border-2 border-slate-100 font-black text-sm sm:text-base disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  التالي
                </button>
              </div>
            )}
          </div>

          {/* ===== Sidebar (Desktop Only) ===== */}
          <aside className="hidden lg:block lg:col-span-1 space-y-10">
            {/* 🔥 Hot */}
            {hotAuctions.length > 0 && (
              <div>
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-red-100 text-red-600 rounded-lg text-sm">🔥</span> مزادات ساخنة
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {hotAuctions.map((auction) => (
                    <AuctionSidebarCard key={auction._id} auction={auction} />
                  ))}
                </div>
              </div>
            )}

            {/* ⏳ Ending Soon */}
            {endingSoonAuctions.length > 0 && (
              <div>
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg text-sm">⏳</span> تنتهي قريبًا
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {endingSoonAuctions.map((auction) => (
                    <AuctionSidebarCard key={auction._id} auction={auction} />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default HomeData;

