import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import BalanceRequest from "../models/BalanceRequest.js";
import ExcelJS from "exceljs";
import Bid from "../models/Bid.js";
import AuditLog from "../models/AuditLog.js";
import CourierCompany from "../models/CourierCompany.js";
import PlatformSetting from "../models/PlatformSetting.js";
import bcrypt from "bcryptjs";
import { DEFAULT_DEPOSIT_POLICY, normalizeDepositPolicy } from "../utils/helpers.js";
import { getIo } from "../utils/socket.js";

//
const DEPOSIT_POLICY_KEY = "deposit_policy";

// جلب أعداد المراجعة للمسؤول
export const getAdminCounters = async (req, res) => {
  try {
    const [pendingAuctions, pendingDisputes] = await Promise.all([
      Auction.countDocuments({ status: "pending" }),
      Auction.countDocuments({ isDisputed: true }),
    ]);

    res.json({
      pendingAuctions,
      pendingDisputes,
    });
  } catch (error) {
    console.error("Admin counters error:", error);
    res.status(500).json({ message: "Failed to load counters" });
  }
};
// رفض مزاد
export const rejectAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // إذا مرفوض مسبقًا لا تعيد الخصم/الترجيع
    if (auction.status === "rejected") {
      return res.json(auction);
    }

    // ✅ رجّع عربون البائع إن وجد
    const deposit = Number(auction.sellerDeposit || 0);

    if (deposit > 0) {
      // atomic refund
      const updated = await User.updateOne(
        { _id: auction.owner, heldBalance: { $gte: deposit } },
        { $inc: { heldBalance: -deposit, balance: deposit } }
      );

      // ✅ سجل AuditLog باستخدام action موجود عندك: REFUND
      const receiptId = generateReceiptId();
      try {
        await AuditLog.create({
          action: updated.modifiedCount > 0 ? "REFUND" : "REFUND_FAILED",
          auction: auction._id,
          user: auction.owner,
          amount: deposit,
          receiptId: updated.modifiedCount > 0 ? receiptId : undefined,
          reason:
            updated.modifiedCount > 0
              ? "Auction rejected - refund seller deposit"
              : "Auction rejected - refund failed (insufficient heldBalance)",
          by: "ADMIN",
          source: "SELLER",
        });

        // ✅ إرسال بريد إلكتروني بالوصل المالي في حال النجاح
        if (updated.modifiedCount > 0) {
          const user = await User.findById(auction.owner).select("name email");
          if (user && user.email) {
            sendReceiptEmail({
              to: user.email,
              userName: user.name,
              receiptId,
              amount: deposit,
              type: "DEPOSIT_REFUND",
              date: new Date(),
              details: `إرجاع عربون المزاد المرفوض: ${auction.title}`
            });
          }
        }
      } catch (logErr) {
        // لا نكسر العملية بسبب AuditLog
        console.error("AuditLog create failed in rejectAuction:", logErr);
      }
    }

    // ✅ بعدها غيّر الحالة
    const { rejectionReasons = [], rejectionNote = "" } = req.body;

    auction.status = "rejected";
    auction.rejectionReasons = rejectionReasons;
    auction.rejectionNote = rejectionNote;
    auction.rejectedAt = new Date();
    await auction.save();

    const sellerId = auction.owner || auction.seller;
    if (sellerId) {
      // تجهيز رسالة واضحة بالأسباب
      let reasonMsg = "";
      if (rejectionReasons.length > 0) {
        reasonMsg = `\nالأسباب: ${rejectionReasons.join(" - ")}`;
      }
      if (rejectionNote) {
        reasonMsg += `\nملاحظة: ${rejectionNote}`;
      }

      const rejectNotif = await Notification.create({
        user: sellerId,
        type: "SYSTEM",
        event: "AUCTION_REJECTED",
        title: "تم رفض المزاد ❌",
        message: `نعتذر، تم رفض المزاد الخاص بك "${auction.title}" من قبل الإدارة.${reasonMsg}`,
        auction: auction._id,
      });
      const io = getIo();
      if (io) {
        io.to("admin_room").emit("admin_refresh");
        io.to(sellerId.toString()).emit("new_notification", rejectNotif);
      }
    } else {
      const io = getIo();
      if (io) io.to("admin_room").emit("admin_refresh");
    }

    return res.json(auction);
  } catch (error) {
    console.error("rejectAuction error:", error);
    return res.status(500).json({ message: "Failed to reject auction" });
  }
};

