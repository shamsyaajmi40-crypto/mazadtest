import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Truck, ArrowLeft, Wallet } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { getMyOpenDeals } from "../services/auction";
import type { Auction } from "../types";

const deliveryStatusLabel = (status?: string) => {
  switch (status) {
    case "READY_FOR_PICKUP":
      return "بانتظار استلام الطلب من البائع";
    case "PICKED_UP":
      return "تم استلام الطلب من البائع";
    case "DELIVERED":
      return "تم تسليم الطلب للمشتري";
    case "COD_PAID_TO_SELLER":
      return "تم تسليم مبلغ COD للبائع";
    case "DELIVERY_FAILED":
      return "فشل التوصيل";
    default:
      return "بانتظار بدء التوصيل";
  }
};

const OpenDeals = () => {
  const { user } = useContext(AuthContext);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyOpenDeals()
      .then((res) => {
        setAuctions(res.data?.auctions || []);
      })
      .catch((err) => {
        console.error("Failed to load open deals", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    return auctions.map((a) => {
      const ownerId = String((a.owner as any)?._id || a.owner || "");
      const winnerId = String((a.winner as any)?._id || a.winner || "");
      const myId = String(user?._id || "");
      const myRole = ownerId === myId ? "seller" : winnerId === myId ? "winner" : "viewer";

      return { auction: a, myRole };
    });
  }, [auctions, user?._id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600 font-bold">
          جاري تحميل الصفقات الجارية...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900">الصفقات الجارية</h1>
        <p className="text-slate-600 mt-2 font-medium">
          هذه الصفقات انتهى مزادها وتم تحديد الفائز، لكنها لم تكتمل بعد.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="text-slate-700 font-black mb-2">لا توجد صفقات جارية حالياً</div>
          <p className="text-slate-500 text-sm">أي صفقة يتم حسمها ستنتقل تلقائياً إلى الأرشيف.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ auction, myRole }) => {
            const isCourier = auction.deliveryMode === "courier";
            const deliveryStatus = (auction as any)?.deliveryOrder?.status;
            const roleLabel = myRole === "seller" ? "أنت البائع" : myRole === "winner" ? "أنت الفائز" : "";

            return (
              <div
                key={auction._id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{auction.title}</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      انتهى المزاد في {new Date(auction.endTime).toLocaleString("ar-IQ")}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-black">
                    صفقة غير مكتملة
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {roleLabel && (
                    <span className="rounded-xl bg-slate-100 text-slate-700 px-3 py-1 text-xs font-bold">
                      {roleLabel}
                    </span>
                  )}
                  <span className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-bold">
                    السعر النهائي: {Number(auction.currentPrice || 0).toLocaleString()} د.ع
                  </span>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="font-black mb-1 flex items-center gap-2">
                    {isCourier ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                    {isCourier ? "التوصيل عبر شركة شحن" : "التسليم اليدوي"}
                  </div>
                  <div className="font-medium">
                    {isCourier ? deliveryStatusLabel(deliveryStatus) : "بانتظار تأكيدات إتمام الصفقة"}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/auction/${auction._id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-black hover:bg-slate-800"
                  >
                    متابعة الصفقة من تفاصيل المزاد
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/wallet"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 text-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-50"
                  >
                    <Wallet className="w-4 h-4" />
                    المحفظة
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OpenDeals;
