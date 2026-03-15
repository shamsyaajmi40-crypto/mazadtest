import React, { useState, useContext, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { createAuction, getCreateAuctionDepositPreview, featureAuction } from "../services/auction";
import type { AuctionCategory } from "../types";
import { AUCTION_CATEGORIES } from "../types";
import {
  Upload, Loader2, PlusCircle, X, Info,
  Type, LayoutGrid, Tag, TrendingUp, Clock,
  CalendarClock, MapPin, AlignRight, Image as ImageIcon,
  CheckCircle2, ShieldCheck, Wallet, Camera
} from "lucide-react";
import TermsModal from "../components/TermsModal";
import { compressImage } from "../utils/imageCompression";
import { formatNumber, cleanNumber } from "../utils/numberFormat";

interface ImageFile {
  file: File;
  preview: string;
}

const GOVERNORATES = [
  'الكل', 'بغداد', 'البصرة', 'نينوى', 'أربيل', 'السليمانية', 'دهوك', 'كركوك',
  'الأنبار', 'ديالى', 'بابل', 'كربلاء', 'النجف', 'صلاح الدين', 'واسط',
  'القادسية', 'ميسان', 'المثنى', 'ذي قار'
];

const CreateAuction = () => {
  const { user, refreshUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [sellerDeposit, setSellerDeposit] = useState<number | null>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [showCreateTermsModal, setShowCreateTermsModal] = useState(false);

  // Feature upsell state
  const [wantsFeature, setWantsFeature] = useState(false);
  const [featureOption, setFeatureOption] = useState('1d');
  const featurePrices: Record<string, number> = { '1d': 3000, '3d': 7000, '7d': 15000 };

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: AUCTION_CATEGORIES.CARS as AuctionCategory,
    startPrice: "",
    increment: "25000",
    duration: "24",
    governorate: "بغداد",
    startTime: "",
  });

  useEffect(() => {
    refreshUser().catch(err => console.error("Failed to refresh user:", err));
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview));
    };
  }, []);

  useEffect(() => {
    const price = Number(formData.startPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setSellerDeposit(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setDepositLoading(true);
        const data = await getCreateAuctionDepositPreview(price);
        if (!cancelled) setSellerDeposit(Number(data?.sellerDeposit || 0));
      } catch {
        if (!cancelled) setSellerDeposit(null);
      } finally {
        if (!cancelled) setDepositLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.startPrice]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newImages: ImageFile[] = files.map((file) => {
      const f = file as File;
      return { file: f, preview: URL.createObjectURL(f) };
    });
    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title.trim()) {
      alert("عنوان المزاد مطلوب");
      return;
    }

    if (images.length === 0) {
      alert("يرجى رفع صورة واحدة على الأقل");
      return;
    }

    if (sellerDeposit !== null && user) {
      if ((user.balance || 0) < sellerDeposit) {
        alert(`عذراً، رصيدك غير كافٍ لإنشاء مزاد. يتطلب نشر هذا المزاد حجز عربون جدية بقيمة ${sellerDeposit.toLocaleString()} د.ع.`);
        return;
      }
    } else if (sellerDeposit === null && !loading) {
      alert("يرجى الانتظار حتى يتم حساب عربون المزاد، أو التأكد من السعر الافتتاحي.");
      return;
    }

    setShowCreateTermsModal(true);
  };

  const executeSubmit = async () => {
    setLoading(true);

    try {
      const data = new FormData();

      data.append("title", formData.title);
      if (formData.startTime) {
        const startTime = new Date(formData.startTime);
        if (Number.isNaN(startTime.getTime())) {
          alert("وقت بدء المزاد غير صالح");
          setLoading(false);
          return;
        }
        data.append("startTime", startTime.toISOString());
      }
      data.append("governorate", formData.governorate);
      data.append("description", formData.description);
      data.append("category", formData.category);
      data.append("startPrice", String(Number(formData.startPrice)));
      data.append("increment", String(Number(formData.increment)));
      data.append("duration", String(Number(formData.duration)));

      const compressedImages = await Promise.all(
        images.map(img => compressImage(img.file, 1200, 0.7))
      );
      compressedImages.forEach((file) => {
        data.append("images", file);
      });

      const res = await createAuction(data);

      // Feature the auction after creation if the user opted-in
      if (wantsFeature && res?.data?._id) {
        try {
          await featureAuction(res.data._id, featureOption);
        } catch (featureErr: any) {
          alert(`تم نشر المزاد ولكن فشل التمييز: ${featureErr?.response?.data?.message || ''}`);
        }
      }

      alert("تم إرسال المزاد بنجاح، بانتظار موافقة الإدارة");
      navigate("/");
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || "فشل إنشاء المزاد");
    } finally {
      setLoading(false);
      setShowCreateTermsModal(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">

      {/* Hero Section / Header */}
      <div className="bg-gradient-to-br from-slate-900 via-primary-dark to-primary rounded-[2.5xl] p-10 mb-10 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-light/30 rounded-full blur-3xl group-hover:bg-primary-light/40 transition-colors duration-700"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-secondary/20 rounded-full blur-3xl group-hover:bg-secondary/30 transition-colors duration-700"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-right">
          <div className="bg-white/10 p-5 rounded-[2rem] backdrop-blur-md border border-white/20 shadow-inner">
            <PlusCircle className="w-12 h-12 text-white" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100">
              إنشاء مزاد جديد
            </h1>
            <p className="text-blue-100/90 text-lg md:text-xl font-medium max-w-xl">
              أدخل تفاصيل سلعتك، وحدد الوقت المناسب، وابدأ المزايدة مع آلاف المشترين المحتملين.
            </p>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <form
        onSubmit={handlePreSubmit}
        className="bg-white rounded-[2.5xl] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-12 space-y-10 relative"
      >
        {/* Section 1: Basic Info */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
            <h2 className="text-xl font-black text-slate-800">المعلومات الأساسية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Title */}
            <div className="space-y-3 md:col-span-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Type className="w-4 h-4 text-primary" /> عنوان المزاد
              </label>
              <input
                type="text"
                required
                placeholder="مثال: سيارة تويوتا كامري 2023 بحالة ممتازة"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700 placeholder:text-slate-400"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            {/* Category */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-primary" /> القسم
              </label>
              <div className="relative">
                <select
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as AuctionCategory })}
                >
                  {Object.values(AUCTION_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Governorate */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> المحافظة
              </label>
              <div className="relative">
                <select
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700"
                  value={formData.governorate}
                  onChange={(e) => setFormData({ ...formData, governorate: e.target.value })}
                >
                  {GOVERNORATES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Pricing & Timing */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
            <h2 className="text-xl font-black text-slate-800">التسعير والوقت</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Start Price */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" /> السعر الابتدائي (د.ع)
              </label>
              <div className="relative">
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">
                  د.ع
                </div>
                <input
                  type="text"
                  required
                  placeholder="مثال: 5,000,000"
                  className="w-full px-5 py-4 pr-16 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700 placeholder:text-slate-400"
                  value={formatNumber(formData.startPrice)}
                  onChange={(e) => {
                    const clean = cleanNumber(e.target.value);
                    if (clean === "" || /^\d+$/.test(clean)) {
                      setFormData({ ...formData, startPrice: clean });
                    }
                  }}
                />
              </div>
            </div>

            {/* Increment */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> مقدار المزايدة
              </label>
              <div className="relative">
                <select
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700"
                  value={formData.increment}
                  onChange={(e) => setFormData({ ...formData, increment: e.target.value })}
                >
                  <option value="1000">1,000 د.ع</option>
                  <option value="5000">5,000 د.ع</option>
                  <option value="10000">10,000 د.ع</option>
                  <option value="25000">25,000 د.ع</option>
                  <option value="50000">50,000 د.ع</option>
                  <option value="100000">100,000 د.ع</option>
                </select>
              </div>
            </div>

            {/* Start Time */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" /> وقت بدء المزاد
              </label>
              <input
                type="datetime-local"
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
              <p className="text-xs text-slate-500">اختياري: اتركه فارغًا لنشر المزاد مباشرة بعد الموافقة.</p>
            </div>

            {/* Duration */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> مدة المزاد
              </label>
              <div className="relative">
                <select
                  required
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl appearance-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                >
                  <option value="" disabled>اختر مدة المزاد</option>
                  <option value="1">1 ساعة</option>
                  <option value="6">6 ساعات</option>
                  <option value="12">12 ساعة</option>
                  <option value="24">24 ساعة</option>
                  <option value="72">3 أيام</option>
                </select>
              </div>
            </div>

            {/* Deposit Preview */}
            <div className={`md:col-span-2 rounded-[2rem] border-2 transition-all duration-500 overflow-hidden relative ${sellerDeposit === null ? 'bg-slate-50 border-slate-100 p-6' : 'bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 border-indigo-100 shadow-xl shadow-indigo-500/5 p-8'}`}>
              {sellerDeposit !== null && (
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl transition-colors ${sellerDeposit === null ? 'bg-slate-200/50 text-slate-400' : 'bg-indigo-100 text-indigo-600'}`}>
                    {depositLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className={`text-sm font-black uppercase tracking-wider mb-1 ${sellerDeposit === null ? 'text-slate-400' : 'text-indigo-900'}`}>
                      عربون دخول المزاد
                    </h4>
                    <p className={`text-xs font-bold leading-relaxed max-w-sm ${sellerDeposit === null ? 'text-slate-400' : 'text-indigo-700/80'}`}>
                      {sellerDeposit === null
                        ? "أنتظر إدخال السعر الابتدائي لحساب قيمة التأمين المطلوبة."
                        : "هذا المبلغ يتم حجزه مؤقتاً لضمان جدية المزاد، ويُعاد لمحفظتك فور إتمامك عملية البيع بنجاح."}
                    </p>
                  </div>
                </div>

                {sellerDeposit !== null && (
                  <div className="flex flex-col items-center md:items-end gap-1 shrink-0">
                    <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-lg shadow-indigo-200 flex items-baseline gap-2 group hover:scale-105 transition-transform duration-300">
                      <span className="text-2xl font-black">{(Number(sellerDeposit || 0)).toLocaleString()}</span>
                      <span className="text-[10px] font-bold opacity-80">د.ع</span>
                    </div>
                    <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-3 h-3" /> مسترد بالكامل
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 mt-0.5">
                      رصيدك الحالي: <span className={`font-black ${(user?.balance || 0) >= Number(sellerDeposit) ? 'text-emerald-600' : 'text-rose-500'}`}>{(user?.balance || 0).toLocaleString()} د.ع</span>
                    </span>
                  </div>
                )}

                {depositLoading && sellerDeposit === null && (
                  <div className="flex items-center gap-2 text-indigo-600 text-xs font-black animate-pulse">
                    <span>جاري الحساب...</span>
                  </div>
                )}
              </div>

              {sellerDeposit !== null && (user?.balance || 0) < Number(sellerDeposit) && (
                <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Info className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black text-rose-700 mb-0.5">رصيدك غير كافٍ</p>
                      <p className="text-xs font-bold text-rose-600">
                        رصيدك الحالي: <span className="font-black">{(user?.balance || 0).toLocaleString()} د.ع</span>
                        &nbsp;—&nbsp;
                        تحتاج: <span className="font-black">{(Number(sellerDeposit) - (user?.balance || 0)).toLocaleString()} د.ع</span> إضافية
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/wallet"
                    className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all shrink-0 shadow-md shadow-rose-200 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Wallet className="w-4 h-4" />
                    شحن المحفظة
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Details & Media */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
            <h2 className="text-xl font-black text-slate-800">التفاصيل والصور</h2>
          </div>

          <div className="space-y-8">
            {/* Description */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <AlignRight className="w-4 h-4 text-primary" /> وصف المزاد
              </label>
              <textarea
                required
                placeholder="اكتب وصفاً دقيقاً لسلعتك يشمل جميع التفاصيل المواصفات وحالة السلعة..."
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all duration-300 font-bold text-slate-700 placeholder:text-slate-400 min-h-[160px] resize-y"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Images Upload */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" /> صور السلعة
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Image Gallery Upload */}
                <div className="relative border-2 border-dashed border-primary/30 bg-primary/5 rounded-3xl p-6 hover:bg-primary/10 transition-colors text-center group cursor-pointer overflow-hidden">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md mb-3 group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-base font-black text-slate-800 mb-1">رفع من الاستوديو</h3>
                    <p className="text-xs text-slate-500">اختر صوراً من جهازك</p>
                  </div>
                </div>

                {/* Direct Camera Capture */}
                <div className="relative border-2 border-dashed border-indigo-500/30 bg-indigo-50/50 rounded-3xl p-6 hover:bg-indigo-50 transition-colors text-center group cursor-pointer overflow-hidden">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md mb-3 group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-base font-black text-slate-800 mb-1">التقاط بالكاميرا</h3>
                    <p className="text-xs text-slate-500">صوّر السلعة مباشرة</p>
                  </div>
                </div>
              </div>

              {images.length > 0 && (
                <div className="mt-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    الصور المرفوعة ({images.length})
                  </h4>
                  <div className="flex flex-wrap gap-4">
                    {images.map((img, i) => (
                      <div
                        key={i}
                        className="relative w-28 h-28 rounded-2xl overflow-hidden shadow-md group/img"
                      >
                        <img
                          src={img.preview}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110"
                          alt="Preview"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                          <button
                            type="button"
                            onClick={() => removeImage(i)}
                            className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 hover:scale-110 transition-all z-20"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Feature Upsell */}
        <div className="space-y-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">4</div>
            <h2 className="text-xl font-black text-slate-800">التمييز المدفوع (اختياري)</h2>
          </div>

          <div className={`rounded-[2rem] border-2 p-6 transition-all ${wantsFeature ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50' : 'border-slate-100 bg-slate-50'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⭐</span>
                <div>
                  <h3 className="text-base font-black text-slate-800">ميّز مزادك وزد ظهوره</h3>
                  <p className="text-xs font-medium text-slate-500">اجعله يظهر في الصفحة الرئيسية وأعلى نتائج البحث</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWantsFeature(v => !v)}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${wantsFeature ? 'bg-amber-500' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${wantsFeature ? 'left-8' : 'left-1'}`} />
              </button>
            </div>

            {wantsFeature && (
              <div className="space-y-3 pt-4 border-t border-amber-200/50">
                <p className="text-xs font-bold text-amber-700">اختر مدة التمييز:</p>
                {[
                  { id: '1d', label: '24 ساعة', price: 3000 },
                  { id: '3d', label: '3 أيام', price: 7000 },
                  { id: '7d', label: '7 أيام', price: 15000 },
                ].map(tier => (
                  <label
                    key={tier.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all bg-white ${featureOption === tier.id ? 'border-amber-400 shadow-md shadow-amber-100' : 'border-slate-100 hover:border-slate-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="featureOption"
                        value={tier.id}
                        checked={featureOption === tier.id}
                        onChange={(e) => setFeatureOption(e.target.value)}
                        className="w-5 h-5 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="font-bold text-slate-700">{tier.label}</span>
                    </div>
                    <span className="font-black text-slate-900">{tier.price.toLocaleString()} د.ع</span>
                  </label>
                ))}
                <p className="text-xs text-amber-600 font-bold flex items-start gap-1 pt-2">
                  <span>⚠️</span>
                  <span>سيتم خصم تكلفة التمييز ({featurePrices[featureOption].toLocaleString()} د.ع) بعد موافقة الإدارة ونشر المزاد.</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Warning / Submit */}
        <div className="pt-6 border-t border-slate-100">
          <div className="bg-amber-50 border border-amber-200/50 p-5 rounded-2xl flex items-start gap-4 mb-8">
            <div className="bg-amber-100 p-2 rounded-full mt-0.5">
              <Info className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 mb-1">مراجعة الإدارة</h4>
              <p className="text-sm text-amber-700 font-medium">
                سيتم إرسال المزاد للمراجعة من قبل الإدارة للتأكد من توافقه مع الشروط والأحكام. سيتم إشعارك فور الموافقة عليه ونشره.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-lg hover:bg-slate-800 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] skew-x-[-15deg] group-hover:animate-[shimmer_1.5s_infinite]"></div>
            {loading ? (
              <span className="flex items-center justify-center gap-3 relative z-10">
                <Loader2 className="w-6 h-6 animate-spin" />
                {images.length > 3 ? "جاري تصغير الصور والرفع..." : "جاري المعالجة والإرسال..."}
              </span>
            ) : (
              <span className="relative z-10 flex items-center justify-center gap-2">
                نشر المزاد للمراجعة <PlusCircle className="w-5 h-5" />
              </span>
            )}
          </button>
        </div>
      </form>

      {/* نافذة الموافقة على شروط النشر */}
      <TermsModal
        isOpen={showCreateTermsModal}
        onClose={() => !loading && setShowCreateTermsModal(false)}
        title="تأكيد نشر المزاد"
        description={
          <>
            بمجرد النشر، سيتم خصم <strong>عربون النشر</strong> وقدره ({(sellerDeposit || 0).toLocaleString()} د.ع) من محفظتك كضمان التزامك بإتمام عملية البيع بجدية عند فوز أحد المشترين، وسيتم إرجاعه لك بعد تسليمك القطعة بنجاح.
          </>
        }
        termsList={[
          "إنشائك للمزاد يعتبر إقراراً بملكيتك للسلعة وصحة المعلومات المذكورة فيها.",
          "في حال رفضك أو عدم جاهزيتك لتسليم القطعة للمزايد الفائز، سيتم خصم عربون النشر وعدم إرجاعه لك.",
          "يحق لإدارة المنصة رفض المزاد إذا كان يخالف القوانين أو لا يتوفر على وصف كافٍ.",
          "تُقر بأنك ستتعاون مع شركة التوصيل المعتمدة من المنصة لإتمام البيع، والتسليم سيكون في وقت مناسب."
        ]}
        actionLabel="موافق ونشر المزاد"
        isLoading={loading}
        onAccept={executeSubmit}
      />
    </div>
  );
};

export default CreateAuction;