//  قبول مزاد
export const approveAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.status !== "pending") {
      return res.status(400).json({
        message: `Cannot approve auction in status: ${auction.status}`,
      });
    }

    const now = new Date();
    const originalStart = auction.startTime ? new Date(auction.startTime) : null;
    const originalEnd = auction.endTime ? new Date(auction.endTime) : null;

    // Preserve the originally configured duration, but start counting from approval time
    // when the auction is not scheduled for a future start.
    const hasValidWindow =
      originalStart &&
      originalEnd &&
      Number.isFinite(originalStart.getTime()) &&
      Number.isFinite(originalEnd.getTime()) &&
      originalEnd.getTime() > originalStart.getTime();
    const durationMs = hasValidWindow
      ? originalEnd.getTime() - originalStart.getTime()
      : 24 * 60 * 60 * 1000;

    if (originalStart && originalStart > now) {
      auction.status = "upcoming";
    } else {
      auction.startTime = now;
      auction.endTime = new Date(now.getTime() + durationMs);
      auction.status = "active";
    }

    await auction.save();

    const sellerId = auction.owner || auction.seller;
    if (sellerId) {
      const approveNotif = await Notification.create({
        user: sellerId,
        type: "SYSTEM",
        event: "AUCTION_APPROVED",
        title: "تم قبول المزاد! ✅",
        message: `تمت الموافقة على المزاد الخاص بك "${auction.title}" وهو جاهز للمنصة.`,
        auction: auction._id,
      });
      const io = getIo();
      if (io) {
        io.to("admin_room").emit("admin_refresh");
        io.to(sellerId.toString()).emit("new_notification", approveNotif);
      }
    } else {
      const io = getIo();
      if (io) io.to("admin_room").emit("admin_refresh");
    }

    return res.json(auction);
  } catch (error) {
    console.error("approveAuction error:", error);
    return res.status(500).json({ message: "Failed to approve auction" });
  }
};

export const getPendingAuctions = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const filter = { status: "pending" };

    const total = await Auction.countDocuments(filter);

    const auctions = await Auction.find(filter)
      .populate("seller", "name")
      .sort({ createdAt: -1 })
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
    console.error("getPendingAuctions error:", err);
    res.status(500).json({ message: "Failed to load pending auctions" });
  }
};

