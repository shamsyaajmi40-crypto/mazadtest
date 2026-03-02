import cron from "node-cron";
import Subscription from "../models/Subscription.js";

const addOneMonth = (date) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
};

export const startSubscriptionCron = () => {
    console.log("CRON INITIALIZED (Subscription Renew)");
  // يوميًا الساعة 3 صباحًا
  cron.schedule("0 3 * * *", async () => {
    try {
      const now = new Date();

      const subs = await Subscription.find({
        currentPeriodEnd: { $lte: now },
      });

      for (const sub of subs) {
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = addOneMonth(now);
        sub.auctionsUsedThisPeriod = 0;
        sub.status = "active"; // لاحقًا نغيرها حسب الدفع
        await sub.save();
      }

      console.log("[CRON] Subscriptions renewed:", subs.length);
    } catch (err) {
      console.error("[CRON] Subscription error:", err);
    }
  });
};
