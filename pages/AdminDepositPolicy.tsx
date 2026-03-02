import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { getDepositPolicy, updateDepositPolicy } from "../services/admin";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { formatNumber, cleanNumber } from "../utils/numberFormat";

const toPercent = (v: number) => Number((Number(v || 0) * 100).toFixed(3));
const toRate = (v: number | string) => Number(v || 0) / 100;

const AdminDepositPolicy = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    bidderDefaultRatePct: 2,
    bidderNewUserRatePct: 3,
    bidderNewUserAuctionThreshold: 3,
    bidderMinAmount: 5000,
    bidderMaxAmount: 250000,

    sellerFreeRatePct: 3,
    sellerPlusRatePct: 1.5,
    sellerMaxRatePct: 0.5,
    sellerOneStrikePct: 1,
    sellerTwoPlusStrikePct: 2,
    sellerMaxTotalRatePct: 6,
    sellerMinAmount: 5000,
    sellerSmallPriceThreshold: 100000,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await getDepositPolicy();
        const p = res?.policy || {};
        setForm({
          bidderDefaultRatePct: toPercent(p?.bidder?.defaultRate ?? 0.02),
          bidderNewUserRatePct: toPercent(p?.bidder?.newUserRate ?? 0.03),
          bidderNewUserAuctionThreshold: Number(p?.bidder?.newUserAuctionThreshold ?? 3),
          bidderMinAmount: Number(p?.bidder?.minAmount ?? 5000),
          bidderMaxAmount: Number(p?.bidder?.maxAmount ?? 250000),

          sellerFreeRatePct: toPercent(p?.seller?.planRates?.USER_FREE ?? 0.03),
          sellerPlusRatePct: toPercent(p?.seller?.planRates?.USER_PLUS ?? 0.015),
          sellerMaxRatePct: toPercent(p?.seller?.planRates?.USER_MAX ?? 0.005),
          sellerOneStrikePct: toPercent(p?.seller?.strikeSurcharge?.oneStrike ?? 0.01),
          sellerTwoPlusStrikePct: toPercent(p?.seller?.strikeSurcharge?.twoPlusStrike ?? 0.02),
          sellerMaxTotalRatePct: toPercent(p?.seller?.maxTotalRate ?? 0.06),
          sellerMinAmount: Number(p?.seller?.minAmount ?? 5000),
          sellerSmallPriceThreshold: Number(p?.seller?.smallPriceThreshold ?? 100000),
        });
      } catch (e: any) {
        setErr(e?.response?.data?.message || "فشل تحميل إعدادات العربون");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const setNum = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: Number(value) }));

  const save = async () => {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const payload = {
        bidder: {
          defaultRate: toRate(form.bidderDefaultRatePct),
          newUserRate: toRate(form.bidderNewUserRatePct),
          newUserAuctionThreshold: Number(form.bidderNewUserAuctionThreshold),
          minAmount: Number(form.bidderMinAmount),
          maxAmount: Number(form.bidderMaxAmount),
        },
        seller: {
          planRates: {
            USER_FREE: toRate(form.sellerFreeRatePct),
            USER_PLUS: toRate(form.sellerPlusRatePct),
            USER_MAX: toRate(form.sellerMaxRatePct),
          },
          strikeSurcharge: {
            oneStrike: toRate(form.sellerOneStrikePct),
            twoPlusStrike: toRate(form.sellerTwoPlusStrikePct),
          },
          maxTotalRate: toRate(form.sellerMaxTotalRatePct),
          minAmount: Number(form.sellerMinAmount),
          smallPriceThreshold: Number(form.sellerSmallPriceThreshold),
        },
      };

      await updateDepositPolicy(payload);
      setMsg("تم حفظ إعدادات العربون بنجاح");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "فشل حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-slate-500 font-bold">جاري تحميل الإعدادات...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-4">
          <Link
            to="/admin/dashboard"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            title="الرجوع للوحة التحكم"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-black text-slate-900">إعدادات العربون</h1>
        </div>
        <p className="text-sm text-slate-500 font-medium mt-1 pr-14">تغيير نسب وحدود عربون المزايد وعربون البائع من لوحة الإدارة.</p>
      </div>

      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 font-bold text-sm">{err}</div>}
      {msg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 font-bold text-sm">{msg}</div>}

      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h2 className="font-black text-slate-800">عربون المزايد</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="النسبة الافتراضية (%)" value={form.bidderDefaultRatePct} onChange={(v) => setNum("bidderDefaultRatePct", v)} isPercent />
          <Field label="نسبة المستخدم الجديد (%)" value={form.bidderNewUserRatePct} onChange={(v) => setNum("bidderNewUserRatePct", v)} isPercent />
          <Field label="عدد مزادات المستخدم الجديد" value={form.bidderNewUserAuctionThreshold} onChange={(v) => setNum("bidderNewUserAuctionThreshold", v)} isPercent />
          <Field label="الحد الأدنى (د.ع)" value={form.bidderMinAmount} onChange={(v) => setNum("bidderMinAmount", v)} />
          <Field label="الحد الأعلى (د.ع)" value={form.bidderMaxAmount} onChange={(v) => setNum("bidderMaxAmount", v)} />
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h2 className="font-black text-slate-800">عربون البائع</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="FREE (%)" value={form.sellerFreeRatePct} onChange={(v) => setNum("sellerFreeRatePct", v)} isPercent />
          <Field label="PLUS (%)" value={form.sellerPlusRatePct} onChange={(v) => setNum("sellerPlusRatePct", v)} isPercent />
          <Field label="MAX (%)" value={form.sellerMaxRatePct} onChange={(v) => setNum("sellerMaxRatePct", v)} isPercent />
          <Field label="زيادة مخالفة واحدة (%)" value={form.sellerOneStrikePct} onChange={(v) => setNum("sellerOneStrikePct", v)} isPercent />
          <Field label="زيادة مخالفتين+ (%)" value={form.sellerTwoPlusStrikePct} onChange={(v) => setNum("sellerTwoPlusStrikePct", v)} isPercent />
          <Field label="السقف الأعلى للنسبة (%)" value={form.sellerMaxTotalRatePct} onChange={(v) => setNum("sellerMaxTotalRatePct", v)} isPercent />
          <Field label="الحد الأدنى (د.ع)" value={form.sellerMinAmount} onChange={(v) => setNum("sellerMinAmount", v)} />
          <Field label="سعر التحول للحد الأدنى (د.ع)" value={form.sellerSmallPriceThreshold} onChange={(v) => setNum("sellerSmallPriceThreshold", v)} />
        </div>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black disabled:opacity-60"
      >
        <Save className="w-4 h-4" />
        {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
      </button>
    </div>
  );
};

// Inside Field component...
const Field = ({
  label,
  value,
  onChange,
  isPercent = false
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  isPercent?: boolean;
}) => (
  <label className="space-y-1 block">
    <div className="text-xs font-bold text-slate-500">{label}</div>
    <input
      type="text"
      value={isPercent ? value : formatNumber(value)}
      onChange={(e) => {
        const clean = cleanNumber(e.target.value);
        if (clean === "" || /^\d*\.?\d*$/.test(clean)) {
          onChange(clean);
        }
      }}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  </label>
);

export default AdminDepositPolicy;
