import React, { useEffect, useState, useContext } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { formatNumber, cleanNumber } from "../utils/numberFormat";

const money = (n: any) => `${Number(n || 0).toLocaleString("en-US")} د.ع`;

export default function Wallet() {
  const { user, refreshUser } = useContext(AuthContext);

  const [topupAmount, setTopupAmount] = useState<number>(0);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundInfo, setRefundInfo] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    refreshUser?.();

    // إذا رجع من زين كاش
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
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2 style={{ marginBottom: 10 }}>المحفظة</h2>

      {/* ملخص الرصيد */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #f0f0f0" }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>الرصيد المتاح</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{money(available)}</div>
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #f0f0f0" }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>الرصيد المحجوز (ضمانات)</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{money(held)}</div>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12, lineHeight: 1.6 }}>
            هذا المبلغ يُحجز كضمان (حجز نشر المزاد / عربون المزايد) ويُعاد عند الالتزام.
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #f0f0f0" }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>الإجمالي (متاح + محجوز)</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{money(total)}</div>
        </div>
      </div>

      {/* تعبئة عبر زين كاش */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>تعبئة رصيد عبر زين كاش</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={formatNumber(topupAmount)}
            onChange={(e) => {
              const clean = cleanNumber(e.target.value);
              if (clean === "" || /^\d+$/.test(clean)) {
                setTopupAmount(Number(clean) || 0);
              }
            }}
            type="text"
            placeholder="المبلغ بالدينار"
            className="w-full md:w-auto px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700"
            style={{ minWidth: 260 }}
          />

          <button
            onClick={startTopup}
            disabled={submittingTopup}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: submittingTopup ? "#f5f5f5" : "white",
              cursor: submittingTopup ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {submittingTopup ? "جارِ التحويل..." : "تعبئة عبر زين كاش"}
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12, lineHeight: 1.7 }}>
          ملاحظة: الاشتراكات تُدفع عبر زين كاش، والمحفظة تُستخدم للضمانات والخدمات داخل الموقع.
        </div>
      </div>

      {/* طلب استرجاع */}
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>طلب استرجاع رصيد (يُراجع من الإدارة)</div>

        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={formatNumber(refundAmount)}
            onChange={(e) => {
              const clean = cleanNumber(e.target.value);
              if (clean === "" || /^\d+$/.test(clean)) {
                setRefundAmount(Number(clean) || 0);
              }
            }}
            type="text"
            placeholder="مبلغ الاسترجاع (من الرصيد المتاح فقط)"
            className="w-full px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-700"
          />

          <input
            value={refundInfo}
            onChange={(e) => setRefundInfo(e.target.value)}
            type="text"
            placeholder="رقم زين كاش / معلومات التحويل / ملاحظة"
            style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <button
            onClick={submitRefundRequest}
            disabled={submittingRefund}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #111",
              background: submittingRefund ? "#f5f5f5" : "white",
              cursor: submittingRefund ? "not-allowed" : "pointer",
              fontWeight: 800,
              width: 200,
            }}
          >
            {submittingRefund ? "جارِ الإرسال..." : "طلب استرجاع"}
          </button>

          <div style={{ opacity: 0.75, fontSize: 12, lineHeight: 1.7 }}>
            الاسترجاع يتم فقط من <b>الرصيد المتاح</b>. الرصيد المحجوز للضمانات لا يمكن استرجاعه حتى يتم فك الحجز.
          </div>
        </div>
      </div>

      {/* رسائل */}
      {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}
      {ok && <div style={{ color: "green", marginTop: 10 }}>{ok}</div>}
    </div>
  );
}
