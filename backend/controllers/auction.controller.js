import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Notification from "../models/Notification.js";
import PlatformSetting from "../models/PlatformSetting.js";
import {
  calculateBidderDeposit,
  calculateSellerDeposit,
  normalizeDepositPolicy,
  DEFAULT_DEPOSIT_POLICY,
  DEPOSIT_POLICY_KEY,
} from "../utils/helpers.js";
import { getIo } from "../utils/socket.js";
import { enforceBidCooldown, rollbackBidCooldown } from "../utils/bidCooldown.js";
import AuditLog from "../models/AuditLog.js";
import FinanceLog from "../models/FinanceLog.js";
import Subscription from "../models/Subscription.js";
import { validateText, validateNumber, validateFutureDate } from "../utils/validation.js";
import { uploadToR2, deleteFromR2 } from "../utils/r2.js";
import { generateReceiptId, signReceipt } from "../utils/receipt.js";
import { sendReceiptEmail } from "../utils/email.js";
import { sendAppNotification } from "../utils/notification.js";

const BID_COOLDOWN_MS = 5000; // نخليها 5 ثواني
// DEPOSIT_POLICY_KEY is now imported from helpers.js

/* إنشاء مزاد */
export const createAuction = async (req, res) => {
  let lockedDeposit = 0;
  let sellerId = null;

  try {
    const {
      title,
      description,
      category,
      startPrice,
      increment,
      governorate,
      startTime,
      duration
    } = req.body;

    // ✅ التحقق من العنوان والوصف
    const titleVal = validateText(title, { min: 5, max: 100, name: "عنوان المزاد" });
    if (!titleVal.isValid) return res.status(400).json({ message: titleVal.message });

    const descVal = validateText(description, { min: 10, max: 2000, name: "وصف المزاد" });
    if (!descVal.isValid) return res.status(400).json({ message: descVal.message });

    // ✅ التحقق من السعر والزيادة
    const priceVal = validateNumber(startPrice, { min: 1000, max: 100000000, name: "سعر البداية" });
    if (!priceVal.isValid) return res.status(400).json({ message: priceVal.message });

    const incVal = validateNumber(increment, { min: 1000, max: 10000000, name: "مقداد المزايدة" });
    if (!incVal.isValid) return res.status(400).json({ message: incVal.message });

    // ✅ التحقق من التاريخ
    const dateVal = validateFutureDate(startTime, { name: "وقت البدء", minMinutes: 0 });
    if (!dateVal.isValid) return res.status(400).json({ message: dateVal.message });

    // ✅ التحقق من المدة
    const durVal = validateNumber(duration || 24, { min: 1, max: 168, name: "مدة المزاد بالساعات" });
    if (!durVal.isValid) return res.status(400).json({ message: durVal.message });

    const startingPrice = priceVal.value;

    // عربون المشتري (حسب كودك: 2%)
    const [policyDoc, createdAuctionsCount] = await Promise.all([
      PlatformSetting.findOne({ key: DEPOSIT_POLICY_KEY }).select("value").lean(),
      Auction.countDocuments({ owner: req.user._id }),
    ]);
    const depositPolicy = normalizeDepositPolicy(policyDoc?.value || DEFAULT_DEPOSIT_POLICY);
    const isNewSellerForDepositPolicy =
      createdAuctionsCount < depositPolicy.bidder.newUserAuctionThreshold;

    const depositAmount = calculateBidderDeposit(startingPrice, {
      isNewUser: isNewSellerForDepositPolicy,
      policy: depositPolicy,
    });
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ message: "Invalid bidder deposit amount" });
    }
    const subscription = await Subscription.findOne({ user: req.user._id }).populate("plan");
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const strikes = await AuditLog.countDocuments({
      user: req.user._id,
      action: "CONFISCATE_OK",
      createdAt: { $gte: since },
    });
    // عربون البائع
    const planCode = subscription?.plan?.code || subscription?.planCode || "USER_FREE";
    const sellerDeposit = calculateSellerDeposit(startingPrice, planCode, strikes, depositPolicy);

    sellerId = req.user._id;

    // تحقق سريع وتصحيح نوع الرصيد אם كان نصاً
    const seller = await User.findById(sellerId).select("balance heldBalance").lean();
    let currentBalance = seller?.balance;
    let currentHeld = seller?.heldBalance;

    if (seller && (typeof currentBalance === 'string' || typeof currentHeld === 'string')) {
      currentBalance = Number(currentBalance) || 0;
      currentHeld = Number(currentHeld) || 0;
      await User.collection.updateOne(
        { _id: sellerId },
        { $set: { balance: currentBalance, heldBalance: currentHeld } }
      );
    }

    if (!seller || Number(currentBalance) < sellerDeposit) {
      return res.status(400).json({ message: "Insufficient balance to create auction" });
    }

    // 🔐 حجز عربون البائع (atomic)
    const updated = await User.updateOne(
      { _id: sellerId },
      { $inc: { balance: -sellerDeposit, heldBalance: sellerDeposit } }
    );

    if (updated.modifiedCount === 0) {
      return res.status(409).json({ message: "Failed to lock seller deposit" });
    }

    lockedDeposit = sellerDeposit;

    const start = dateVal.date || new Date();
    const durationHours = durVal.value;
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    // 🖼️ الصور (الرفع لـ Cloudflare R2)
    let images = [];
    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map((file) => uploadToR2(file));
        images = await Promise.all(uploadPromises);
      } catch (uploadErr) {
        console.error("Failed to upload images to R2:", uploadErr);
        // في حال فشل الرفع، نُعيد العربون المحجوز (Rollback)
        if (lockedDeposit > 0 && sellerId) {
          const rbResult = await User.updateOne(
            { _id: sellerId, heldBalance: { $gte: lockedDeposit } },
            { $inc: { heldBalance: -lockedDeposit, balance: lockedDeposit } }
          );

          if (rbResult.modifiedCount > 0) {
            try {
              await AuditLog.create({
                action: "REFUND",
                user: sellerId,
                amount: lockedDeposit,
                reason: "استرجاع عربون بائع بسبب فشل نشر رفع الصور (شبكة)",
                by: "SYSTEM"
              });

              if (seller?.email) {
                sendReceiptEmail({
                  to: seller.email,
                  userName: req.user?.name || "مستخدم مزاد",
                  receiptId: "ERR-" + Date.now(),
                  amount: lockedDeposit,
                  type: "DEPOSIT_REFUND",
                  date: new Date(),
                  details: "إرجاع عربون إنشاء المزاد بسبب فشل رفع الصور (حالة استثنائية)."
                }).catch(e => console.error("Email err:", e));
              }
            } catch (auditErr) { console.error("Audit log rb1 failed:", auditErr) }
          }
        }
        return res.status(500).json({ message: "فشل رفع الصور، يرجى المحاولة لاحقاً" });
      }
    }

    // 🏗️ إنشاء المزاد
    const auction = await Auction.create({
      title: titleVal.text,
      description: descVal.text,
      category,
      governorate,
      startingPrice,
      currentPrice: startingPrice,
      depositAmount,
      sellerDeposit,
      increment: incVal.value,
      startTime: start,
      endTime: end,
      images,
      seller: sellerId,
      owner: sellerId,
      status: "pending",
    });
    await Subscription.updateOne(
      { user: req.user._id },
      { $inc: { auctionsUsedThisPeriod: 1 } }
    );
    // (اختياري) سجل لوج للحجز
    try {
      await AuditLog.create({
        action: "SELLER_DEPOSIT_LOCKED", // استخدم قيمة موجودة عندك بالـ enum
        auction: auction._id,
        auctionId: String(auction._id),
        user: sellerId,
        userId: String(sellerId),
        amount: sellerDeposit,
        reason: "Seller deposit locked on auction creation (pending)",
        by: "SYSTEM",
      });
    } catch (logErr) {
      console.error("AuditLog failed (SELLER_DEPOSIT_LOCKED):", logErr);
      // لا ترجع error ولا توقف العملية
    }

    // إشعار الأدمن بأن هناك مزاد جديد بانتظار الموافقة
    const io = req.app.get("io");
    if (io) io.to("admin_room").emit("admin_refresh");

    return res.status(201).json(auction);
  } catch (error) {
    console.error("Create auction error:", error);

    // ✅ Rollback إذا تم حجز عربون وفشل إنشاء المزاد لأي سبب
    if (lockedDeposit > 0 && sellerId) {
      try {
        const rbRes = await User.updateOne(
          { _id: sellerId, heldBalance: { $gte: lockedDeposit } },
          { $inc: { heldBalance: -lockedDeposit, balance: lockedDeposit } }
        );
        if (rbRes.modifiedCount > 0) {
          await AuditLog.create({
            action: "REFUND",
            user: sellerId,
            amount: lockedDeposit,
            reason: "استرجاع عربون إنشاء מזاد إثر خطأ برمجي بالنظام",
            by: "SYSTEM"
          });
        }
      } catch (rbErr) {
        console.error("Rollback seller deposit failed:", rbErr);
      }
    }

    return res.status(500).json({ message: "Failed to create auction" });
  }
};