/* إحصائيات */
export const getStats = async (req, res) => {
  const totalAuctions = await Auction.countDocuments();
  const pendingAuctions = await Auction.countDocuments({
    status: "pending",
    isDeleted: false,
  });

  return res.json({
    totalAuctions,
    pendingAuctions,
  });
};
export const exportAuctionsToExcel = async (req, res) => {
  const { status, deliveryMode, from, to } = req.query;

  // 🧩 base filter
  const filter = {
    isDeleted: false,
  };

  // 🔹 result filter
  if (status === "success") {
    filter.status = "completed";
  } else if (status === "failed") {
    filter.status = {
      $in: [
        "cancelled_by_winner",
        "cancelled_by_seller",
        "cancelled_by_both",
        "rejected",
        "failed"
      ],
    };
  } else if (status === "no_winner") {
    filter.status = "ENDED";
    filter.winner = null;
  } else {
    // Default: show all archived statuses
    filter.status = {
      $in: [
        "completed",
        "cancelled_by_winner",
        "cancelled_by_seller",
        "cancelled_by_both",
        "rejected",
        "ENDED",
        "failed"
      ],
    };
  }

  // 🔹 delivery mode
  if (deliveryMode) {
    filter.deliveryMode = deliveryMode;
  }

  // 🔹 dates
  if (from || to) {
    filter.updatedAt = {};
    if (from) filter.updatedAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      filter.updatedAt.$lte = toDate;
    }
  }

  const auctions = await Auction.find(filter)
    .populate("seller", "name")
    .populate("winner", "name")
    .sort({ updatedAt: -1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Auctions Archive");

  sheet.columns = [
    { header: "المزاد", key: "title", width: 30 },
    { header: "البائع", key: "seller", width: 20 },
    { header: "الفائز", key: "winner", width: 20 },
    { header: "السعر النهائي", key: "price", width: 15 },
    { header: "الحالة", key: "status", width: 20 },
    { header: "التاريخ", key: "date", width: 20 },
  ];

  auctions.forEach((a) => {
    sheet.addRow({
      title: a.title,
      seller: a.seller?.name || "-",
      winner: a.winner?.name || "-",
      price: a.currentPrice,
      status: a.status,
      date: a.updatedAt?.toISOString().split("T")[0],
    });
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=mazad-archive.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
};
export const getAdminDashboardStats = async (req, res) => {
  try {
    const stats = {};

    // 1️⃣ عدد المزادات
    stats.totalAuctions = await Auction.countDocuments();

    stats.completedAuctions = await Auction.countDocuments({
      status: "completed",
    });

    stats.cancelledAuctions = await Auction.countDocuments({
      status: { $regex: /^cancelled/ },
    });

    stats.activeAuctions = await Auction.countDocuments({
      status: "active",
    });

    // 2️⃣ الأموال
    const revenue = await Auction.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$currentPrice" },
        },
      },
    ]);

    stats.totalRevenue = revenue[0]?.totalRevenue || 0;

    // 3️⃣ المستخدمين
    stats.totalUsers = await User.countDocuments();
    stats.bannedUsers = await User.countDocuments({ isBanned: true });

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Dashboard stats error" });
  }
};
export const getMonthlyCompletedAuctions = async (req, res) => {
  try {
    const data = await Auction.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const formatted = data.map((item) => ({
      label: `${item._id.month}/${item._id.year}`,
      value: item.count,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("monthly stats error:", err);
    res.status(500).json({ message: "Monthly stats error" });
  }
};
//
export const getAdminUsers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search, role, status } = req.query;

    const filter = {};

    // 🔍 البحث بالاسم أو الهاتف
    if (search && search.length >= 2) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // 🎭 فلترة الدور
    if (role) {
      if (role === "user") {
        filter.role = { $in: ["user", null, undefined] };
      } else {
        filter.role = role;
      }
    }

    // ⛔ فلترة الحالة
    if (status === "banned") {
      filter.isBanned = true;
    }
    if (status === "active") {
      filter.isBanned = { $ne: true };
    }

    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select("name phone role isBanned createdAt balance")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      users,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (err) {
    console.error("getAdminUsers error:", err);
    res.status(500).json({ message: "Failed to load users" });
  }
};
export const toggleUserBan = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // لا يمكن للمستخدم حظر نفسه
  if (String(user._id) === String(req.user._id)) {
    return res.status(403).json({ message: "لا يمكنك حظر نفسك" });
  }

  // أدمن عادي لا يمكنه حظر سوبر أدمن أو أدمن آخر
  if (req.user.role === "admin") {
    if (user.role === "superAdmin" || user.role === "admin") {
      return res.status(403).json({ message: "ليس لديك صلاحية لحظر هذا الحساب" });
    }
  }

  user.isBanned = !user.isBanned;
  await user.save();

  res.json({
    message: user.isBanned ? "User banned" : "User unbanned",
    isBanned: user.isBanned,
  });
};

export const toggleUserAdminRole = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // لا يمكن تعديل دور السوبر أدمن أبداً
  if (user.role === "superAdmin") {
    return res.status(403).json({ message: "لا يمكن تعديل صلاحيات المدير العام" });
  }

  // التبديل بين مستخدم ومدير
  user.role = user.role === "admin" ? "user" : "admin";
  await user.save();

  res.json({
    message: user.role === "admin" ? "تمت الترقية إلى مدير" : "تم التخفيض إلى مستخدم",
    role: user.role,
  });
};

