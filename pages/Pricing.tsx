import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPlans, fetchMyBillingMe, Plan, PlanAudience } from "../services/billing.service";
import api from "../services/api";
import { Check, Zap, AlertTriangle, Info, Crown, ArrowUpCircle } from "lucide-react";

const money = (n: number) => `${Number(n || 0).toLocaleString("en-US")} د.ع`;

export default function Pricing() {
  const nav = useNavigate();

  const [audience, setAudience] = useState<PlanAudience>("user");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [me, setMe] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const load = async (aud: PlanAudience) => {
    setLoading(true);
    setErr("");
    try {
      const [p, m] = await Promise.all([fetchPlans(aud), fetchMyBillingMe()]);
      setPlans(p || []);
      setMe(m || null);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      await load(audience);

      // ✅ إذا رجع من زين كاش (paid=1 أو orderId) نعمل تحديث إضافي
      const params = new URLSearchParams(window.location.search);
      if (params.get("paid") === "1" || params.get("orderId")) {
        try {
          const m = await fetchMyBillingMe();
          if (mounted) setMe(m || null);
        } catch { }
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  const currentPlan = me?.subscription?.plan || null;
  const currentPlanCode = currentPlan?.code;
  const currentPrice = Number(currentPlan?.priceIQD || 0);

  const pending = me?.pendingRequest;

  const headerNote = useMemo(() => {
    if (!me?.usage) return null;
    const { limit, used, remaining } = me.usage;
    return { limit, used, remaining };
  }, [me]);

  const startZaincash = async (planCode: string) => {
    try {
      if (pending) return; // حماية إضافية
      if (submitting) return;

      setSubmitting(true);
      setErr("");

      const { data } = await api.post("/payments/zaincash/init", { planCode });
      window.location.href = data.paymentUrl;
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "فشل بدء الدفع عبر زين كاش");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12" dir="rtl">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">الباقات والاشتراكات</h2>
        <p className="text-slate-500 font-medium max-w-2xl mx-auto">
          اختر الباقة التي تناسب طموحاتك لبيع وشراء المنتجات عبر منصتنا بكل أمان وسهولة.
        </p>
      </div>

      {pending && (
        <div className="max-w-3xl mx-auto mb-8 bg-amber-50 border border-amber-200 rounded-3xl p-5 md:p-6 shadow-sm flex gap-4 items-start">
          <div className="p-3 bg-amber-100/50 rounded-2xl text-amber-600 hidden sm:block">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="font-black text-amber-800 text-lg mb-1">طلب ترقية قيد المعالجة</div>
            <div className="text-amber-700/80 mb-3 text-sm font-medium">
              الباقة المطلوبة: <span className="font-bold">{pending.plan?.name}</span> ({pending.plan?.code}) — <span className="font-black">{money(pending.plan?.priceIQD || 0)}</span>
            </div>
            <div className="text-xs font-bold text-amber-600/70 bg-amber-100/50 border border-amber-200/50 inline-block px-3 py-1.5 rounded-lg">
              لا يمكنك إرسال طلب جديد حتى يتم البت بالطلب الحالي.
            </div>
          </div>
        </div>
      )}

      {headerNote && (
        <div className="max-w-3xl mx-auto mb-10 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-xl shadow-slate-900/10 flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>

          <div className="relative z-10 flex gap-4 items-center w-full sm:w-auto">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/5">
              <Info className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-sm text-slate-400 font-bold mb-0.5">باقتك الحالية</div>
              <div className="text-xl font-black">
                {currentPlan?.name || "غير محدد"}
                {currentPlanCode && <span className="text-sm text-slate-500 font-bold ml-2">({currentPlanCode})</span>}
              </div>
            </div>
          </div>

          <div className="relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4 w-full sm:w-auto text-center sm:text-right min-w-[200px]">
            <div className="text-xs text-slate-400 font-bold mb-2">المتبقي من المزادات (هذا الشهر)</div>
            <div className="flex items-end justify-center sm:justify-start gap-2">
              <span className="text-3xl font-black tracking-tight text-white">{headerNote.remaining}</span>
              <span className="text-sm font-bold text-slate-500 mb-1">/ {headerNote.limit}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-medium">تم استخدام {headerNote.used}</div>
          </div>
        </div>
      )}

      {/* Audience Toggle */}
      <div className="flex justify-center mb-12 relative z-10">
        <div className="bg-slate-100/80 backdrop-blur-sm p-1.5 rounded-2xl inline-flex shadow-inner border border-slate-200/50">
          <button
            onClick={() => setAudience("user")}
            className={`px-8 py-3 rounded-xl text-sm font-black transition-all duration-300 ${audience === "user"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
          >
            مستخدم عادي
          </button>
          <button
            onClick={() => setAudience("trader")}
            className={`px-8 py-3 rounded-xl text-sm font-black transition-all duration-300 ${audience === "trader"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
          >
            تاجر
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : err ? (
        <div className="max-w-xl mx-auto text-center bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl p-6 font-bold">
          {err}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto relative z-0">
          {plans.map((pl) => {
            const isCurrent = pl.code === currentPlanCode;
            const isDowngradeOrSamePrice = Number(pl.priceIQD || 0) <= currentPrice;
            const canUpgrade = !isCurrent && !isDowngradeOrSamePrice;
            const disabledAll = !!pending || submitting;

            // Highlight Logic -> can customize thresholds
            const isPremium = Number(pl.priceIQD) >= 15000;

            return (
              <div
                key={pl._id}
                className={`relative flex flex-col p-8 rounded-[2.5rem] transition-all duration-500 group ${isCurrent
                    ? "bg-gradient-to-br from-blue-50 to-white md:-translate-y-2 border-2 border-blue-400/30 shadow-xl shadow-blue-500/10"
                    : isPremium
                      ? "bg-white border text-slate-800 border-slate-200 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:-translate-y-2 hover:border-slate-300"
                      : "bg-white border border-slate-100 shadow-lg shadow-slate-100/50 hover:-translate-y-1 hover:border-slate-200 hover:shadow-xl"
                  }`}
              >
                {/* Popular Badge */}
                {isPremium && !isCurrent && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-gradient-to-r from-emerald-500 to-emerald-400 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg shadow-emerald-500/20 border border-white/20">
                      الباقة المتطورة
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg shadow-blue-600/20 border border-white/20">
                      باقتك الحالية
                    </span>
                  </div>
                )}

                <div className="mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                    {isPremium ? <Crown className="w-6 h-6 text-amber-500" /> : <Zap className="w-6 h-6 text-slate-400 group-hover:text-amber-500 transition-colors" />}
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 mb-2">{pl.name}</h3>
                  <div className="text-xs font-bold text-slate-400 bg-slate-50 inline-block px-2 py-1 rounded-md mb-6">{pl.code}</div>

                  <div className="flex items-baseline gap-1 text-slate-900">
                    <span className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600">
                      {(pl.priceIQD || 0).toLocaleString()}
                    </span>
                    <span className="text-sm font-bold text-slate-500">د.ع</span>
                  </div>
                </div>

                <div className="flex-grow space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-emerald-500" strokeWidth={3} />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-600">حد المزادات شهريًا:</span>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {pl.isUnlimited
                          ? `غير محدود (استخدام عادل: ${pl.fairUseMonthlyLimit || 0})`
                          : pl.monthlyAuctionLimit}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-emerald-500" strokeWidth={3} />
                    </div>
                    <div className="text-sm font-medium text-slate-600 mt-0.5">
                      لوحة تحكم للمزادات (إنشاء وإدارة)
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 mt-auto">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-4 rounded-xl text-sm font-black bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center gap-2 transition-all"
                    >
                      <Check className="w-4 h-4" /> مفعلة حالياً
                    </button>
                  ) : canUpgrade ? (
                    <button
                      disabled={disabledAll}
                      onClick={() => startZaincash(pl.code)}
                      className={`w-full py-4 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${disabledAll
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200"
                          : isPremium
                            ? "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-slate-900/20 hover:-translate-y-0.5 active:scale-95 border border-slate-900"
                            : "bg-white text-slate-900 border-2 border-slate-900 hover:bg-slate-50 hover:shadow-slate-200 active:scale-95"
                        }`}
                    >
                      {submitting ? (
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <ArrowUpCircle className="w-4 h-4" /> ترقية الآن
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-4 rounded-xl text-sm font-black bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed"
                      title="لا يمكن الرجوع إلى باقات أقل"
                    >
                      غير متاح
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
