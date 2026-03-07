import Plan from "../models/Plan.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import SubscriptionRequest from "../models/SubscriptionRequest.js";
const addOneMonth = (date) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
};

const calcUsage = (sub) => {
  const plan = sub.plan;
  const limit = plan.isUnlimited ? (plan.fairUseMonthlyLimit || 0) : (plan.monthlyAuctionLimit || 0);
  const used = sub.auctionsUsedThisPeriod || 0;
  const remaining = limit > 0 ? Math.max(0, limit - used) : 0;
  return { limit, used, remaining };
};

export const getPlans = async (req, res) => {
  try {
    const { audience } = req.query;
    const filter = { isActive: true };
    if (audience) filter.audience = audience;

    const plans = await Plan.find(filter).sort({ priceIQD: 1 });
    res.json(plans);
  } catch (err) {
    console.error("getPlans error:", err);
    res.status(500).json({ message: "Failed to load plans" });
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const sub = await Subscription.findOne({ user: req.user._id }).populate("plan");
    if (!sub) return res.json(null);

    const plan = sub.plan;

    const limit = plan.isUnlimited
      ? (plan.fairUseMonthlyLimit || 0)
      : (plan.monthlyAuctionLimit || 0);

    const used = sub.auctionsUsedThisPeriod || 0;
    const remaining = limit > 0 ? Math.max(0, limit - used) : 0;

    // اختياري: طلب ترقية قيد المعالجة
    const pendingRequest = await SubscriptionRequest.findOne({
      user: req.user._id,
      status: "pending",
    })
      .populate("plan", "code name priceIQD audience")
      .lean();

    return res.json({
      subscription: sub,
      usage: { limit, used, remaining },
      pendingRequest: pendingRequest || null,
    });
  } catch (err) {
    console.error("getMySubscription error:", err);
    return res.status(500).json({ message: "Failed to load subscription" });
  }
};

export const choosePlan = async (req, res) => {
  try {
    const { planCode, accountType } = req.body;
    if (!planCode) return res.status(400).json({ message: "planCode مطلوب" });

    const plan = await Plan.findOne({ code: planCode, isActive: true });
    if (!plan) return res.status(404).json({ message: "الباقة غير موجودة" });

    // تحديث نوع الحساب بأمان
    if (accountType && ["user", "trader"].includes(accountType)) {
      await User.updateOne({ _id: req.user._id }, { $set: { accountType } });
    }

    const now = new Date();
    const periodStart = now;
    const periodEnd = addOneMonth(now);

    let sub = await Subscription.findOne({ user: req.user._id });

    if (!sub) {
      sub = await Subscription.create({
        user: req.user._id,
        plan: plan._id,
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        auctionsUsedThisPeriod: 0,
      });
    } else {
      // MVP: تغيير باقة = دورة جديدة
      sub.plan = plan._id;
      sub.status = "active";
      sub.currentPeriodStart = periodStart;
      sub.currentPeriodEnd = periodEnd;
      sub.auctionsUsedThisPeriod = 0;
      await sub.save();
    }

    const populated = await Subscription.findById(sub._id).populate("plan");
    res.json({
      subscription: populated,
      usage: calcUsage(populated),
    });
  } catch (err) {
    console.error("choosePlan error:", err);
    res.status(500).json({ message: "Failed to choose plan" });
  }
};
