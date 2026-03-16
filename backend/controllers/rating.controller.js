import Rating from "../models/Rating.js";
import Auction from "../models/Auction.js";
import User from "../models/User.js";

// ✅ Reasons that belong to seller's fault
const SELLER_FAULT_REASONS = ["SELLER_NO_SHOW", "SELLER_NOT_READY"];

// ✅ Reasons that belong to buyer's fault
const BUYER_FAULT_REASONS = [
  "BUYER_NO_SHOW",
  "BUYER_REFUSED",
  "BUYER_DID_NOT_RECEIVE",
  "BUYER_UNREACHABLE",
  "WRONG_ADDRESS",
];

// 🔑 Normalize any ID to a plain string for comparison
const normalizeId = (val) => {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (val._id) return val._id.toString();
  return val.toString();
};

/**
 * ✅ Determines if a user is ALLOWED to rate based on deal outcome.
 *
 * Rules:
 * - "completed": both buyer and seller can rate each other ✅
 * - "cancelled_by_both": neither party can rate (both were at fault) ❌
 * - "cancelled_by_winner": only the seller can rate the buyer (buyer was at fault) ✅
 * - "cancelled_by_seller": only the buyer can rate the seller (seller was at fault) ✅
 * - Courier failure with SELLER fault: only winner (buyer) can rate ✅
 * - Courier failure with BUYER fault: only seller can rate ✅
 */
const canUserRate = (auction, fromId) => {
  const status = String(auction.status || "").toLowerCase();
  const winnerId = normalizeId(auction.winner);
  const ownerId = normalizeId(auction.owner);

  const isWinner = fromId === winnerId;
  const isOwner = fromId === ownerId;

  if (!isWinner && !isOwner) {
    return { allowed: false, reason: "Not a participant in this auction" };
  }

  // ✅ Deal completed successfully: both can rate
  if (status === "completed") {
    return { allowed: true };
  }

  // ❌ Both cancelled: nobody can rate
  if (status === "cancelled_by_both") {
    return { allowed: false, reason: "Both parties cancelled – rating is not allowed" };
  }

  // ❌ Buyer cancelled: only seller can rate
  if (status === "cancelled_by_winner") {
    if (isOwner) return { allowed: true };
    return { allowed: false, reason: "You cancelled the deal – you cannot rate" };
  }

  // ❌ Seller cancelled: only buyer can rate
  if (status === "cancelled_by_seller") {
    if (isWinner) return { allowed: true };
    return { allowed: false, reason: "You cancelled the deal – you cannot rate" };
  }

  // Check courier/delivery failure fault
  const failureReason =
    auction.deliveryPenaltyReason ||
    auction.deliveryOrder?.failureReason ||
    "";

  if (failureReason) {
    if (SELLER_FAULT_REASONS.includes(failureReason)) {
      // Only winner (buyer) can rate the seller
      if (isWinner) return { allowed: true };
      return { allowed: false, reason: "Deal failed due to your actions – you cannot rate" };
    }

    if (BUYER_FAULT_REASONS.includes(failureReason)) {
      // Only owner (seller) can rate the buyer
      if (isOwner) return { allowed: true };
      return { allowed: false, reason: "Deal failed due to your actions – you cannot rate" };
    }
  }

  // Default fallback for other resolved statuses (e.g., manual cancellation with no specific reason)
  return { allowed: true };
};

// جلب ملخص تقييمات مستخدم معين
export const getUserRatingSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    const ratings = await Rating.find({ toUser: userId });

    if (ratings.length === 0) {
      return res.json({ average: null, count: 0 });
    }

    const average =
      ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    res.json({
      average: Number(average.toFixed(1)),
      count: ratings.length,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load rating summary" });
  }
};

// جلب تقييمات مزاد معين
export const getAuctionRatings = async (req, res) => {
  const { auctionId } = req.params;

  const ratings = await Rating.find({ auction: auctionId })
    .populate("fromUser", "name")
    .populate("toUser", "name")
    .sort({ createdAt: -1 });

  res.json(ratings);
};

// 🌟 إرسال تقييم لمستخدم بعد انتهاء مزاد
export const rateAuctionUser = async (req, res) => {
  try {
    const { auctionId, score, reasons, comment } = req.body;

    const fromUser = req.user._id;
    const fromId = req.user._id.toString();

    // 1️⃣ التحقق الأساسي من المدخلات
    if (!auctionId || !score || !Array.isArray(reasons) || reasons.length === 0) {
      return res.status(400).json({ message: "Invalid rating data" });
    }

    if (score < 1 || score > 5) {
      return res.status(400).json({ message: "Score must be between 1 and 5" });
    }

    // ✅ Validate reasons (optional but recommended for data integrity)
    // imports logic should be checked if RATING_REASONS is available here
    // For now, we proceed to other checks

    // 2️⃣ جلب المزاد
    const auction = await Auction.findById(auctionId).populate("deliveryOrder");
    const resolvedStatuses = new Set([
      "completed",
      "cancelled_by_winner",
      "cancelled_by_seller",
      "cancelled_by_both",
    ]);
    const auctionStatus = String(auction?.status || "").toLowerCase();

    if (!auction || !resolvedStatuses.has(auctionStatus)) {
      return res.status(400).json({ message: "Deal is not resolved yet" });
    }

    // 3️⃣ التحقق من أن المستخدم يحق له التقييم بناءً على من تسبب في الفشل
    const permissionCheck = canUserRate(auction, fromId);
    if (!permissionCheck.allowed) {
      return res.status(403).json({ message: permissionCheck.reason });
    }

    // 4️⃣ تحديد من يقيّم من (Buyer → Seller OR Seller → Buyer)
    const winnerId = normalizeId(auction.winner);
    const ownerId = normalizeId(auction.owner);

    let toUser;
    let role;

    if (fromId === winnerId) {
      toUser = auction.owner; // ObjectId
      role = "buyer_to_seller";
    } else if (fromId === ownerId) {
      toUser = auction.winner; // ObjectId
      role = "seller_to_buyer";
    } else {
      return res.status(403).json({ message: "Not allowed to rate" });
    }

    if (!toUser || !fromUser) {
      return res.status(400).json({ message: "Invalid rating users" });
    }

    // 5️⃣ منع التقييم المكرر (نفس المستخدم لنفس المزاد)
    const alreadyRated = await Rating.findOne({
      auction: auction._id,
      fromUser: fromUser,
    });

    if (alreadyRated) {
      return res.status(400).json({ message: "You already rated this auction" });
    }

    // 6️⃣ إنشاء التقييم
    const rating = await Rating.create({
      auction: auction._id,
      fromUser,
      toUser,
      role,
      score,
      reasons,
      comment,
    });

    // 7️⃣ تحديث متوسط تقييم المستخدم المستهدف في مستند User
    const allUserRatings = await Rating.find({ toUser });
    const count = allUserRatings.length;
    const average =
      count > 0 ? allUserRatings.reduce((sum, r) => sum + r.score, 0) / count : 0;

    await User.findByIdAndUpdate(toUser, {
      "rating.average": Number(average.toFixed(1)),
      "rating.count": count,
    });

    res.status(201).json({ message: "Rating submitted", rating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Rating failed" });
  }
};
