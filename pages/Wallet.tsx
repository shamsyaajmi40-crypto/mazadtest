import React, { useEffect, useState, useContext } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { formatNumber, cleanNumber } from "../utils/numberFormat";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Info,
  Loader2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  FileCheck,
  Eye,
  EyeOff,
  CalendarDays,
  Copy
} from "lucide-react";
import toast from "react-hot-toast";

const formatCurrency = (n: any) => `${Number(n || 0).toLocaleString("en-US")} د.ع`;

export default function Wallet() {
  const { user, refreshUser } = useContext(AuthContext);

  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundInfo, setRefundInfo] = useState<string>("");

  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState<"ACTIVITY" | "TOPUP" | "REFUND">("ACTIVITY");

  const showErr = (msg: string) => {
    setErr(msg);
    setTimeout(() => setErr(""), 4000);
  };
  const showOk = (msg: string) => {
    setOk(msg);
    setTimeout(() => setOk(""), 4000);
  };

  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    refreshUser?.();

    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "1" || params.get("paid") === "1") {
      showOk("تمت التعبئة بنجاح ✅");
      refreshUser?.();
    } else if (params.get("paid") === "0") {
      showErr("فشلت عملية الدفع أو تم إلغاؤها");
    }

    const searchQuery = params.get("search");
    loadLogs(searchQuery);
    if (searchQuery) setActiveTab("ACTIVITY");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLogs = async (searchQuery?: string | null) => {
    try {
      setLoadingLogs(true);
      const { data } = await api.get("/users/me/financial-logs");
      let filtered = data;
      if (searchQuery) {
        filtered = data.filter((l: any) =>
          String(l.refId || "").includes(searchQuery) ||
          String(l.receiptId || "").includes(searchQuery)
        );
      }
      setLogs(filtered);
    } catch (e) {
      console.error("loadLogs error:", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const startTopup = async () => {
    const a = Number(topupAmount || 0);
    if (!Number.isFinite(a) || a <= 0) return showErr("أدخل مبلغ تعبئة صحيح");
    if (a < 1000) return showErr("الحد الأدنى للتعبئة 1000 د.ع");

    try {
      setSubmittingTopup(true);
      const { data } = await api.post("/payments/zaincash/topup/init", { amountIQD: a });
      window.location.href = data.paymentUrl;
    } catch (e: any) {
      showErr(e?.response?.data?.message || e?.message || "فشل بدء التعبئة عبر زين كاش");
    } finally {
      setSubmittingTopup(false);
    }
  };

  const submitRefundRequest = async () => {
    const a = Number(refundAmount || 0);
    if (a <= 0) return showErr("أدخل مبلغ استرجاع صحيح");
    if (a > Number(user?.balance || 0)) return showErr("لا يمكنك استرجاع مبلغ أكبر من الرصيد المتاح");
    if (!refundInfo.trim()) return showErr("أدخل معلومات الاسترجاع");

    try {
      setSubmittingRefund(true);
      await api.post("/wallet/refund-request", { amountIQD: a, payoutInfo: refundInfo.trim() });
      showOk("تم إرسال طلب الاسترجاع ✅");
      setRefundAmount(0);
      setRefundInfo("");
      refreshUser?.();
    } catch (e: any) {
      showErr(e?.response?.data?.message || "فشل إرسال طلب الاسترجاع");
    } finally {
      setSubmittingRefund(false);
    }
  };

  const available = Number(user?.balance || 0);
  const held = Number(user?.heldBalance || 0);
  const total = available + held;

  const quickAmounts = [10000, 25000, 50000, 100000, 250000];

  const handleCopyReceipt = (rid: string) => {
    navigator.clipboard.writeText(rid);
    toast.success("تم نسخ رقم الوصل");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-700 font-sans" dir="rtl">
      {/* Header with Privacy Toggle */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">المحفظة</h1>
            <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              نظام مالي آمن
            </div>
          </div>
          <p className="text-slate-500 font-bold">إدارة رصيدك، تعبئة المحفظة، وسجل العمليات المالية</p>
        </div>
        
        <button 
          onClick={() => setIsPrivate(!isPrivate)}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all font-bold text-sm text-slate-600"
        >
          {isPrivate ? (
            <><Eye className="w-4 h-4" /> إظهار المبالغ</>
          ) : (
            <><EyeOff className="w-4 h-4" /> إخفاء المبالغ</>
          )}
        </button>
      </div>

      {/* Modern Balance Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
        {/* Main Total Card */}
        <div className="md:col-span-12 lg:col-span-5 relative overflow-hidden group p-8 rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border border-white/5">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-10">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 backdrop-blur-xl shadow-inner">
                <WalletIcon className="w-7 h-7 text-white" />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">الرقم المالي للمستخدم</span>
                <span className="text-xs font-mono text-slate-300">USER-{user?._id?.slice(-8).toUpperCase()}</span>
              </div>
            </div>
            
            <p className="text-sm font-bold text-slate-400 mb-2">إجمالي الرصيد المحفوظ</p>
            <h2 className="text-5xl font-black tracking-tighter mb-8 leading-none">
              {isPrivate ? "••••••••" : formatCurrency(total)}
            </h2>
            
            <div className="flex items-center gap-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span className="text-xs font-bold text-slate-300">نشط</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span className="text-xs font-bold text-slate-300">محمي بالكامل</span>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Cards Wrapper */}
        <div className="md:col-span-12 lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Available */}
          <div className="bg-white group p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 transition-all hover:scale-[1.02] hover:border-emerald-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-inner">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <div className="relative cursor-help" title="الرصيد الذي يمكنك استخدامه للمزايدة أو سحبه">
                  <Info className="w-4 h-4 text-slate-300 hover:text-slate-400 transition-colors" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 mb-1">الرصيد المتاح</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                {isPrivate ? "•••••" : formatCurrency(available)}
              </h3>
            </div>
            <div className="mt-6 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl w-fit border border-emerald-100/50">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-black text-emerald-700">جاهز للاستخدام</span>
            </div>
          </div>

          {/* Held */}
          <div className="bg-white group p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 transition-all hover:scale-[1.02] hover:border-amber-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shadow-inner">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="relative cursor-help" title="مبالغ محجوزة كتأمين للمزادات النشطة">
                  <Info className="w-4 h-4 text-slate-300 hover:text-slate-400 transition-colors" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 mb-1">الرصيد المحجوز</p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                {isPrivate ? "•••••" : formatCurrency(held)}
              </h3>
            </div>
            <div className="mt-6 flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-xl w-fit border border-amber-100/50">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-black text-amber-700">مبالغ ضمان</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden min-h-[600px] flex flex-col mb-20">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch border-b border-slate-100">
          <button 
            onClick={() => setActiveTab("ACTIVITY")}
            className={`flex-1 py-6 px-4 flex items-center justify-center gap-3 transition-all font-black text-sm relative ${activeTab === "ACTIVITY" ? "text-primary bg-primary/5" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
          >
            <TrendingUp className={`w-5 h-5 ${activeTab === "ACTIVITY" ? "text-primary" : "text-slate-400"}`} />
            النشاط المالي
            {activeTab === "ACTIVITY" && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full"></div>}
          </button>
          
          <button 
            onClick={() => setActiveTab("TOPUP")}
            className={`flex-1 py-6 px-4 flex items-center justify-center gap-3 transition-all font-black text-sm relative ${activeTab === "TOPUP" ? "text-primary bg-primary/5" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
          >
            <ArrowUpRight className={`w-5 h-5 ${activeTab === "TOPUP" ? "text-primary" : "text-slate-400"}`} />
            تعبئة رصيد
            {activeTab === "TOPUP" && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full"></div>}
          </button>
          
          <button 
            onClick={() => setActiveTab("REFUND")}
            className={`flex-1 py-6 px-4 flex items-center justify-center gap-3 transition-all font-black text-sm relative ${activeTab === "REFUND" ? "text-primary bg-primary/5" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
          >
            <ArrowDownLeft className={`w-5 h-5 ${activeTab === "REFUND" ? "text-primary" : "text-slate-400"}`} />
            سحب / استرجاع
            {activeTab === "REFUND" && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full"></div>}
          </button>
        </div>

        {/* Tab Content Rendering */}
        <div className="flex-1 p-6 sm:p-10 relative">
          
          {/* TAB: ACTIVITY (Modern List) */}
          {activeTab === "ACTIVITY" && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="flex items-center justify-between mb-8">
                 <h3 className="text-xl font-black text-slate-800">أحدث العمليات</h3>
                 <button 
                  onClick={() => loadLogs()}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400"
                 >
                   <Loader2 className={`w-5 h-5 ${loadingLogs ? "animate-spin" : ""}`} />
                 </button>
               </div>

               <div className="space-y-4">
                 {loadingLogs ? (
                   <div className="py-20 flex flex-col items-center justify-center">
                     <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                     <p className="text-slate-400 font-bold">جاري تحميل المعاملات...</p>
                   </div>
                 ) : logs.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <TrendingUp className="w-10 h-10 text-slate-200" />
                      </div>
                      <p className="text-slate-400 font-black text-lg">لا توجد عمليات مسجلة</p>
                      <p className="text-slate-300 text-sm font-bold">ابدأ بتعبئة رصيدك للمشاركة في المزادات</p>
                    </div>
                 ) : (
                    logs.map((log) => {
                      const isPositive = ['WALLET_TOPUP_PAID', 'DEPOSIT_REFUND', 'REFUND_REQUEST_REJECTED', 'COD_SELLER_PAYOUT', 'COD_DELIVERY_FEE'].includes(log.type);
                      const isNeutral = ['REFUND_REQUEST_APPROVED', 'REFUND_REQUEST_CREATED'].includes(log.type);
                      
                      return (
                        <div key={log._id} className="group p-5 bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-200 rounded-[2rem] transition-all duration-300 flex flex-col sm:flex-row items-center gap-6">
                          <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center ${isPositive ? 'bg-emerald-100 text-emerald-600' : isNeutral ? 'bg-slate-100 text-slate-500' : 'bg-rose-100 text-rose-600'}`}>
                            {isPositive ? <ArrowUpRight className="w-7 h-7" /> : isNeutral ? <Info className="w-7 h-7" /> : <ArrowDownLeft className="w-7 h-7" />}
                          </div>
                          
                          <div className="flex-1 text-center sm:text-right">
                            <h4 className="font-black text-slate-800 mb-1">
                               {log.type === 'WALLET_TOPUP_PAID' ? 'تعبئة رصيد ناجحة' :
                                log.type === 'REFUND_REQUEST_APPROVED' ? 'استرجاع رصيد معتمد' :
                                log.type === 'REFUND_REQUEST_CREATED' ? 'طلب استرجاع (قيد المراجعة)' :
                                log.type === 'REFUND_REQUEST_REJECTED' ? 'طلب استرجاع مرفوض' :
                                log.type === 'DEPOSIT_REFUND' ? 'إرجاع عربون لمزاد' :
                                log.type === 'DEPOSIT_CONFISCATE' ? 'مصادرة عربون' :
                                log.type === 'DEPOSIT_HOLD' ? 'حجز ضمان لمزاد' :
                                log.type === 'PLATFORM_COMMISSION' ? 'عمولة المنصة' : log.type.split('_').join(' ')}
                            </h4>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                {new Date(log.createdAt).toLocaleDateString('ar-IQ')}
                              </span>
                              <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors group/copy" onClick={() => handleCopyReceipt(log.receiptId || 'MZ-SYS')}>
                                <ShieldCheck className="w-3 h-3 text-blue-500" />
                                <span className="text-[10px] font-mono font-bold text-slate-400 group-hover/copy:text-primary">{log.receiptId || 'MZ-SYSTEM'}</span>
                                <Copy className="w-3 h-3 opacity-0 group-hover/copy:opacity-100" />
                              </div>
                            </div>
                          </div>

                          <div className="text-center sm:text-left min-w-[120px]">
                            <span className={`text-xl font-black tabular-nums ${isPositive ? 'text-emerald-600' : isNeutral ? 'text-slate-500' : 'text-rose-600'}`}>
                              {isPositive ? '+' : (isNeutral ? '' : '-')} {isPrivate ? "•••" : formatCurrency(log.amount)}
                            </span>
                          </div>
                        </div>
                      )
                    })
                 )}
               </div>
            </div>
          )}

          {/* TAB: TOPUP */}
          {activeTab === "TOPUP" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto py-6">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-blue-100 text-blue-600 shadow-inner">
                  <CreditCard className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">تعبئة المحفظة</h3>
                <p className="text-slate-500 font-bold">اشحن رصيدك فوراً وبأمان عبر بوابة زين كاش</p>
              </div>

              <div className="space-y-8">
                {/* Inputs */}
                <div>
                   <label className="block text-sm font-black text-slate-600 mb-4 mr-2">إختر مبلغاً أو أدخل يدوياً</label>
                   
                   {/* Quick Amounts */}
                   <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
                     {quickAmounts.map(amt => (
                       <button
                        key={amt}
                        onClick={() => setTopupAmount(amt)}
                        className={`py-3 rounded-2xl font-black text-xs transition-all border-2 ${topupAmount === amt ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105' : 'bg-white text-slate-600 border-slate-100 hover:border-primary/30 hover:bg-slate-50'}`}
                       >
                         {Number(amt/1000).toLocaleString()}K
                       </button>
                     ))}
                   </div>

                   <div className="relative">
                      <input
                        value={formatNumber(topupAmount)}
                        onChange={(e) => {
                          const clean = cleanNumber(e.target.value);
                          if (clean === "" || /^\d+$/.test(clean)) setTopupAmount(Number(clean) || 0);
                        }}
                        type="text"
                        placeholder="مثال: 25,000"
                        className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-8 focus:ring-primary/5 focus:border-primary focus:bg-white outline-none transition-all font-black text-3xl text-slate-800 placeholder:text-slate-200 text-center"
                      />
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">د.ع</span>
                   </div>
                </div>

                <button
                  onClick={startTopup}
                  disabled={submittingTopup}
                  className="w-full py-6 bg-primary hover:bg-primary-dark disabled:bg-slate-300 text-white rounded-[2rem] shadow-2xl shadow-primary/30 transition-all font-black text-xl flex items-center justify-center gap-4 group"
                >
                  {submittingTopup ? <Loader2 className="w-8 h-8 animate-spin" /> : (
                    <>
                      <span>شحن المحفظة الآن</span>
                      <ArrowUpRight className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </>
                  )}
                </button>

                <div className="flex flex-col items-center gap-4 py-8 border-t border-slate-100">
                  <div className="flex items-center gap-2 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <img src="https://static.zaincash.iq/portal/assets/images/logo.png" alt="ZainCash" className="h-4" />
                    <span className="text-[10px] font-black text-slate-400">بوابة الدفع المعتمدة</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 max-w-xs text-center leading-relaxed">بضغطك على شحن، سيتم توجيهك للموقع الرسمي لبوابة زين كاش لإتمام عملية الدفع بأمان تام.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: REFUND */}
          {activeTab === "REFUND" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto py-6">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-100 text-amber-600 shadow-inner">
                  <ArrowDownLeft className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">طلب سحب رصيد</h3>
                <p className="text-slate-500 font-bold">يمكنك سحب الرصيد المتاح إلى محفظتك في أي وقت</p>
              </div>

              <div className="space-y-8">
                <div>
                   <div className="flex justify-between items-center mb-4 mr-2">
                     <label className="block text-sm font-black text-slate-600">المبلغ المراد سحبه</label>
                     <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">المتاح: {formatCurrency(available)}</span>
                   </div>
                   <div className="relative">
                      <input
                        value={formatNumber(refundAmount)}
                        onChange={(e) => {
                          const clean = cleanNumber(e.target.value);
                          if (clean === "" || /^\d+$/.test(clean)) setRefundAmount(Number(clean) || 0);
                        }}
                        type="text"
                        placeholder="أدخل مبلغ الاسترجاع"
                        className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500 focus:bg-white outline-none transition-all font-black text-3xl text-slate-800 placeholder:text-slate-200 text-center"
                      />
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black text-slate-400 text-lg">د.ع</span>
                   </div>
                </div>

                <div>
                   <label className="block text-sm font-black text-slate-600 mb-4 mr-2">معلومات التحويل (رقم زين كاش)</label>
                   <textarea
                     value={refundInfo}
                     onChange={(e) => setRefundInfo(e.target.value)}
                     rows={3}
                     placeholder="أدخل رقم الهاتف المرتبط بمحفظة زين كاش التي تود الاستلام عليها.."
                     className="w-full px-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500 focus:bg-white outline-none transition-all font-bold text-sm text-slate-800 placeholder:text-slate-300 resize-none"
                   />
                </div>

                <button
                  onClick={submitRefundRequest}
                  disabled={submittingRefund}
                  className="w-full py-6 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-[2rem] shadow-2xl shadow-slate-900/10 transition-all font-black text-xl flex items-center justify-center gap-4 group"
                >
                  {submittingRefund ? <Loader2 className="w-8 h-8 animate-spin" /> : (
                    <>
                      <span>تقديم طلب السحب</span>
                      <CheckCircle2 className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                  )}
                </button>

                <div className="p-6 bg-amber-50 border border-amber-100 rounded-[2rem] flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex-shrink-0 flex items-center justify-center text-amber-600">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-amber-800 mb-1">ملاحظة بخصوص الاسترجاع</h5>
                    <p className="text-[10px] font-bold text-amber-700/80 leading-relaxed">يتم معالجة مبالغ الاسترجاع يدوياً من قبل قسم المالية للتأكد من سلامة العمليات، وتصل لمحفظتك خلال فترة 24-48 ساعة عمل كحد أقصى.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Persistence Messages */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 w-full max-w-md px-4 pointer-events-none">
        {err && (
          <div className="bg-white/95 backdrop-blur-md border-2 border-rose-100 p-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-5 animate-in slide-in-from-bottom-10 pointer-events-auto" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0 shadow-inner">
              <AlertCircle className="w-7 h-7" />
            </div>
            <p className="text-sm font-black text-rose-600">{err}</p>
          </div>
        )}
        {ok && (
          <div className="bg-white/95 backdrop-blur-md border-2 border-emerald-100 p-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex items-center gap-5 animate-in slide-in-from-bottom-10 pointer-events-auto" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0 shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <p className="text-sm font-black text-emerald-600">{ok}</p>
          </div>
        )}
      </div>
    </div>
  );
}
