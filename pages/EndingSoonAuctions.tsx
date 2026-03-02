import { useEffect, useState } from "react";
import AuctionCard from "../components/AuctionCard";
import { getAuctions } from "../services/auction";

const ENDING_SOON_MINUTES = 60;

const EndingSoonAuctions = () => {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getAuctions();
        const now = Date.now();

        // فلترة صحيحة على بيانات السيرفر مباشرة
        const endingSoon = res.data
  .filter((auction: any) => {
    if (!auction.endTime) return false;

    const diffMinutes =
      (new Date(auction.endTime).getTime() - now) / 60000;

    return diffMinutes > 0 && diffMinutes <= ENDING_SOON_MINUTES;
  })
 .sort((a: any, b: any) => {
  const aTime = new Date(a.endTime).getTime();
  const bTime = new Date(b.endTime).getTime();
  return aTime - bTime;
});
        setAuctions(endingSoon);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 font-bold">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-black mb-8">
        ⏳ مزادات تنتهي قريبًا
      </h1>

      {auctions.length === 0 ? (
        <div className="text-center text-slate-500 font-bold py-20">
          لا توجد مزادات تنتهي قريبًا حاليًا
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {auctions.map((auction) => (
            <AuctionCard key={auction._id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
};

export default EndingSoonAuctions;