export const getAdminUserDetails = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select(
      "name phone role isBanned balance heldBalance createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // إحصائيات بسيطة (نوسعها لاحقًا)
    const auctionsCount = await Auction.countDocuments({
      owner: userId,
    });

    const bidsCount = await Bid.countDocuments({
      bidder: userId,
    });

    const winsCount = await Auction.countDocuments({
      winner: userId,
      status: "completed",
    });

    res.json({
      user,
      stats: {
        auctionsCount,
        bidsCount,
        winsCount,
      },
    });
  } catch (err) {
    console.error("getAdminUserDetails error:", err);
    res.status(500).json({ message: "Failed to load user details" });
  }
};
// ✅ رصيد المنصة الحالي (حساب المنصة المحدد بالـ env)
export const getPlatformBalance = async (req, res) => {
  try {
    const PLATFORM_USER_ID = process.env.PLATFORM_USER_ID;

    if (!PLATFORM_USER_ID) {
      return res.status(400).json({ message: "PLATFORM_USER_ID is not set" });
    }

    const platformUser = await User.findById(PLATFORM_USER_ID)
      .select("balance heldBalance")
      .lean();

    if (!platformUser) {
      return res.json({
        platformUserId: PLATFORM_USER_ID,
        balance: 0,
        heldBalance: 0,
        updatedAt: new Date(),
        warning: "Platform user not found",
      });
    }

    return res.json({
      platformUserId: PLATFORM_USER_ID,
      balance: platformUser.balance || 0,
      heldBalance: platformUser.heldBalance || 0,
      updatedAt: new Date(), // أو platformUser.updatedAt إذا موجود
    });
  } catch (err) {
    console.error("getPlatformBalance error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getPlatformBalanceSources = async (req, res) => {
  try {
    const {
      from,
      to,
      groupBy = "day",
      q = "",
      page = 1,
      limit = 20,
      actions,
    } = req.query;

    const PLATFORM_USER_ID = process.env.PLATFORM_USER_ID;

    let platformBalance = 0;
    if (PLATFORM_USER_ID) {
      const platformUser = await User.findById(PLATFORM_USER_ID).select("balance").lean();
      platformBalance = platformUser?.balance || 0;
    }

    const actionList = actions
      ? String(actions)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      : ["CONFISCATE_OK"];

    const match = { action: { $in: actionList } };

    const createdAt = {};
    if (from) createdAt.$gte = new Date(from);
    if (to) createdAt.$lte = new Date(to);
    if (Object.keys(createdAt).length) match.createdAt = createdAt;

    const search = String(q || "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");

      const orConditions = [{ reason: regex }];

      // If it looks like a valid ObjectId, allow searching by user/auction ID
      if (mongoose.Types.ObjectId.isValid(search)) {
        orConditions.push({ auction: new mongoose.Types.ObjectId(search) });
        orConditions.push({ user: new mongoose.Types.ObjectId(search) });
      }

      match.$or = orConditions;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const baseMatch = { action: { $in: actionList } };

    const [todayAgg] = await AuditLog.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: startOfToday, $lte: now } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const [monthAgg] = await AuditLog.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: startOfMonth, $lte: now } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const todayConfiscations = todayAgg?.total || 0;
    const monthConfiscations = monthAgg?.total || 0;

    const dateKey =
      groupBy === "month"
        ? { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
        : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };

    const grouped = await AuditLog.aggregate([
      { $match: match },
      { $group: { _id: dateKey, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $project: { _id: 0, key: "$_id", total: 1, count: 1 } },
    ]);

    const [recentAgg] = await AuditLog.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                action: 1,
                amount: 1,
                reason: 1,
                createdAt: 1,

                // ✅ يدعم الشكلين: auctionId/userId أو auction/user
                auctionId: {
                  $ifNull: [
                    "$auctionId",
                    { $toString: "$auction" }
                  ]
                },
                userId: {
                  $ifNull: [
                    "$userId",
                    { $toString: "$user" }
                  ]
                },
              },
            }

          ],
          totalCount: [{ $count: "total" }],
        },
      },
    ]);

    const items = recentAgg?.items || [];
    const total = recentAgg?.totalCount?.[0]?.total || 0;
    const pages = Math.ceil(total / limitNum) || 1;

    return res.json({
      platformBalance,
      todayConfiscations,
      monthConfiscations,
      grouped,
      recent: { items, page: pageNum, pages, total, limit: limitNum },
    });
  } catch (err) {
    console.error("getPlatformBalanceSources error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getDepositPolicySettings = async (req, res) => {
  try {
    const doc = await PlatformSetting.findOne({ key: DEPOSIT_POLICY_KEY }).lean();
    const policy = normalizeDepositPolicy(doc?.value || DEFAULT_DEPOSIT_POLICY);
    return res.json({ policy });
  } catch (error) {
    console.error("getDepositPolicySettings error:", error);
    return res.status(500).json({ message: "Failed to load deposit policy" });
  }
};

export const updateDepositPolicySettings = async (req, res) => {
  try {
    const inputPolicy = req.body?.policy || req.body || {};
    const policy = normalizeDepositPolicy(inputPolicy);

    const updated = await PlatformSetting.findOneAndUpdate(
      { key: DEPOSIT_POLICY_KEY },
      { key: DEPOSIT_POLICY_KEY, value: policy, updatedBy: req.user?._id || null },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({
      message: "Deposit policy updated",
      policy: normalizeDepositPolicy(updated?.value || policy),
    });
  } catch (error) {
    console.error("updateDepositPolicySettings error:", error);
    return res.status(500).json({ message: "Failed to update deposit policy" });
  }
};

// ===========================
// Courier Companies (Admin)
// ===========================
export const adminListCourierCompanies = async (req, res) => {
  try {
    const companies = await CourierCompany.find({}).sort({ createdAt: -1 });
    return res.json(companies);
  } catch (e) {
    console.error("adminListCourierCompanies error:", e);
    return res.status(500).json({ message: "Failed to load courier companies" });
  }
};

export const adminCreateCourierCompany = async (req, res) => {
  try {
    const { name, phone = "", isActive = true, deliveryFee = 0 } = req.body;
    if (!name) return res.status(400).json({ message: "name required" });
    const feeNum = Number(deliveryFee);
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      return res.status(400).json({ message: "deliveryFee must be a non-negative number" });
    }

    const company = await CourierCompany.create({ name, phone, isActive, deliveryFee: feeNum });
    return res.json(company);
  } catch (e) {
    console.error("adminCreateCourierCompany error:", e);
    return res.status(500).json({ message: e?.code === 11000 ? "Company name already exists" : "Failed to create company" });
  }
};

export const adminUpdateCourierCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, isActive, deliveryFee } = req.body;

    const patch = {};
    if (name !== undefined) patch.name = name;
    if (phone !== undefined) patch.phone = phone;
    if (isActive !== undefined) patch.isActive = isActive;
    if (deliveryFee !== undefined) {
      const feeNum = Number(deliveryFee);
      if (!Number.isFinite(feeNum) || feeNum < 0) {
        return res.status(400).json({ message: "deliveryFee must be a non-negative number" });
      }
      patch.deliveryFee = feeNum;
    }

    const company = await CourierCompany.findByIdAndUpdate(id, patch, { new: true });
    if (!company) return res.status(404).json({ message: "Company not found" });

    return res.json(company);
  } catch (e) {
    console.error("adminUpdateCourierCompany error:", e);
    return res.status(500).json({ message: "Failed to update company" });
  }
};

