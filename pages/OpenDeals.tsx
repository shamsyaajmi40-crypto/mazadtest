import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Package, 
  Truck, 
  ArrowLeft, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  ExternalLink,
  Info,
  ChevronRight
} from "lucide-react";
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

const getStepperIndex = (status?: string) => {
  switch (status) {
    case "READY_FOR_PICKUP": return 1;
    case "PICKED_UP": return 2;
    case "DELIVERED": return 3;
    case "COD_PAID_TO_SELLER": return 4;
    default: return 0;
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
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="flex flex-col items-center justify-center p-12 rounded-[3rem] border border-slate-200 bg-white/50 backdrop-blur-xl">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-3xl border-4 border-slate-100 border-t-primary animate-spin"></div>
            <Package className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-800">جاري تحميل الصفقات...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider mb-3">
            <Clock className="w-3 h-3" />
            تحت الإجراء
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">الصفقات الجارية</h1>
          <p className="text-slate-500 mt-2 font-bold text-lg">
            تابع مسار صفقاتك النشطة حتى الاكتمال النهائي
          </p>
        </div>
        
        <Link 
          to="/wallet"
          className="flex items-center gap-3 px-6 py-4 bg-white border border-slate-200 rounded-[2rem] shadow-sm hover:shadow-md transition-all active:scale-95 group"
        >
          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 leading-none mb-1 text-left">التوجه إلى</div>
            <div className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">المحفظة المالية</div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 mr-2" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[4rem] border-2 border-dashed border-slate-200 bg-slate-50/50 p-20 text-center">
          <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-slate-300" />
          </div>
          <div className="text-2xl font-black text-slate-800 mb-2">سجلك نظيف حالياً</div>
          <p className="text-slate-500 font-bold max-w-sm mx-auto">
            أي مزاد تفوز به أو تبيعه سيظهر هنا ليتم متابعة التوصيل والتحويل المالي.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {rows.map(({ auction, myRole }) => {
            const isCourier = auction.deliveryMode === "courier";
            const deliveryStatus = (auction as any)?.deliveryOrder?.status;
            const currentStep = getStepperIndex(deliveryStatus);
            const isWinner = myRole === "winner";

            return (
              <div
                key={auction._id}
                className="group relative rounded-[2.5rem] border border-slate-200 bg-white/80 backdrop-blur-2xl p-6 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-300/50 transition-all duration-500 overflow-hidden"
              >
                {/* Role Accent Line */}
                <div className={`absolute top-0 right-0 w-32 h-1 ${isWinner ? 'bg-emerald-500' : 'bg-slate-900'}`}></div>

                <div className="flex gap-5 mb-8">
                  {/* Thumbnail */}
                  <div className="relative w-28 h-28 rounded-3xl overflow-hidden shadow-lg flex-shrink-0 bg-slate-100 border border-slate-100">
                    <img 
                      src={auction.images?.[0] || "/placeholder-auction.png"} 
                      alt={auction.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                    {isWinner ? (
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-emerald-500 rounded-lg text-[8px] font-black text-white uppercase tracking-tighter">فوز</div>
                    ) : (
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-900 rounded-lg text-[8px] font-black text-white uppercase tracking-tighter">بيع</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h2 className="text-xl font-black text-slate-900 truncate leading-tight">{auction.title}</h2>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(auction.endTime).toLocaleDateString("ar-IQ")}
                      </div>
                      <div className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight ${isWinner ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                         {isWinner ? 'أنت الفائز' : 'أنت صاحب المزاد'}
                      </div>
                    </div>

                    <div className="mt-4 text-lg font-black text-slate-900">
                        {Number(auction.currentPrice || 0).toLocaleString()} <span className="text-[10px] font-bold text-slate-400">د.ع</span>
                    </div>
                  </div>
                </div>

                {/* Progress Stepper */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-6 mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isCourier ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                         {isCourier ? <Truck className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 leading-none mb-1">طريقة المعاملة</div>
                        <div className="text-xs font-black text-slate-800">{isCourier ? 'توصيل عبر شركة شحن' : 'تسليم يدوي مباشر'}</div>
                      </div>
                    </div>
                    <div className="text-left">
                       <div className="text-[10px] font-bold text-slate-400 leading-none mb-1">الحالة الحالية</div>
                       <div className="text-xs font-black text-emerald-600 leading-none">
                         {isCourier ? deliveryStatusLabel(deliveryStatus) : "بانتظار التأكيدات"}
                       </div>
                    </div>
                  </div>

                  {isCourier && (
                    <div className="relative flex justify-between">
                      {/* Connection Line */}
                      <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-200 -z-0"></div>
                      <div 
                        className="absolute top-4 left-0 h-0.5 bg-emerald-500 transition-all duration-1000 -z-0"
                        style={{ width: `${(currentStep / 4) * 100}%` }}
                      ></div>

                      {[0, 1, 2, 3, 4].map((step) => {
                        const isCompleted = step <= currentStep;
                        return (
                          <div key={step} className="relative z-10 flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${isCompleted ? 'bg-emerald-500 border-white text-white shadow-lg shadow-emerald-500/30' : 'bg-white border-slate-100 text-slate-300'}`}>
                               {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {!isCourier && (
                    <div className="flex items-center gap-2 text-slate-500 bg-white/60 p-3 rounded-2xl border border-dashed border-slate-200">
                      <Info className="w-4 h-4" />
                      <span className="text-[11px] font-bold">يرجى من الطرفين الدخول لصفحة المزاد لتأكيد استلام السلعة/المبلغ يدوياً.</span>
                    </div>
                  )}
                </div>

                <div className="flex">
                  <Link
                    to={`/auction/${auction._id}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white px-5 py-4 text-sm font-black hover:bg-primary hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                  >
                    تفاصيل ومتابعة الصفقة
                    <ExternalLink className="w-4 h-4" />
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
