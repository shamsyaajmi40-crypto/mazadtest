import express from "express";
import { protect } from "../middleware/auth.js";
import { rateAuctionUser, getAuctionRatings, getUserRatingSummary } from "../controllers/rating.controller.js";
import Rating from "../models/Rating.js";
import Auction from "../models/Auction.js";

const router = express.Router();

// التحقق مما إذا قام المستخدم بتقييم مستخدم آخر في مزاد معين
router.get("/check/:auctionId", protect, async (req, res) => {
  const exists = await Rating.findOne({
    auction: req.params.auctionId,
    fromUser: req.user._id,
  });
  res.json({ rated: !!exists });
}
);

// ===== جلب المزادات المكتملة التي لم يتم تقييمها بعد =====
router.get("/pending", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // جلب المزادات المكتملة التي شارك فيها المستخدم (كبائع أو فائز)
    const auctions = await Auction.find({
      status: "completed",
      $or: [{ winner: userId }, { seller: userId }],
    }).select("_id title winner seller").lean();

    if (!auctions.length) return res.json({ count: 0, auctions: [] });

    // جلب التقييمات التي قام بها المستخدم (غير التلقائية)
    const auctionIds = auctions.map((a) => a._id);
    const myRatings = await Rating.find({
      auction: { $in: auctionIds },
      fromUser: userId,
      auto: { $ne: true },
    }).select("auction").lean();

    const ratedAuctionIds = new Set(myRatings.map((r) => String(r.auction)));

    // فلتر المزادات التي لم يقيّمها بعد
    const pending = auctions.filter((a) => !ratedAuctionIds.has(String(a._id)));

    return res.json({ count: pending.length, auctions: pending });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
});

router.get("/auction/:auctionId", getAuctionRatings);
// جلب ملخص تقييمات مستخدم معين
router.get("/user/:userId/summary", getUserRatingSummary);
// تقييم مستخدم في مزاد
router.post("/", protect, rateAuctionUser);


export default router;