export const adminDeleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // لا يمكن للمستخدم حذف نفسه
    if (String(user._id) === String(req.user._id)) {
      return res.status(403).json({ message: "لا يمكنك حذف حسابك الشخصي من هنا" });
    }

    // أدمن عادي لا يمكنه حذف سوبر أدمن أو أدمن آخر
    if (req.user.role === "admin") {
      if (user.role === "superAdmin" || user.role === "admin") {
        return res.status(403).json({ message: "ليس لديك صلاحية لحذف هذا الحساب" });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    // إختياري: حذف المزادات المرتبطة بالمستخدم
    // await Auction.deleteMany({ owner: user._id });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("adminDeleteUser error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

// ===========================
// Courier Staff (Admin)
// ===========================
export const adminListCourierStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: "courier_staff" })
      .select("_id name phone role courierCompany blocked createdAt")
      .populate("courierCompany", "name phone isActive")
      .sort({ createdAt: -1 });

    return res.json(staff);
  } catch (e) {
    console.error("adminListCourierStaff error:", e);
    return res.status(500).json({ message: "Failed to load courier staff" });
  }
};

export const adminAssignCourierStaffToCompany = async (req, res) => {
  try {
    const { staffId, companyId } = req.body;
    if (!staffId || !companyId) {
      return res.status(400).json({ message: "staffId & companyId required" });
    }

    const staff = await User.findById(staffId);
    if (!staff || staff.role !== "courier_staff") {
      return res.status(404).json({ message: "Staff not found" });
    }

    const company = await CourierCompany.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    staff.courierCompany = company._id;
    await staff.save();

    return res.json({ message: "Assigned", staffId, companyId });
  } catch (e) {
    console.error("adminAssignCourierStaffToCompany error:", e);
    return res.status(500).json({ message: "Failed to assign staff" });
  }
};
export const adminListCompanyCourierStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await User.find({ role: "courier_staff", courierCompany: id })
      .select("_id name phone blocked createdAt")
      .sort({ createdAt: -1 });

    return res.json(staff);
  } catch (e) {
    console.error("adminListCompanyCourierStaff error:", e);
    return res.status(500).json({ message: "Failed to load company staff" });
  }
};
export const adminCreateCourierStaffForCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ message: "الاسم، الهاتف، البريد الإلكتروني وكلمة المرور مطلوبة" });
    }

    const company = await CourierCompany.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const exists = await User.findOne({
      $or: [
        { phone },
        { email: email.toLowerCase().trim() }
      ]
    });
    if (exists) return res.status(400).json({ message: "الهاتف أو البريد الإلكتروني مسجل مسبقاً" });

    const hashed = await bcrypt.hash(String(password), 10);

    const staff = await User.create({
      name,
      phone,
      email: email.toLowerCase().trim(),
      password: hashed,
      role: "courier_staff",
      courierCompany: company._id,
      blocked: false,
    });

    return res.json({
      _id: staff._id,
      name: staff.name,
      phone: staff.phone,
      role: staff.role,
      courierCompany: staff.courierCompany,
    });
  } catch (e) {
    console.error("adminCreateCourierStaffForCompany error:", e);
    return res.status(500).json({ message: "Failed to create staff" });
  }
};