export const getCreateAuctionDepositPreview = async (req, res) => {
  try {
    const startingPrice = Number(req.query.startPrice);
    if (!Number.isFinite(startingPrice) || startingPrice <= 0) {
      return res.status(400).json({ message: "Invalid starting price" });
    }

    const [policyDoc, subscription] = await Promise.all([
      PlatformSetting.findOne({ key: DEPOSIT_POLICY_KEY }).select("value").lean(),
      Subscription.findOne({ user: req.user._id }).populate("plan"),
    ]);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const strikes = await AuditLog.countDocuments({
      user: req.user._id,
      action: "CONFISCATE_OK",
      createdAt: { $gte: since },
    });

    const planCode = subscription?.plan?.code || subscription?.planCode || "USER_FREE";
    const policy = normalizeDepositPolicy(policyDoc?.value || DEFAULT_DEPOSIT_POLICY);
    const sellerDeposit = calculateSellerDeposit(startingPrice, planCode, strikes, policy);

    return res.json({
      sellerDeposit,
      currency: "IQD",
      planCode,
      strikes,
      message:
        "This amount will be held during review/publish and returned when rules are respected.",
    });
  } catch (error) {
    console.error("getCreateAuctionDepositPreview error:", error);
    return res.status(500).json({ message: "Failed to load deposit preview" });
  }
};

