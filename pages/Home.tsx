
import React, { useEffect, useRef, useState } from 'react';

import { getAuctions, getUpcomingAuctions } from '../services/auction';
import { Auction, AuctionCategory, AUCTION_CATEGORIES, AuctionStatus } from '../types';
import AuctionCard from '../components/AuctionCard';
import AuctionSidebarCard from "../components/AuctionSidebarCard";
import {
  Car, Smartphone, Home as HomeIcon, LayoutGrid, Search,
  Filter, MapPin, Tag, ChevronDown, RefreshCw,
} from 'lucide-react';
import { Link } from "react-router-dom";
import { AUCTION_STATUS } from "../types";
import { useSearchParams } from "react-router-dom";
import { set } from 'mongoose';
import { formatNumber, cleanNumber } from "../utils/numberFormat";

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-in fade-in duration-500">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-900 via-primary-dark to-primary rounded-[2rem] sm:rounded-[2.5xl] p-6 sm:p-10 mb-8 sm:mb-10 text-white shadow-2xl relative overflow-hidden group">
        {/* Decorative Blur Circles */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-light/30 rounded-full blur-3xl group-hover:bg-primary-light/40 transition-colors duration-700"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-secondary/20 rounded-full blur-3xl group-hover:bg-secondary/30 transition-colors duration-700"></div>

        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black mb-3 sm:mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200">
            mazad - مزاد
          </h1>
          <p className="text-blue-100 text-base sm:text-lg md:text-xl max-w-2xl font-medium leading-relaxed">
            الوجهة الموثوقة للمزايدة المباشرة في العراق
          </p>
        </div>
      </div>
      {/* البحث والتصفية */}
      <div className="bg-surface rounded-3xl shadow-sm border border-slate-200/60 p-6 mb-10">
        <form onSubmit={handleSearchSubmit} className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow group">
              <Search className="h-5 w-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                className="block w-full pr-12 pl-4 py-4 border-2 border-slate-100 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700 placeholder:text-slate-400"
                placeholder="ابحث بالعنوان (مثال: تويوتا، آيفون، منزل...)"
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-black transition-all border-2 ${showFilters ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-slate-600 border-slate-100 hover:border-primary/30 hover:bg-slate-50'
                  }`}
              >
                <Filter className="w-5 h-5" />
                <span>تصفية</span>
              </button>
              <button
                type="submit"
                className="flex-1 md:flex-none bg-slate-900 text-white px-5 sm:px-8 py-3 sm:py-4 rounded-2xl font-black hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/20 transition-all active:scale-95"
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> المحافظة
                </label>
                <div className="relative">
                  <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl appearance-none outline-none focus:ring-2 focus:ring-primary font-bold text-slate-700"
                    value={filters.governorate}
                    onChange={(e) => setFilters({ ...filters, governorate: e.target.value })}
                  >
                    {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* السعر */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Tag className="w-3 h-3" /> نطاق السعر (د.ع)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="من"
                    className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm"
                    value={formatNumber(filters.minPrice)}
                    onChange={(e) => {
                      const clean = cleanNumber(e.target.value);
                      if (clean === "" || /^\d+$/.test(clean)) {
                        setFilters({ ...filters, minPrice: clean });
                      }
                    }}
                  />
                  <input
                    type="text"
                    placeholder="إلى"
                    className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm"
                    value={formatNumber(filters.maxPrice)}
                    onChange={(e) => {
                      const clean = cleanNumber(e.target.value);
                      if (clean === "" || /^\d+$/.test(clean)) {
                        setFilters({ ...filters, maxPrice: clean });
                      }
                    }}
                  />
                </div>
              </div>

              {/* حالة المزاد */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> حالة المزاد
                </label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-slate-700"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                >
                  <option value={AUCTION_STATUS.ACTIVE}>نشط حالياً</option>
                  <option value={AUCTION_STATUS.UPCOMING}>تبدأ قريباً</option>
                  <option value="ALL">الكل</option>
                </select>
              </div>

              {/* أزرار الإجراءات */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="w-full py-3 text-sm font-black text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  إعادة ضبط الفلاتر
                </button>
              </div>
            </div>
          )}
        </form>

        {/* فئات سريعة */}
        <div className="flex overflow-x-auto gap-3 mt-6 no-scrollbar pb-2 pt-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilters({ ...filters, category: cat.id as any })}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl whitespace-nowrap transition-all duration-300 border-2 ${filters.category === cat.id ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30 -translate-y-1 scale-[1.02]' : 'bg-white text-slate-600 border-slate-100 hover:border-primary/30 hover:bg-slate-50 hover:-translate-y-0.5'
                }`}
            >
              <cat.icon className={`w-5 h-5 ${filters.category === cat.id ? 'text-white' : 'text-primary'}`} />
              <span className="font-black text-sm">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>
      {/* ===== Mobile Alerts (Hot + Ending Soon) ===== */}
      <div className="lg:hidden space-y-6 mb-8">
        {/* 🔥 Hot */}
        {hotAuctions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                🔥 مزادات ساخنة
              </h3>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {hotAuctions.map((auction) => (
                <div key={auction._id} className="min-w-[200px] sm:min-w-[220px]">
                  <AuctionSidebarCard auction={auction} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ⏳ Ending Soon */}
        {endingSoonAuctions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                ⏳ تنتهي قريبًا
              </h3>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {endingSoonAuctions.map((auction) => (
                <div key={auction._id} className="min-w-[200px] sm:min-w-[220px]">
                  <AuctionSidebarCard auction={auction} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      {upcoming.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-black mb-4">
            مزادات تبدأ قريباً
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
            {upcoming.map((auction) => (
              <AuctionCard key={auction._id} auction={auction} compact />
            ))}
          </div>
        </section>
      )}

      {/* ================= Layout ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* ===== العمود الرئيسي ===== */}
        <div className="lg:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              المزادات المتاحة
              <span className="bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full">
                {auctions.length} نتيجة
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-[2rem] h-[340px] animate-pulse border border-slate-100"
                />
              ))}

            </div>
          ) : displayedAuctions.length === 0 ? (
            <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
              <h3 className="text-2xl font-black text-slate-900 mb-2">لا توجد نتائج</h3>
              <p className="text-slate-400">حاول تغيير البحث أو الفلاتر</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {displayedAuctions.map((auction) => (
                <AuctionCard key={auction._id} auction={auction} compact />
              ))}
            </div>
          )}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-wrap justify-center items-center gap-2 mt-8 sm:mt-10">

              <button
                disabled={!pagination.hasPrev}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 sm:px-4 py-2 rounded-lg border font-bold text-sm sm:text-base disabled:opacity-40"
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
                    className={`px-3 sm:px-4 py-2 rounded-lg font-bold border text-sm sm:text-base ${p === pagination.page
                      ? "bg-primary text-white"
                      : "bg-white"
                      }`}
                  >
                    {p}
                  </button>
                ))}

              <button
                disabled={!pagination.hasNext}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 sm:px-4 py-2 rounded-lg border font-bold text-sm sm:text-base disabled:opacity-40"
              >
                التالي
              </button>

            </div>
          )}
        </div>

        {/* ===== Sidebar ===== */}
        {/* Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 space-y-10">
          {/* Hot scroll عمودي */}
          {hotAuctions.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                🔥 مزادات ساخنة
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {hotAuctions.map((auction) => (
                  <AuctionSidebarCard key={auction._id} auction={auction} />
                ))}
              </div>
            </div>
          )}

          {/* Ending soon scroll عمودي */}
          {endingSoonAuctions.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                ⏳ تنتهي قريبًا
              </h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {endingSoonAuctions.map((auction) => (
                  <AuctionSidebarCard key={auction._id} auction={auction} />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default HomeData;