export const adminDeleteCourierStaff = async (req, res) => {
  try {
    const { companyId, staffId } = req.params;

    const staff = await User.findOneAndDelete({
      _id: staffId,
      courierCompany: companyId,
      role: { $in: ["courier_staff", "courier_agent"] }
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff not found or does not belong to this company" });
    }

    return res.json({ message: "Staff deleted successfully" });
  } catch (e) {
    console.error("adminDeleteCourierStaff error:", e);
    return res.status(500).json({ message: "Failed to delete staff" });
  }
};

// ===========================
// نظام النزاعات (Admin)
// ===========================

export const getDisputedAuctions = async (req, res) => {
  try {
    const disputes = await Auction.find({ isDisputed: true })
      .populate("owner", "name phone")
      .populate("winner", "name phone")
      .populate({
        path: "deliveryOrder",
        populate: { path: "company", select: "name" },
      })
      .sort({ updatedAt: -1 });

    return res.json(disputes);
  } catch (error) {
    console.error("getDisputedAuctions error:", error);
    return res.status(500).json({ message: "Failed to fetch disputes" });
  }
};

export const resolveDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body; // 'accept_courier' | 'accept_user'

    if (!["accept_courier", "accept_user"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision" });
    }

    const auction = await Auction.findById(id).populate("deliveryOrder");
    if (!auction || !auction.isDisputed) {
      return res.status(404).json({ message: "Dispute not found or already resolved" });
    }

    // ✅ FIX 1: حفظ سبب الفشل قبل مسحه (كان يُقرأ بعد المسح = null دائماً)
    const SELLER_FAULT_REASONS = ["SELLER_NO_SHOW", "SELLER_NOT_READY"];
    const faultReason = auction.deliveryPenaltyReason || auction.deliveryOrder?.failureReason || "";
    const isSellersBlame = SELLER_FAULT_REASONS.includes(faultReason);
    const blamedUserId = isSellersBlame ? auction.seller : auction.winner;
    const otherUserId = isSellersBlame ? auction.winner : auction.seller;

    const notifyUser = async (userId, title, message, event) => {
      if (!userId) return;
      await Notification.create({
        user: userId,
        type: "SYSTEM",
        event,
        title,
        message,
        auction: auction._id,
      });
      const io = getIo();
      if (io) io.to(userId.toString()).emit("new_notification", { title });
    };



    // ────────────────────────────────────────────────────
    // CASE A: رفض الاعتراض → تطبيق الغرامة فوراً عبر الكرون
    // ────────────────────────────────────────────────────
    if (decision === "accept_courier") {
      auction.isDisputed = false;
      auction.confirmationDeadline = new Date(Date.now() - 1); // يجعل الكرون يصطاده فوراً
      await auction.save();

      // ✅ FIX 4: إشعار الشخص المتهم
      await notifyUser(
        blamedUserId,
        "تم رفض اعتراضك ❌",
        "تمت مراجعة الشكوى وقررت الإدارة رفض الاعتراض. سيتم تطبيق الغرامة ومصادرة العربون.",
        "DISPUTE_REJECTED"
      );

      return res.json({ message: "تم رفض عذر المستخدم. سيتم تطبيق العقوبة قريباً عبر الكرون.", auction });
    }

    // ────────────────────────────────────────────────────
    // CASE B: قبول الاعتراض → تبرئة + إعادة الوديعة
    // ────────────────────────────────────────────────────
    if (decision === "accept_user") {
      // ✅ FIX 2: إعادة عربون الشخص البريء من heldBalance إلى balance
      const depositToReturn = isSellersBlame
        ? (auction.sellerDeposit || 0)
        : (auction.depositAmount || 0);

      if (blamedUserId && depositToReturn > 0) {
        await User.updateOne(
          { _id: blamedUserId, heldBalance: { $gte: depositToReturn } },
          { $inc: { heldBalance: -depositToReturn, balance: depositToReturn } }
        );

        const receiptId = generateReceiptId();
        await AuditLog.create({
          action: "REFUND",
          auction: auction._id,
          user: blamedUserId,
          amount: depositToReturn,
          receiptId,
          reason: "إعادة عربون بعد قبول الاعتراض على نتيجة التوصيل",
          by: "ADMIN",
          source: isSellersBlame ? "SELLER" : "BUYER",
        });

        // ✅ إرسال بريد إلكتروني بالوصل المالي في حال قبول الاعتراض بنجاح
        const user = await User.findById(blamedUserId).select("name email");
        if (user && user.email) {
          sendReceiptEmail({
            to: user.email,
            userName: user.name,
            receiptId,
            amount: depositToReturn,
            type: "DEPOSIT_REFUND",
            date: new Date(),
            details: `إعادة العربون بعد قبول الاعتراض على المزاد: ${auction.title}`
          });
        }
      }

      // ✅ FIX 3: تحديث حالة المزاد بشكل صحيح
      // إذا البائع هو المتهم البريء → المشتري كان فعلاً سبب الفشل → cancelled_by_winner
      // إذا المشتري هو المتهم البريء → البائع كان فعلاً سبب الفشل → cancelled_by_seller
      auction.status = isSellersBlame ? "cancelled_by_winner" : "cancelled_by_seller";
      auction.isDisputed = false;
      auction.deliveryPenaltyReason = null;
      auction.penaltyApplied = true; // تأكيد أن الموضوع تمت معالجته يدوياً
      auction.confirmationDeadline = null;
      await auction.save();

      // إعادة الطلب للمباشرة أو يعالجه الأدمن
      if (auction.deliveryOrder) {
        await auction.deliveryOrder.updateOne({
          status: "READY_FOR_PICKUP",
          failureReason: null,
        });
      }

      // ✅ FIX 4: إشعار الطرفين كليهما
      await notifyUser(
        blamedUserId,
        "تم قبول اعتراضك ✅",
        "أصدرت الإدارة قراراً بقبول اعتراضك وتبرئتك. تم إعادة عربونك المحجوز إلى رصيدك.",
        "DISPUTE_ACCEPTED"
      );
      await notifyUser(
        otherUserId,
        "قرار إدارة المنصة بشأن شكوى التوصيل",
        "أصدرت الإدارة قراراً بتبرئة الطرف الآخر من سبب فشل التوصيل وإعادة عربونه.",
        "DISPUTE_RESOLVED"
      );

      return res.json({
        message: "تمت تبرئة المستخدم وإعادة عربونه إلى رصيده بنجاح.",
        refunded: depositToReturn,
        auction,
      });
    }

  } catch (error) {
    console.error("resolveDispute error:", error);
    return res.status(500).json({ message: "Failed to resolve dispute" });
  }
};