//
export const getArchivedAuctions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const archivedStatuses = [
      "ended",
      "completed",
      "cancelled_by_winner",
      "cancelled_by_seller",
      "cancelled_by_both",
      "rejected",
    ];

    const filter = {
      isDeleted: false,
      status: { $in: archivedStatuses },
    };

    const [auctions, total] = await Promise.all([
      Auction.find(filter)
        .populate("seller", "name")
        .populate("winner", "name")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Auction.countDocuments(filter),
    ]);

    res.json({
      auctions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get archived auctions error:", error);
    res.status(500).json({ message: "فشل جلب الأرشيف" });
  }
};

// جلب مزادات المستخدم
export const getMyAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find({
      owner: req.user._id,

    }).populate("owner", "name").sort({ createdAt: -1 });

    res.json(auctions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch my auctions" });
  }
};
// جلب المزادات التي شارك فيها المستخدم
export const getMyBids = async (req, res) => {
  const bids = await Bid.find({ bidder: req.user._id }).select("auction");

  const auctionIds = bids.map((b) => b.auction);

  const auctions = await Auction.find({
    _id: { $in: auctionIds },
  }).populate("owner", "name");

  res.json(auctions);
};
// جلب المزادات التي فاز بها المستخدم
export const getWonAuctions = async (req, res) => {
  const auctions = await Auction.find({
    winner: req.user._id,
    status: { $in: ["ENDED"] },
  }).populate("owner", "name").populate("seller", "name");

  res.json(auctions);
};
/* جلب المزادات العامة */
export const getAuctions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      governorate,
      category,
      minPrice,
      maxPrice,
      searchTerm,
    } = req.query;

    const pageNumber = Math.max(1, Number(page));
    const pageSize = Math.min(50, Number(limit)); // حماية
    const skip = (pageNumber - 1) * pageSize;

    const now = new Date();

    const matchQuery = {
      status: "active",
      isDeleted: false,
    };

    if (governorate && governorate !== "الكل") {
      matchQuery.governorate = {
        $regex: `^${governorate}$`,
        $options: "i",
      };
    }

    if (category && category !== "ALL") {
      matchQuery.category = category;
    }

    if (minPrice || maxPrice) {
      matchQuery.currentPrice = {};
      if (minPrice) matchQuery.currentPrice.$gte = Number(minPrice);
      if (maxPrice) matchQuery.currentPrice.$lte = Number(maxPrice);
    }

    if (searchTerm) {
      matchQuery.title = {
        $regex: searchTerm,
        $options: "i",
      };
    }

    // ===== COUNT =====
    const total = await Auction.countDocuments(matchQuery);

    // ===== DATA =====
    const auctions = await Auction.aggregate([
      { $match: matchQuery },

      {
        $lookup: {
          from: "bids",
          localField: "_id",
          foreignField: "auction",
          as: "bids",
        },
      },

      {
        $addFields: {
          bidsCount: { $size: "$bids" },

          minutesLeft: {
            $divide: [
              { $subtract: ["$endTime", now] },
              1000 * 60,
            ],
          },

          createdHours: {
            $divide: [
              { $subtract: [now, "$createdAt"] },
              1000 * 60 * 60,
            ],
          },
        },
      },

      // ⭐ Smart Score
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ["$bidsCount", 10] },

              {
                $cond: [
                  { $lte: ["$minutesLeft", 10] },
                  40,
                  {
                    $cond: [
                      { $lte: ["$minutesLeft", 30] },
                      25,
                      {
                        $cond: [
                          { $lte: ["$minutesLeft", 60] },
                          10,
                          0,
                        ],
                      },
                    ],
                  },
                ],
              },

              {
                $cond: [
                  { $lte: ["$createdHours", 24] },
                  8,
                  0,
                ],
              },
            ],
          },
        },
      },

      {
        $addFields: {
          isCurrentlyFeatured: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isFeatured", true] },
                  { $gt: ["$featuredUntil", now] }
                ]
              },
              1,
              0
            ]
          }
        }
      },
      {
        $sort: {
          isCurrentlyFeatured: -1,
          featuredPriority: -1,
          score: -1,
          endTime: 1,
          createdAt: -1,
        },
      },

      { $skip: skip },
      { $limit: pageSize },

      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
        },
      },
      {
        $unwind: {
          path: "$owner",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          bids: 0,
          score: 0,
          minutesLeft: 0,
          createdHours: 0,
          "owner.password": 0,
          "owner.balance": 0,
          "owner.heldBalance": 0,
          "owner.__v": 0,
        },
      },
    ]);

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      auctions,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
        hasNext: pageNumber < totalPages,
        hasPrev: pageNumber > 1,
      },
    });

  } catch (error) {
    console.error("Get auctions error:", error);
    res.status(500).json({ message: "Failed to fetch auctions" });
  }
};
// جلب المزادات الأكثر نشاطاً (hot auctions)
export const getHotAuctions = async (req, res) => {
  try {
    const now = new Date();

    const auctions = await Auction.aggregate([
      {
        $match: {
          status: "active",
          isDeleted: false,
        },
      },

      {
        $lookup: {
          from: "bids",
          localField: "_id",
          foreignField: "auction",
          as: "bids",
        },
      },

      {
        $addFields: {
          bidsCount: { $size: "$bids" },

          minutesLeft: {
            $divide: [
              { $subtract: ["$endTime", now] },
              1000 * 60,
            ],
          },

          createdHours: {
            $divide: [
              { $subtract: [now, "$createdAt"] },
              1000 * 60 * 60,
            ],
          },
        },
      },

      {
        $addFields: {
          hotScore: {
            $add: [
              { $multiply: ["$bidsCount", 10] },

              {
                $cond: [
                  { $lte: ["$minutesLeft", 10] },
                  50,
                  {
                    $cond: [
                      { $lte: ["$minutesLeft", 30] },
                      30,
                      {
                        $cond: [
                          { $lte: ["$minutesLeft", 60] },
                          15,
                          0,
                        ],
                      },
                    ],
                  },
                ],
              },

              {
                $cond: [
                  { $lte: ["$createdHours", 24] },
                  10,
                  0,
                ],
              },
            ],
          },
        },
      },

      {
        $addFields: {
          isCurrentlyFeatured: {
            $cond: [
              {
                $and: [
                  { $eq: ["$isFeatured", true] },
                  { $gt: ["$featuredUntil", now] }
                ]
              },
              1,
              0
            ]
          }
        }
      },
      { $sort: { isCurrentlyFeatured: -1, featuredPriority: -1, hotScore: -1 } },

      { $limit: 10 },
    ]);

    res.json(auctions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch hot auctions" });
  }
};



/* تفاصيل مزاد */
export const getAuctionById = async (req, res) => {
  const auction = await Auction.findById(req.params.id)
    .populate("seller", "name phone rating")
    .populate("winner", "name phone rating")
    .populate("owner", "name rating")
    .populate({
      path: "deliveryOrder",
      populate: [
        { path: "company", select: "name phone deliveryFee" },
        { path: "agentUser", select: "name phone" },
      ],
    });


  if (!auction) {
    return res.status(404).json({ message: "Auction not found" });
  }

  const bids = await Bid.find({ auction: auction._id })
    .populate("bidder", "name rating")
    .sort({ amount: -1 })
    .lean();

  const maskedBids = bids.map((b, i) => ({
    amount: b.amount,
    bidder: b.bidder,
    createdAt: b.createdAt,
  }));

  const isWinnerForPhone =
    auction.status === "ENDED" &&
    auction.winner &&
    req.user &&
    String(auction.winner._id || auction.winner) === String(req.user._id);

  const sellerData = {
    _id: auction.seller._id,
    name: auction.seller.name,
  };

  // إظهار هاتف البائع فقط للفائز بعد انتهاء المزاد
  if (isWinnerForPhone) {
    sellerData.phone = auction.seller.phone;
  }

  // ✅ OTP visibility (Courier Mode) — يظهر فقط لصاحبه
  const userId = req.user?._id?.toString();

  const isWinner =
    userId &&
    auction.winner &&
    String(auction.winner._id || auction.winner) === userId;

  const isSeller =
    userId &&
    auction.seller &&
    String(auction.seller._id || auction.seller) === userId;

  const auctionObj = auction.toObject();

  if (auctionObj.deliveryMode === "courier") {
    auctionObj.deliveryOtpCode = isWinner ? auctionObj.deliveryOtpCode : null;
    auctionObj.payoutOtpCode = isSeller ? auctionObj.payoutOtpCode : null;
  } else {
    // احتياط: لا نعرض OTP بأي حال لو مو courier
    auctionObj.deliveryOtpCode = null;
    auctionObj.payoutOtpCode = null;
  }

  res.json({
    auction: {
      ...auctionObj,
      seller: sellerData,
    },
    bids: maskedBids,
  });



};
// حذف مزاد (soft delete)
export const deleteAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    auction.isDeleted = true;
    await auction.save();

    res.json({ message: "Auction deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};


// وضع مزايدة
export const placeBid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. جلب المزاد داخل الـ session
    const auction = await Auction.findOne({
      _id: req.params.id,
      status: "active",
    }).session(session);

    if (!auction) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Auction not active" });
    }

    if (auction.seller.toString() === req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Seller cannot bid" });
    }

    // 2. Cooldown ذري (خارج الـ session — Redis/DB خاص)
    const cd = await enforceBidCooldown({
      userId: req.user._id,
      auctionId: req.params.id,
      windowMs: BID_COOLDOWN_MS,
    });

    if (!cd.allowed) {
      await session.abortTransaction();
      const retryAfterMs =
        cd.retryAfterMs || Math.max(0, new Date(cd.nextAllowedAt).getTime() - Date.now());
      return res.status(429).json({
        message: "يرجى الانتظار قبل إرسال مزايدة جديدة",
        retryAfter: Math.ceil(retryAfterMs / 1000),
        retryAfterMs,
        nextAllowedAt: cd.nextAllowedAt,
      });
    }

    // 3. التحقق من المبلغ
    const amountVal = validateNumber(req.body.amount, { min: 1000, max: 1000000000, name: "مبلغ المزايدة" });
    if (!amountVal.isValid) {
      await session.abortTransaction();
      await rollbackBidCooldown({ userId: req.user._id, auctionId: req.params.id });
      return res.status(400).json({ message: amountVal.message });
    }
    const amount = amountVal.value;

    const minBid = auction.currentPrice + auction.increment;
    if (amount < minBid) {
      await session.abortTransaction();
      await rollbackBidCooldown({ userId: req.user._id, auctionId: req.params.id });
      return res.status(400).json({
        message: `المبلغ قليل جداً. أقل مزايدة مسموحة هي ${minBid.toLocaleString()} دينار.`
      });
    }

    const now = new Date();
    if (auction.endTime <= now) {
      await session.abortTransaction();
      await rollbackBidCooldown({ userId: req.user._id, auctionId: req.params.id });
      return res.status(400).json({ message: "انتهى المزاد" });
    }

    // 4. هل سبق للمستخدم المزايدة في هذا المزاد؟ (داخل الـ session)
    const existingBid = await Bid.findOne({
      auction: auction._id,
      bidder: req.user._id,
    }).session(session);

    // 5. الحد الأقصى للمزادات النشطة (فقط للمزايدة الأولى)
    if (!existingBid) {
      const MAX_ACTIVE_AUCTIONS = 10;
      const activeParticipations = await Bid.aggregate([
        { $match: { bidder: req.user._id } },
        { $group: { _id: "$auction" } },
        { $lookup: { from: "auctions", localField: "_id", foreignField: "_id", as: "auc" } },
        { $unwind: "$auc" },
        { $match: { "auc.status": "active" } },
        { $count: "count" },
      ]).session(session);

      const currentCount = activeParticipations[0]?.count || 0;
      if (currentCount >= MAX_ACTIVE_AUCTIONS) {
        await session.abortTransaction();
        await rollbackBidCooldown({ userId: req.user._id, auctionId: req.params.id });
        return res.status(403).json({
          message: `عذراً، لا يمكنك المزايدة في أكثر من ${MAX_ACTIVE_AUCTIONS} مزادات نشطة في وقت واحد.`,
        });
      }
    }

    const deposit = auction.depositAmount;
    if (!deposit || deposit <= 0) {
      await session.abortTransaction();
      await rollbackBidCooldown({ userId: req.user._id, auctionId: req.params.id });
      return res.status(400).json({ message: "Bidding is not allowed without a deposit" });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // العمليات المالية الثلاث داخل نفس الـ Transaction
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // العملية 1: خصم العربون وحجزه (balance → heldBalance)
    if (!existingBid) {
      const updatedUser = await User.findOneAndUpdate(
        { _id: req.user._id, balance: { $gte: Number(deposit) } },
        { $inc: { balance: -Number(deposit), heldBalance: Number(deposit) } },
        { new: true, session }
      );

      if (!updatedUser) {
        await session.abortTransaction();
        await rollbackBidCooldown({ userId: req.user._id, auctionId: req.params.id });
        return res.status(403).json({ message: "رصيدك غير كافٍ لفتح عربون المزايدة في هذا المزاد" });
      }
    }

    // تمديد وقت المزاد إذا كان ينتهي قريباً
    let newEndTime = new Date(auction.endTime);
    const remaining = newEndTime.getTime() - now.getTime();
    if (remaining <= 2 * 60 * 1000) {
      newEndTime = new Date(newEndTime.getTime() + 2 * 60 * 1000);
    }

    // العملية 2: تحديث المزاد (السعر + الفائز + الوقت)
    const updatedAuction = await Auction.findOneAndUpdate(
      {
        _id: auction._id,
        status: "active",
        endTime: { $gt: now },
        currentPrice: { $lt: amount },
      },
      {
        $set: {
          currentPrice: amount,
          winner: req.user._id,
          lastBidAt: now,
          endTime: newEndTime,
        },
        $inc: { bidCount: 1 },
      },
      { new: true, session }
    );

    if (!updatedAuction) {
      await session.abortTransaction();
      await rollbackBidCooldown({ userId: req.user._id, auctionId: req.params.id });
      return res.status(409).json({ message: "Bid rejected (price changed or auction ended)." });
    }

    // العملية 3: إنشاء سجل المزايدة
    await Bid.create(
      [
        {
          auction: updatedAuction._id,
          bidder: req.user._id,
          amount,
          depositHeld: !existingBid && deposit > 0,
        },
      ],
      { session }
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Commit — يتم بعد نجاح العمليات الثلاث
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await session.commitTransaction();

    // الرد على المستخدم
    res.json({ message: "Bid placed", auction: updatedAuction });

    // إشعار المتزايد السابق (بعد commit وخارج الـ session)
    if (auction.winner && auction.winner.toString() !== req.user._id.toString()) {
      sendAppNotification({
        userId: auction.winner,
        title: "تمت المزايدة عليك! ⚠️",
        message: `لقد قام أحدهم بالمزايدة بمبلغ أعلى منك في مزاد "${auction.title}". قم بالمزايدة الآن للاحتفاظ بفرصة الفوز!`,
        event: "OUTBID",
        type: "SYSTEM"
      });
    }

    // بث WebSocket (بعد commit فقط)
    const io = req.app.get("io");
    if (io) {
      Bid.find({ auction: updatedAuction._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("bidder", "name")
        .lean()
        .then((latestBids) => {
          io.to(updatedAuction._id.toString()).emit("bid:new", {
            auction: updatedAuction,
            bids: latestBids,
          });
        });
    }
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("placeBid error:", err);
    await rollbackBidCooldown({ userId: req.user._id, auctionId: req.params.id }).catch(() => { });
    return res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
};


export const getCompletedAuctions = async (req, res) => {
  try {
    const { result } = req.query;

    const query = {
      status: { $in: ["ENDED", "ended"] },
      isDeleted: false,
    };

    if (result === "withWinner") {
      query.winner = { $ne: null };
    }

    if (result === "withoutWinner") {
      query.winner = null;
    }

    const auctions = await Auction.find(query).populate("owner", "name").sort({ endTime: -1 });

    res.json(auctions);
  } catch (err) {
    res.status(500).json({ message: "Failed to load archive" });
  }
};
export const releaseDepositsForLosers = async (auctionId) => {
  const auction = await Auction.findById(auctionId);
  if (!auction) return;

  const deposit = auction.depositAmount || 0;
  if (deposit <= 0) return;

  // جلب كل المزايدات
  const bids = await Bid.find({ auction: auctionId });

  // استخراج المزايدين بدون الفائز
  const loserIds = [
    ...new Set(
      bids
        .map((b) => b.bidder.toString())
        .filter(
          (bidderId) =>
            !auction.winner ||
            bidderId !== auction.winner.toString()
        )
    ),
  ];

  for (const userId of loserIds) {
    // ✅ تحديث ذري (Atomic Update) لمنع تضارب العمليات
    const res = await User.updateOne(
      { _id: userId, heldBalance: { $gte: deposit } },
      { $inc: { heldBalance: -deposit, balance: deposit } }
    );

    if (res.modifiedCount > 0) {
      // ✅ تسجيل العملية في سجل التدقيق المالي (Audit Log)
      try {
        await AuditLog.create({
          action: "REFUND",
          auction: auction._id,
          user: userId,
          amount: deposit,
          reason: "إعادة عربون المزايدة بعد خسارة المزاد",
          by: "SYSTEM",
          source: "BUYER"
        });
      } catch (logErr) {
        console.error("AuditLog creation failed in releaseDepositsForLosers:", logErr);
      }
    } else {
      console.warn(`[RELEASE_DEPOSIT_FAIL] User ${userId} may not have enough heldBalance for auction ${auctionId}`);
    }
  }
};









export const getMyArchivedAuctions = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const archivedStatuses = [
      "completed",
      "ENDED",
      "cancelled_by_winner",
      "cancelled_by_seller",
      "cancelled_by_both",
      "rejected",
      "failed"
    ];

    // Find all auctions this user bid on (so "participated" tab works for lost auctions too)
    const userBids = await Bid.find({ bidder: userId }).select("auction").lean();
    const biddedAuctionIds = userBids.map((b) => b.auction);

    const filter = {
      status: { $in: archivedStatuses },
      $or: [
        { owner: userId },
        { winner: userId },
        { _id: { $in: biddedAuctionIds } } // participated but lost
      ],
    };

    const total = await Auction.countDocuments(filter);

    let auctions = await Auction.find(filter)
      .populate("owner", "name")
      .populate("winner", "name")
      .sort({ endedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch user's ratings to attach to the payload
    const auctionIds = auctions.map((a) => a._id);
    const userRatings = await Rating.find({
      auction: { $in: auctionIds },
      fromUser: userId,
    }).lean();

    const ratedAuctionIds = new Set(userRatings.map((r) => r.auction.toString()));

    auctions = auctions.map((auction) => ({
      ...auction,
      ratings: ratedAuctionIds.has(auction._id.toString())
        ? [{ from: userId }] // Mock structure expected by frontend
        : [],
    }));

    res.json({
      auctions,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (err) {
    console.error("getMyArchivedAuctions error:", err);
    res.status(500).json({ message: "Failed to load user archive" });
  }
};

export const getMyOpenDeals = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const filter = {
      status: { $in: ["ENDED", "ended"] },
      winner: { $ne: null },
      $or: [{ owner: userId }, { winner: userId }],
    };

    const total = await Auction.countDocuments(filter);
    const auctions = await Auction.find(filter)
      .populate("owner", "name")
      .populate("winner", "name")
      .populate({
        path: "deliveryOrder",
        populate: [{ path: "company", select: "name phone deliveryFee" }],
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      auctions,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (err) {
    console.error("getMyOpenDeals error:", err);
    res.status(500).json({ message: "Failed to load open deals" });
  }
};

// معاقبة الفائز إذا لم يؤكد في الوقت المحدد
// ❌ هذه الدالة مُلغاة
// تم استبدال منطق العقوبة بـ Cron مستقل (auctionPenalty.js)
// لا يجب استخدام هذه الدالة مرة أخرى

export const punishWinnerIfNotConfirmed = async () => {
  return;
};
export const getUpcomingAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find({
      status: "upcoming",
    })
      .sort({ startTime: 1 })
      .limit(12);

    res.json(auctions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch upcoming auctions" });
  }
};

export const disputeAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id.toString();

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ message: "يرجى كتابة سبب واضح للاعتراض." });
    }

    const auction = await Auction.findById(id);
    if (!auction) return res.status(404).json({ message: "المزاد غير موجود." });

    if (auction.status !== "ENDED" && auction.status !== "ended") {
      return res.status(400).json({ message: "المزاد ليس في حالة انتهاء." });
    }

    if (auction.penaltyApplied) {
      return res.status(400).json({ message: "تم تطبيق العقوبة مسبقاً، لا يمكن الاعتراض الآن." });
    }

    if (auction.isDisputed) {
      return res.status(400).json({ message: "يوجد اعتراض قيد المراجعة بالفعل." });
    }

    const reviewUntil = auction.confirmationDeadline ? new Date(auction.confirmationDeadline).getTime() : 0;
    if (!reviewUntil || Date.now() >= reviewUntil) {
      return res.status(400).json({ message: "انتهت مهلة المراجعة 24 ساعة." });
    }

    const isWinner = auction.winner && auction.winner.toString() === userId;
    const isSeller = auction.seller && auction.seller.toString() === userId;

    if (!isWinner && !isSeller) {
      return res.status(403).json({ message: "غير مصرح لك بتقديم اعتراض." });
    }

    auction.isDisputed = true;
    auction.disputeReason = `اعتراض من (${isSeller ? 'البائع' : 'المشتري'}): ${reason}`;
    await auction.save();

    // إشعار للإدارة (يمكنك إضافته لو يوجد موديل للإدارة أو إرساله سوكيت)
    return res.json({ message: "تم تسجيل اعتراضك بنجاح. سيتم إيقاف الغرامة مؤقتاً لحين مراجعة المشرفين." });

  } catch (error) {
    console.error("Dispute Error:", error);
    res.status(500).json({ message: "حدث خطأ أثناء تقديم الاعتراض." });
  }
};


export const featureAuction = async (req, res) => {
  try {
    const { id } = req.params;
    const { duration } = req.body;
    const userId = req.user._id.toString();

    // 1. Validation
    const validDurations = {
      "1d": { ms: 24 * 60 * 60 * 1000, price: 3000, priority: 1 },
      "3d": { ms: 3 * 24 * 60 * 60 * 1000, price: 7000, priority: 2 },
      "7d": { ms: 7 * 24 * 60 * 60 * 1000, price: 15000, priority: 3 },
    };

    if (!validDurations[duration]) {
      return res.status(400).json({ message: "مدة التمييز غير صالحة." });
    }

    const tier = validDurations[duration];

    // 2. Fetch Auction & User
    const [auction, user, basePlatformUser] = await Promise.all([
      Auction.findById(id),
      User.findById(userId),
      process.env.PLATFORM_USER_ID ? User.findById(process.env.PLATFORM_USER_ID) : null
    ]);

    if (!auction) return res.status(404).json({ message: "المزاد غير موجود." });
    if (auction.owner.toString() !== userId) return res.status(403).json({ message: "غير مصرح لك بتمييز هذا المزاد." });
    if (auction.status !== "active" && auction.status !== "pending" && auction.status !== "upcoming") {
      return res.status(400).json({ message: "لا يمكن تمييز مزاد منتهي أو ملغى." });
    }

    // 3. User Limit Check (Max 5 active featured auctions)
    const activeFeaturedCount = await Auction.countDocuments({
      owner: userId,
      isFeatured: true,
      featuredUntil: { $gt: new Date() },
      _id: { $ne: auction._id } // Exclude this one if extending
    });

    if (activeFeaturedCount >= 5) {
      return res.status(400).json({ message: "لقد وصلت للحد الأقصى (5 مزادات مميزة في نفس الوقت)." });
    }

    // 4. Financial Check & Deduction
    if (user.balance < tier.price) {
      return res.status(400).json({ message: "رصيدك غير كافٍ لعملية التمييز." });
    }

    // Deduct from user
    await User.updateOne({ _id: userId }, { $inc: { balance: -tier.price } });

    // Add to Platform User
    if (basePlatformUser) {
      await User.updateOne({ _id: basePlatformUser._id }, { $inc: { balance: tier.price } });
    }

    // 5. Update Auction
    const now = new Date();
    // If it's already featured and active, extend the time. Otherwise, start from now.
    let currentExpiry = auction.featuredUntil && auction.featuredUntil > now ? auction.featuredUntil : now;

    // Explicitly set isFeatured true, add MS duration
    const newExpiry = new Date(currentExpiry.getTime() + tier.ms);

    auction.isFeatured = true;
    auction.featuredUntil = newExpiry;
    auction.featuredPriority = Math.max(auction.featuredPriority || 0, tier.priority);

    await auction.save();

    // 6. Audit Logging
    await AuditLog.create({
      action: "FEATURE_AUCTION_PAYMENT",
      user: userId,
      auction: auction._id,
      amount: tier.price,
      reason: `دفع تكلفة تمييز مزاد لمدة ${duration}`,
      by: "USER",
    });

    // 7. Finance Log (for financial reports)
    await FinanceLog.create({
      user: userId,
      type: "FEATURE_AUCTION_PAYMENT",
      amountIQD: tier.price,
      refModel: "Auction",
      refId: auction._id,
      meta: {
        duration,
        featuredUntil: auction.featuredUntil,
        platformUserId: basePlatformUser?._id || null,
        note: `تمييز مزاد "${auction.title}" لمدة ${duration}`,
      },
    });

    res.json({ message: "تم تمييز المزاد بنجاح!", featuredUntil: auction.featuredUntil });
  } catch (err) {
    console.error("featureAuction error:", err);
    res.status(500).json({ message: "فشل في عملية التمييز." });
  }
};

// جلب المزادات المميزة (Featured Auctions)
export const getFeaturedAuctions = async (req, res) => {
  try {
    const now = new Date();
    const auctions = await Auction.aggregate([
      {
        $match: {
          status: "active",
          isDeleted: false,
          isFeatured: true,
          featuredUntil: { $gt: now }
        }
      },
      {
        $lookup: {
          from: "bids",
          localField: "_id",
          foreignField: "auction",
          as: "bids",
        },
      },
      {
        $addFields: {
          bidsCount: { $size: "$bids" }
        }
      },
      {
        $sort: {
          featuredPriority: -1,
          createdAt: -1
        }
      },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
        },
      },
      {
        $unwind: {
          path: "$owner",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          bids: 0,
          "owner.password": 0,
          "owner.balance": 0,
          "owner.heldBalance": 0,
          "owner.__v": 0,
        },
      },
    ]);

    res.json(auctions);
  } catch (error) {
    console.error("Get featured auctions error:", error);
    res.status(500).json({ message: "Failed to fetch featured auctions" });
  }
};
