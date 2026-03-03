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
  CreditCard
} from "lucide-react";

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

  useEffect(() => {
    refreshUser?.();

    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "1" || params.get("paid") === "1") {
      setOk("تمت التعبئة بنجاح ✅");
      refreshUser?.();
    } else if (params.get("paid") === "0") {
      setErr("فشلت عملية الدفع أو تم إلغاؤها");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTopup = async () => {
    setOk("");
    setErr("");

    const a = Number(topupAmount || 0);
    if (!Number.isFinite(a) || a <= 0) return setErr("أدخل مبلغ تعبئة صحيح");
    if (a < 1000) return setErr("الحد الأدنى للتعبئة 1000 د.ع");

    try {
      setSubmittingTopup(true);
      const { data } = await api.post("/payments/zaincash/topup/init", { amountIQD: a });
      window.location.href = data.paymentUrl;
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "فشل بدء التعبئة عبر زين كاش");
    } finally {
      setSubmittingTopup(false);
    }
  };

  const submitRefundRequest = async () => {
    setOk("");
    setErr("");

    const a = Number(refundAmount || 0);
    if (!Number.isFinite(a) || a <= 0) return setErr("أدخل مبلغ استرجاع صحيح");
    if (a > Number(user?.balance || 0)) return setErr("لا يمكنك استرجاع مبلغ أكبر من الرصيد المتاح");

    if (!refundInfo.trim()) return setErr("أدخل معلومات الاسترجاع (رقم زين كاش / ملاحظة)");

    try {
      setSubmittingRefund(true);
      await api.post("/wallet/refund-request", {
        amountIQD: a,
        payoutInfo: refundInfo.trim(),
      });
      setOk("تم إرسال طلب الاسترجاع للإدارة ✅");
      setRefundAmount(0);
      setRefundInfo("");
      refreshUser?.();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "فشل إرسال طلب الاسترجاع");
    } finally {
      setSubmittingRefund(false);
    }
  };

  const available = Number(user?.balance || 0);
  const held = Number(user?.heldBalance || 0);
  const total = available + held;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">المحفظة المالية</h1>
          <p className="text-slate-500 font-medium">تحكم في رصيدك، تعبئة المحفظة وطلبات الاسترجاع</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-2xl border border-slate-200">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-xs font-black text-slate-600">النظام المالي آمن 100%</span>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-right" dir="rtl">
        {/* Total Balance Card */}
        <div className="relative overflow-hidden group p-6 rounded-[2.5rem] border-2 border-slate-900 bg-slate-900 text-white shadow-2xl transition-all hover:scale-[1.02]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/30 transition-colors"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6 border border-white/10 backdrop-blur-xl">
              <WalletIcon className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-300 mb-1">إجمالي الرصيد</p>
            <h2 className="text-3xl font-black tracking-tighter">{formatCurrency(total)}</h2>
          </div>
        </div>

        {/* Available Balance Card */}
        <div className="glass group p-6 rounded-[2.5rem] border border-slate-200 shadow-xl transition-all hover:scale-[1.02]">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6 border border-emerald-100 text-emerald-600">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-500 mb-1">الرصيد المتاح</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(available)}</h2>
          <span className="inline-block mt-3 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full border border-emerald-100">قابل للاستخدام الآن</span>
        </div>

        {/* Held Balance Card */}
        <div className="glass group p-6 rounded-[2.5rem] border border-slate-200 shadow-xl transition-all hover:scale-[1.02]">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-6 border border-amber-100 text-amber-600">
            <Lock className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-500 mb-1">الرصيد المحجوز</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(held)}</h2>
          <span className="inline-block mt-3 px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-100">ضمانات المزادات</span>
        </div>
      </div>

      {/* Info Banner */}
      <div dir="rtl" className="mb-10 p-5 rounded-3xl bg-primary/5 border border-primary/20 flex items-start gap-4 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-primary/5 translate-x-full group-hover:translate-x-0 transition-transform duration-1000"></div>
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex-shrink-0 flex items-center justify-center border border-primary/10 relative z-10">
          <Info className="w-5 h-5 text-primary" />
        </div>
        <div className="relative z-10">
          <h4 className="text-sm font-black text-primary mb-1">توضيح هام بخصوص الرصيد المتاح</h4>
          <p className="text-xs font-bold text-slate-600 leading-relaxed">
            يمكنك استرجاع الرصيد المتاح في أي وقت، <span className="text-primary font-black underline decoration-primary/30">أما الرصيد المحجوز كضمان للمزادات فلا يمكن استرجاعه</span> حتى يتم فك الحجز تلقائياً من قبل النظام عند انتهاء التزامك.
          </p>
        </div>
      </div>

      {/* Actions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" dir="rtl">
        {/* Top-up Card */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-lg relative h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4 text-right">
              <div className="w-14 h-14 rounded-3xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600 shadow-sm">
                <CreditCard className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-800">تعبئة الرصيد</h3>
            </div>
            <img src="https://static.zaincash.iq/portal/assets/images/logo.png" alt="ZainCash" className="h-6 opacity-80" />
          </div>

          <div className="space-y-6 flex-grow text-right">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-3 mr-2">المبلغ المُراد شحنه (بالدينار)</label>
              <div className="relative group">
                <input
                  value={formatNumber(topupAmount)}
                  onChange={(e) => {
                    const clean = cleanNumber(e.target.value);
                    if (clean === "" || /^\d+$/.test(clean)) {
                      setTopupAmount(Number(clean) || 0);
                    }
                  }}
                  type="text"
                  placeholder="مثال: 25,000"
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:ring-8 focus:ring-primary/5 focus:border-primary focus:bg-white outline-none transition-all font-black text-xl text-slate-800 placeholder:text-slate-300"
                />
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">د.ع</span>
              </div>
            </div>

            <button
              onClick={startTopup}
              disabled={submittingTopup}
              className="w-full py-5 bg-primary hover:bg-primary-dark disabled:bg-slate-300 text-white rounded-[2rem] shadow-xl shadow-primary/20 transition-all font-black text-lg flex items-center justify-center gap-3 overflow-hidden group"
            >
              {submittingTopup ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span>استمرار للدفع الآمن</span>
                  <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </button>
            <p className="text-center text-[10px] font-bold text-slate-400">سيتم تحويلك إلى بوابة زين كاش الرسمية لإتمام العملية</p>
          </div>
        </div>

        {/* Withdrawal Card */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-lg relative h-full flex flex-col">
          <div className="flex items-center gap-4 mb-8 text-right">
            <div className="w-14 h-14 rounded-3xl bg-amber-50 flex items-center justify-center border border-amber-100 text-amber-600 shadow-sm">
              <ArrowDownLeft className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-slate-800">طلب استرجاع</h3>
          </div>

          <div className="space-y-6 flex-grow text-right">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-3 mr-2">المبلغ المطلوب سحبه</label>
              <div className="relative group">
                <input
                  value={formatNumber(refundAmount)}
                  onChange={(e) => {
                    const clean = cleanNumber(e.target.value);
                    if (clean === "" || /^\d+$/.test(clean)) {
                      setRefundAmount(Number(clean) || 0);
                    }
                  }}
                  type="text"
                  placeholder="أدخل مبلغ الاسترجاع"
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500 focus:bg-white outline-none transition-all font-black text-xl text-slate-800 placeholder:text-slate-300"
                />
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">د.ع</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-3 mr-2">جهة التحويل (رقم محفظة زين كاش)</label>
              <textarea
                value={refundInfo}
                onChange={(e) => setRefundInfo(e.target.value)}
                rows={2}
                placeholder="رقم الهاتف المرتبط بمحفظة زين كاش أو ملاحظات إضافية"
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500 focus:bg-white outline-none transition-all font-bold text-sm text-slate-800 placeholder:text-slate-300 resize-none"
              />
            </div>

            <button
              onClick={submitRefundRequest}
              disabled={submittingRefund}
              className="w-full py-5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-[2rem] shadow-xl shadow-slate-900/10 transition-all font-black text-lg flex items-center justify-center gap-3 group"
            >
              {submittingRefund ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span>تقديم طلب استرجاع</span>
                  <CheckCircle2 className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              )}
            </button>
            <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-bold text-slate-500">تتم مراجعة طلبات الاسترجاع يدوياً خلال 24-48 ساعة عمل</p>
            </div>
          </div>
        </div>
      </div>

      {/* Message Notifications */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 w-full max-w-sm px-4">
        {err && (
          <div className="bg-white border-2 border-rose-100 p-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 text-right" dir="rtl">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-black text-rose-600">{err}</p>
          </div>
        )}
        {ok && (
          <div className="bg-white border-2 border-emerald-100 p-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 text-right" dir="rtl">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-black text-emerald-600">{ok}</p>
          </div>
        )}
      </div>
    </div>
  );
}
