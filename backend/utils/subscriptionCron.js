import Subscription from "../models/Subscription.js";

const addOneMonth = (date) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
};

export const runSubscriptionCron = async () => {
  const now = new Date();

  // أي اشتراك انتهت فترته: نجدد تلقائيًا (MVP)
  // لاحقًا: إذا غير مدفوع -> due/overdue
  const subs = await Subscription.find({ currentPeriodEnd: { $lte: now } });

  for (const sub of subs) {
    sub.currentPeriodStart = now;
    sub.currentPeriodEnd = addOneMonth(now);
    sub.auctionsUsedThisPeriod = 0;
    sub.status = "active";
    await sub.save();
  }
};
