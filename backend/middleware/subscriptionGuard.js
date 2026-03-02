import Subscription from "../models/Subscription.js";

export const canCreateAuction = async (req, res, next) => {
  const sub = await Subscription.findOne({ user: req.user._id }).populate("plan");

  if (!sub) return res.status(403).json({ message: "فعّل باقة حتى تقدر تنشر مزاد" });

  if (["overdue", "suspended"].includes(sub.status)) {
    return res.status(403).json({ message: "حسابك مقيد بسبب حالة الاشتراك" });
  }

  const plan = sub.plan;
  const limit = plan.isUnlimited ? plan.fairUseMonthlyLimit : plan.monthlyAuctionLimit;

  if (limit > 0 && sub.auctionsUsedThisPeriod >= limit) {
    return res.status(403).json({ message: "وصلت للحد الشهري للمزادات. رقّي باقتك أو انتظر التجديد." });
  }

  next();
};
