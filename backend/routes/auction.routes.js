import express from "express";
import {
  createAuction,
  getAuctions,
  getAuctionById,
  getWonAuctions,
  getMyBids,
  getMyAuctions,
  getMyOpenDeals,
  getPendingCourierAuctions,
} from "../controllers/auction.controller.js";
import { protect } from "../middleware/auth.js";
import { auctionImageUpload } from "../middleware/upload.js";
import { placeBid, getMyArchivedAuctions, disputeAuction, featureAuction, getFeaturedAuctions } from "../controllers/auction.controller.js";
import { bidLimiter } from "../middleware/rateLimit.js";
import { getArchivedAuctions, getUpcomingAuctions } from "../controllers/auction.controller.js";
import { canCreateAuction } from "../middleware/subscriptionGuard.js";
import { getCreateAuctionDepositPreview } from "../controllers/auction.controller.js";
const router = express.Router();

/* ===== ROUTES الثابتة أولًا ===== */

// مزاداتي (أنا البائع)
router.get("/my", protect, getMyAuctions);

// مزادات تتطلب تحديد شركة توصيل (للبائع)
router.get("/pending-courier", protect, getPendingCourierAuctions);

// مزادات فزت بها
router.get("/won", protect, getWonAuctions);

// مزايداتي
router.get("/bids", protect, getMyBids);

router.get("/upcoming", getUpcomingAuctions);


/* ===== ROUTES الديناميكية بعد ذلك ===== */

// إنشاء مزاد
router.post(
  "/",
  protect,
  auctionImageUpload.array("images", 6),
  canCreateAuction,
  createAuction
);
// تأكيد الاستلام من قبل البائع
// وضع مزايدة
router.post("/:id/bid", protect, bidLimiter, placeBid);
//
//ارشيف المزادات للمستخد

router.get("/archived", getArchivedAuctions);
router.get(
  "/archived/my",
  protect,
  getMyArchivedAuctions
);
router.get("/deals/open", protect, getMyOpenDeals);
router.get("/create/deposit-preview", protect, getCreateAuctionDepositPreview);
// المزادات المدعومة
router.get("/featured", getFeaturedAuctions);

// كل المزادات العامة
router.get("/", getAuctions);

router.get("/:id", protect, getAuctionById);

// تقديم اعتراض على فشل الصفقة
router.post("/:id/dispute", protect, disputeAuction);

// تمييز المزاد (الدعم الممول)
router.post("/:id/feature", protect, featureAuction);

export default router;
