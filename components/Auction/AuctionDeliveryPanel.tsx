import React from "react";
import { X, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import maskUsername from "@/utils/maskUsername.ts";
import DeliveryStepper, { deliveryFailureReasonLabel } from "../DeliveryStepper";

interface AuctionDeliveryPanelProps {
  auction: any;
  user: any;
  isAdmin: boolean;
  isOwner: boolean;
  isWinner: boolean;
  isMeWinner: boolean;
  isDealResolved: boolean;
  isDealFailed: boolean;
  setShowCourierModal: (show: boolean) => void;
  setCourierErr: (err: string | null) => void;
  loadCourierCompanies: () => Promise<void>;
  normalizedStatus: string;
}

const AuctionDeliveryPanel = ({
  auction,
  user,
  isAdmin,
  isOwner,
  isWinner,
  isMeWinner,
  isDealResolved,
  isDealFailed,
  setShowCourierModal,
  setCourierErr,
  loadCourierCompanies,
  normalizedStatus
}: AuctionDeliveryPanelProps) => {

  const hasWinner = !!auction.winner;

  // Role check for labels
  const isSeller = user && auction.seller && String(auction.seller._id || auction.seller) === String(user._id);

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* Winner Info */}
      {auction.winner && !isDealFailed && (
        <div className="p-5 sm:p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100/60">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏆</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-black tracking-wider text-emerald-600 uppercase">الفائز بالمزاد</span>
              <span className="text-lg font-black text-emerald-900">
                {(isMeWinner || isOwner) ? (isMeWinner ? "أنت الفائز!" : (auction.winner.name || "مستخدم")) : maskUsername(auction.winner.name || "مستخدم")}
              </span>
            </div>
          </div>
          
          {(isOwner && !isMeWinner && auction.winner.phone) && (
            <div className="pt-3 border-t border-emerald-200/50 flex gap-2">
              <a href={`https://wa.me/${auction.winner.phone.replace(/^0/, "964")}`} target="_blank" className="flex-1 bg-[#25D366] hover:bg-[#20b358] text-white text-[11px] font-black py-2 rounded-xl text-center transition-colors">💬 واتساب</a>
              <a href={`tel:${auction.winner.phone}`} className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-black py-2 rounded-xl text-center transition-colors">📞 اتصال</a>
            </div>
          )}
          
          {(isMeWinner && auction.seller?.phone) && (
            <div className="pt-3 border-t border-emerald-200/50">
              <p className="text-[11px] font-bold text-emerald-800 mb-2">تواصل مع البائع لإتمام الصفقة:</p>
              <div className="flex gap-2">
                <a href={`https://wa.me/${auction.seller.phone.replace(/\D/g, "")}`} target="_blank" className="flex-1 bg-[#25D366] hover:bg-[#20b358] text-white text-[11px] font-black py-2 rounded-xl text-center transition-colors">💬 واتساب</a>
                <a href={`tel:${auction.seller.phone}`} className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-black py-2 rounded-xl text-center transition-colors">📞 اتصال</a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Courier Request Action */}
      {normalizedStatus === "ended" && isOwner && auction.winner && auction.deliveryMode !== "courier" && !isDealResolved && (
        <button
          onClick={() => { setShowCourierModal(true); setCourierErr(null); loadCourierCompanies(); }}
          className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-900/10 transition-all active:scale-95"
        >
          📦 طلب توصيل (COD + OTP)
        </button>
      )}

      {/* Seller Instructions for Courier */}
      {isOwner && normalizedStatus === "ended" && auction.deliveryMode === "courier" && !auction.payoutOtpCode && !isDealResolved && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 flex items-start gap-3">
          <span className="text-2xl shrink-0 mt-0.5">📦</span>
          <div>
            <p className="font-black text-amber-900 text-sm mb-1">الطلب في طريقه إلى المشتري</p>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
              بعد استلام المشتري للبضاعة، سيصلك رمز خاص لاستلام أموالك من شركة التوصيل. توجّه إلى الشركة أولًا واستلم أموالك بشكل كامل، ثم قم بتسليمهم الرمز.
            </p>
            <div className="mt-2 p-2 bg-rose-50 border border-rose-100 rounded-lg">
              <p className="text-[11px] text-rose-600 font-black">
                ⚠️ تنبيه: لا تُسلّم الرمز قبل التأكد من استلام أموالك، وإلا فلن تتحمّل المنصة أي مسؤولية.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery OTP codes */}
      {normalizedStatus === "ended" && auction.deliveryMode === "courier" && (isOwner || isWinner) && !isDealResolved && (
        <div className="rounded-2xl overflow-hidden border border-blue-100">
          <div className="bg-gradient-to-l from-blue-600 to-indigo-600 px-4 py-3 flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="text-white font-black text-sm">كود التسليم عبر شركة (OTP)</span>
          </div>
          <div className="bg-white p-4 space-y-3">
            {isWinner && auction.deliveryOtpCode && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">كود استلام السلعة — اعطه للمندوب</p>
                <div className="text-3xl font-black tracking-[0.3em] text-slate-900 text-center py-2 bg-white rounded-lg border border-slate-100">
                  {auction.deliveryOtpCode}
                </div>
                <p className="mt-2 text-[10px] text-slate-500 font-bold leading-relaxed text-center">
                  أعطِ هذا الرمز للمندوب **بعد فحص واستلام السلعة** فقط.
                </p>
              </div>
            )}
            {isOwner && auction.payoutOtpCode && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">كود استلام المبلغ (COD) — اعطه لموظف الشركة</p>
                <div className="text-3xl font-black tracking-[0.3em] text-slate-900 text-center py-2 bg-white rounded-lg border border-slate-100">
                  {auction.payoutOtpCode}
                </div>
                <p className="mt-2 text-[10px] text-slate-500 font-bold leading-relaxed text-center">
                  أعطِ هذا الرمز لموظف الشركة **بعد استلامك كامل مبلغ البيع** نقداً.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivery Tracking Step */}
      {(isOwner || isWinner || isAdmin) && auction.deliveryMode === "courier" && auction.deliveryOrder && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
          <div className="bg-gradient-to-l from-slate-800 to-slate-700 px-4 py-3 flex items-center gap-2">
            <div className="p-1.5 bg-white/10 rounded-lg">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-white font-black text-sm">حالة التوصيل والمرحلة الحالية</span>
          </div>
          <div className="p-4 space-y-4">
            <DeliveryStepper auction={auction} />
            
            <div className="text-xs sm:text-sm font-bold p-3 bg-slate-50 rounded-xl border border-slate-100">
              {(() => {
                const order = auction.deliveryOrder;
                const status = order?.status;
                const reason = order?.failureReason || auction.deliveryPenaltyReason || "";
                
                switch (status) {
                  case "READY_FOR_PICKUP": return <span className="text-blue-600">📦 بانتظار استلام الطلب من البائع</span>;
                  case "PICKED_UP": return <span className="text-indigo-600">🚚 تم استلام الطلب ويجري التوصيل للمشتري</span>;
                  case "DELIVERED": return <span className="text-green-600">✅ تم تسليم الطلب للمشتري بنجاح</span>;
                  case "COD_PAID_TO_SELLER": return <span className="text-emerald-600">💰 تم تسليم المبلغ للبائع — الصفقة مكتملة</span>;
                  case "DELIVERY_FAILED": 
                    return <span className="text-rose-600">❌ فشل التوصيل: {deliveryFailureReasonLabel[reason] || reason || "سبب غير محدد"}</span>;
                  default: return <span className="text-slate-500">جاري معالجة الطلب...</span>;
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuctionDeliveryPanel;
