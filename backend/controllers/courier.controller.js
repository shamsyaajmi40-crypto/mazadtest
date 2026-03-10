import crypto from "crypto";
import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import DeliveryOrder from "../models/DeliveryOrder.js";
import CourierCompany from "../models/CourierCompany.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import FinanceLog from "../models/FinanceLog.js";
import { sendAppNotification } from "../utils/notification.js";
import bcrypt from "bcrypt";
import { getIo } from "../utils/socket.js";
import { generateReceiptId, signReceipt } from "../utils/receipt.js";
import { calculateCommission } from "../utils/commission.js";

const FAILURE_REVIEW_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_CONFIRMATION_MS = 4 * 24 * 60 * 60 * 1000; // 4 days
const normalizeOtp = (x) =>
  String(x || "")
    .trim()
    .replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)])
    .replace(/[۰-۹]/g, (d) => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)]);

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");
const genOtp = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 digits

const pushLog = (order, { status, by, note = "", reason = null }) => {
  order.logs.push({ status, by, note, reason, at: new Date() });
};

const BUYER_FAILURE_REASONS = new Set([
  "BUYER_NO_SHOW",
  "BUYER_REFUSED",
  "BUYER_DID_NOT_RECEIVE",
  "BUYER_UNREACHABLE",
  "WRONG_ADDRESS",
]);
const SELLER_FAILURE_REASONS = new Set(["SELLER_NO_SHOW", "SELLER_NOT_READY"]);
const COURIER_FAILURE_REASONS = new Set(["COURIER_ISSUE"]);
const ALL_FAILURE_REASONS = new Set([
  ...BUYER_FAILURE_REASONS,
  ...SELLER_FAILURE_REASONS,
  ...COURIER_FAILURE_REASONS,
]);

const notifyUser = async ({ userId, title, message, auctionId, event }) => {
  await sendAppNotification({
    userId,
    title,
    message,
    event,
    auctionId,
    type: "SYSTEM"
  });

  const io = getIo();
  if (io) {
    io.to(userId.toString()).emit("user_refresh"); // تحديث عداد الصفقات
  }
};

const courierAuctionPopulate = {
  path: "auction",
  select: "currentPrice confirmationDeadline status winner seller",
  populate: [
    { path: "winner", select: "name phone governorate address" },
    { path: "seller", select: "name phone governorate address" },
  ],
};

const ensureOrderAccess = async (reqUser, order) => {
  if (!reqUser || !order) return { ok: false, status: 404, message: "Order not found" };

  if (reqUser.role === "courier_staff") {
    const staff = await User.findById(reqUser._id).select("courierCompany");
    if (!staff?.courierCompany) return { ok: false, status: 400, message: "Staff has no courierCompany" };
    if (String(order.company) !== String(staff.courierCompany)) {
      return { ok: false, status: 403, message: "Order not in your company" };
    }
  }

  if (reqUser.role === "courier_agent") {
    if (!order.agentUser || String(order.agentUser) !== String(reqUser._id)) {
      return { ok: false, status: 403, message: "Order is not assigned to you" };
    }
  }

  return { ok: true };
};

export const listCourierCompanies = async (req, res) => {
  const companies = await CourierCompany.find({ isActive: true })
    .select("_id name phone deliveryFee coverage branches") // Include coverage and branches for admin visibility
    .sort({ createdAt: -1 });

  return res.json(companies);
};

// جلب شركات التوصيل المتاحة بناءً على المحافظة من وإلى
export const getAvailableCouriers = async (req, res) => {
  try {
    const { from, to } = req.query;

    // جلب كل الشركات الفعالة
    const companies = await CourierCompany.find({ isActive: true })
      .select("_id name phone deliveryFee coverage branches")
      .sort({ createdAt: -1 });

    // إذا لم يرسل فلتر، نرجعها كلها (أو نعيد خطأ حسب المطلوب، لكن الأفضل كلها للاحتياط)
    if (!from || !to) {
      return res.json(companies);
    }

    // فلترة الشركات بناءً على مصفوفة التغطية (coverage)
    const filteredCompanies = companies.filter(company => {
      // إذا كانت الشركة ليس لديها تغطية محددة، نعتبرها لا تدعم هذه الوجهة
      if (!company.coverage || company.coverage.length === 0) return false;

      // نبحث هل هناك قاعدة (route) يتطابق فيها "من" مع طلبنا
      // A route matches if its 'from' is the requested 'from', or if it's 'الكل' or 'All' or 'جميع المحافظات'
      const matchedRoute = company.coverage.find(
        route => {
          if (!Array.isArray(route.from)) return false; // Safety check
          return route.from.includes(from) || route.from.includes("الكل") || route.from.includes("All") || route.from.includes("جميع المحافظات");
        }
      );

      // إذا لم نجد المسار "من"، إذن لا تدعم
      if (!matchedRoute) return false;

      // إذا وجدنا "من"، نتحقق من مصفوفة "إلى" 
      // هل تحتوي المحافظة المطلوبة أو "الكل"
      // Check if that matched route's 'to' array includes the requested 'to', or if it includes 'الكل'/'All'/'جميع المحافظات'
      if (!Array.isArray(matchedRoute.to)) return false; // Safety check
      return matchedRoute.to.includes(to) || matchedRoute.to.includes("الكل") || matchedRoute.to.includes("All") || matchedRoute.to.includes("جميع المحافظات");
    });

    return res.json(filteredCompanies);
  } catch (error) {
    console.error("getAvailableCouriers error:", error);
    return res.status(500).json({ message: "Failed to load available couriers" });
  }
};

export const createDeliveryOrder = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const { companyId, trackingCode = "" } = req.body;

    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    // ✅ يسمح للبائع أو courier_staff/admin/superAdmin فقط
    const isSeller =
      String(auction.seller) === String(req.user._id) ||
      String(auction.seller?._id) === String(req.user._id);

    const isStaff =
      req.user.role === "courier_staff" ||
      req.user.role === "admin" ||
      req.user.role === "superAdmin";

    if (!isSeller && !isStaff) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // ✅ لازم المزاد منتهي وفيه فائز
    if (auction.status !== "ENDED" || !auction.winner) {
      return res.status(400).json({ message: "Auction not ready for delivery" });
    }

    const company = await CourierCompany.findById(companyId);
    if (!company || !company.isActive) {
      return res.status(400).json({ message: "Courier company invalid" });
    }

    const existing = await DeliveryOrder.findOne({ auction: auction._id });
    if (existing) return res.status(400).json({ message: "Delivery order already exists" });

    // ✅ توليد OTP للمشتري فقط عند إنشاء الطلب
    const buyerOtp = normalizeOtp(genOtp());

    const order = await DeliveryOrder.create({
      auction: auction._id,
      company: company._id,
      deliveryFee: Number(company.deliveryFee || 0),
      trackingCode,
      status: "READY_FOR_PICKUP",
      staffUser: req.user._id,
      logs: [
        {
          status: "READY_FOR_PICKUP",
          by: req.user._id,
          note: "Order created",
          at: new Date(),
        },
      ],
    });

    auction.deliveryMode = "courier";
    auction.deliveryOrder = order._id;
    // Reset confirmations for courier flow lifecycle.
    auction.winnerConfirmed = false;
    auction.sellerConfirmed = false;

    // ✅ buyer OTP only
    auction.deliveryOtpCode = buyerOtp;
    auction.deliveryOtpHash = hashOtp(buyerOtp);

    // ✅ payout OTP للبائع لاحقاً بعد DELIVERED
    auction.payoutOtpCode = null;
    auction.payoutOtpHash = null;

    await auction.save();

    return res.json({
      message: "Delivery order created",
      orderId: order._id,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const assignAgent = async (req, res) => {
  const { orderId } = req.params;
  const { agentUserId } = req.body;

  const staff = await User.findById(req.user._id).select("courierCompany");
  if (!staff?.courierCompany) return res.status(400).json({ message: "Staff has no courierCompany" });

  const order = await DeliveryOrder.findById(orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  // تأكد الطلب أصلاً لنفس الشركة
  if (String(order.company) !== String(staff.courierCompany)) {
    return res.status(403).json({ message: "Order not in your company" });
  }

  const agent = await User.findOne({
    _id: agentUserId,
    role: "courier_agent",
    courierCompany: staff.courierCompany,
    isCourierActive: true,
  });

  if (!agent) return res.status(404).json({ message: "Agent not found for your company" });

  order.agentUser = agent._id;
  order.staffUser = req.user._id;
  pushLog(order, { status: order.status, by: req.user._id, note: `Agent assigned: ${agent._id}` });
  await order.save();

  return res.json({ message: "Agent assigned" });
};


export const markPickedUp = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await DeliveryOrder.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const access = await ensureOrderAccess(req.user, order);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    order.status = "PICKED_UP";
    order.pickedUpAt = new Date();
    order.staffUser = req.user._id;
    pushLog(order, { status: "PICKED_UP", by: req.user._id });

    await order.save();
    return res.json({ message: "Picked up" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const markDeliveredByOtp = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    const order = await DeliveryOrder.findById(orderId).populate("auction");
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }

    const access = await ensureOrderAccess(req.user, order);
    if (!access.ok) {
      await session.abortTransaction();
      session.endSession();
      return res.status(access.status).json({ message: access.message });
    }

    const auction = await Auction.findById(order.auction._id);
    if (!auction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.deliveryMode !== "courier") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Not courier mode" });
    }

    if (order.status !== "PICKED_UP") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Order must be in PICKED_UP status to be delivered" });
    }

    if (!auction.deliveryOtpHash) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Delivery OTP not set" });
    }

    const ok = hashOtp(normalizeOtp(otp)) === auction.deliveryOtpHash;
    if (!ok) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Update order atomically
    order.status = "DELIVERED";
    order.deliveredAt = new Date();
    order.staffUser = req.user._id;
    pushLog(order, { status: "DELIVERED", by: req.user._id, note: "Delivered by OTP" });
    await order.save({ session });

    // Update auction atomically
    auction.winnerConfirmed = true;
    auction.deliveryOtpCode = null;
    auction.deliveryOtpHash = null;

    // توليد OTP البائع لاستلام مبلغ COD
    if (!auction.payoutOtpHash) {
      const sellerOtp = genOtp();
      auction.payoutOtpCode = sellerOtp;
      auction.payoutOtpHash = hashOtp(sellerOtp);
    }

    await auction.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Async notification (don't block response)
    if (auction.payoutOtpCode) {
      notifyUser({
        userId: auction.seller,
        auctionId: auction._id,
        event: "PAYOUT_OTP_READY",
        title: "كود استلام مبلغ COD جاهز",
        message: "تم تأكيد التسليم. الآن يظهر لك OTP استلام مبلغ الـCOD داخل تفاصيل المزاد.",
      }).catch(e => console.error("Notification error:", e));
    }

    return res.json({ message: "Delivered confirmed" });
  } catch (e) {
    if (session.inAtomicity) await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: e.message });
  }
};


export const markFailed = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, note = "" } = req.body;

    const order = await DeliveryOrder.findById(orderId).populate("auction");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const access = await ensureOrderAccess(req.user, order);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    if (!ALL_FAILURE_REASONS.has(reason)) {
      return res.status(400).json({ message: "Invalid failure reason" });
    }

    if (["COD_PAID_TO_SELLER", "COMPLETED"].includes(order.status)) {
      return res.status(400).json({ message: "Order already finalized" });
    }

    const auction = await Auction.findById(order.auction._id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    if (order.status === "DELIVERY_FAILED" && order.failureReason) {
      if (auction.penaltyApplied) {
        return res.status(400).json({ message: "Cannot change failure reason after penalty is applied" });
      }
      const reviewUntil = auction.confirmationDeadline ? new Date(auction.confirmationDeadline).getTime() : 0;
      if (!reviewUntil || Date.now() >= reviewUntil) {
        return res.status(400).json({ message: "Review window expired; penalty will be applied" });
      }
    }

    order.status = "DELIVERY_FAILED";
    order.failureReason = reason;
    order.staffUser = req.user._id;
    pushLog(order, { status: "DELIVERY_FAILED", by: req.user._id, reason, note });
    await order.save();

    // خزّن السبب على المزاد حتى يقرأه كرون العقوبات
    auction.deliveryPenaltyReason = reason;
    // Persist explicit confirmation flags for penalty/audit visibility.
    if (SELLER_FAILURE_REASONS.has(reason)) {
      // Buyer is not at fault in seller-related failures.
      auction.winnerConfirmed = true;
      auction.sellerConfirmed = false;
    }
    if (BUYER_FAILURE_REASONS.has(reason)) {
      // Seller is not at fault in buyer-related failures.
      auction.sellerConfirmed = true;
      auction.winnerConfirmed = false;
    }
    if (reason === "COURIER_ISSUE") {
      // Neutral courier fault: keep both parties non-confirmed.
      auction.sellerConfirmed = false;
      auction.winnerConfirmed = false;
    }
    auction.penaltyApplied = false;
    auction.confirmationDeadline = new Date(Date.now() + FAILURE_REVIEW_MS);

    // نظام الاعتراض (إشعار الطرف المتهم)
    auction.isDisputed = false;
    auction.disputeReason = null;
    await auction.save();

    if (SELLER_FAILURE_REASONS.has(reason)) {
      // تنبيه المتهم (البائع)
      await notifyUser({
        userId: auction.seller,
        title: "⚠️ تنبيه عاجل: فشل التوصيل",
        message: "تم تسجيل فشل التوصيل بسببك. سيتم مصادرة عربونك خلال 24 ساعة. إذا كان هذا غير صحيح، قم بتقديم اعتراض فوراً من صفحة المزاد.",
        auctionId: auction._id,
        event: "DELIVERY_FAILED_ACCUSED",
      });
      // تنبيه الطرف الآخر (المشتري)
      if (auction.winner) {
        await notifyUser({
          userId: auction.winner,
          title: "تحديث: فشل توصيل المزاد",
          message: "تعذر التوصيل بسبب إشكال من طرف البائع. عربونك في أمان حالياً ونحن بانتظار مراجعة الإدارة أو اعتراض البائع.",
          auctionId: auction._id,
          event: "DELIVERY_FAILED_INFO",
        });
      }
    } else if (BUYER_FAILURE_REASONS.has(reason) && auction.winner) {
      // تنبيه المتهم (المشتري)
      await notifyUser({
        userId: auction.winner,
        title: "⚠️ تنبيه عاجل: رفض الاستلام",
        message: "تم تسجيل رفضك لاستلام المزاد. سيتم مصادرة عربونك خلال 24 ساعة. إذا كان هذا غير صحيح، قم بتقديم اعتراض فوراً من صفحة المزاد.",
        auctionId: auction._id,
        event: "DELIVERY_FAILED_ACCUSED",
      });
      // تنبيه الطرف الآخر (البائع)
      await notifyUser({
        userId: auction.seller,
        title: "تحديث: فشل توصيل المزاد",
        message: "تعذر التوصيل بسبب إشكال من طرف المشتري. عربونك في أمان حالياً ونحن بانتظار مراجعة الإدارة أو اعتراض المشتري.",
        auctionId: auction._id,
        event: "DELIVERY_FAILED_INFO",
      });
    } else if (reason === "COURIER_ISSUE") {
      // تنبيه الطرفين بمشكلة الشركة
      const courierMsg = "فشل التوصيل بسبب مشكلة لوجستية من شركة التوصيل. لا توجد عقوبات بحق أي طرف، المزاد قيد المراجعة حالياً.";
      await notifyUser({
        userId: auction.seller,
        title: "تحديث المزاد: مشكلة توصيل",
        message: courierMsg,
        auctionId: auction._id,
        event: "DELIVERY_FAILED_INFO",
      });
      if (auction.winner) {
        await notifyUser({
          userId: auction.winner,
          title: "تحديث المزاد: مشكلة توصيل",
          message: courierMsg,
          auctionId: auction._id,
          event: "DELIVERY_FAILED_INFO",
        });
      }
    }

    return res.json({
      message: "Marked as failed (review window started)",
      reviewUntil: auction.confirmationDeadline,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const revertFailedDecision = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { note = "" } = req.body || {};

    const order = await DeliveryOrder.findById(orderId).populate("auction");
    if (!order) return res.status(404).json({ message: "Order not found" });

    const access = await ensureOrderAccess(req.user, order);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    if (order.status !== "DELIVERY_FAILED") {
      return res.status(400).json({ message: "Order is not in failed state" });
    }

    const auction = await Auction.findById(order.auction._id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    if (auction.penaltyApplied) {
      return res.status(400).json({ message: "Cannot revert after penalty is applied" });
    }

    const reviewUntil = auction.confirmationDeadline ? new Date(auction.confirmationDeadline).getTime() : 0;
    if (!reviewUntil || Date.now() >= reviewUntil) {
      return res.status(400).json({ message: "Review window expired; cannot revert failure" });
    }

    let fallbackStatus = "PICKED_UP";
    for (let i = order.logs.length - 1; i >= 0; i--) {
      const s = String(order.logs[i]?.status || "");
      if (s && s !== "DELIVERY_FAILED") {
        fallbackStatus = s;
        break;
      }
    }

    order.status = fallbackStatus;
    order.failureReason = null;
    order.staffUser = req.user._id;
    pushLog(order, {
      status: fallbackStatus,
      by: req.user._id,
      note: note || "Failure decision reverted during review window",
    });
    await order.save();

    auction.deliveryPenaltyReason = null;
    auction.winnerConfirmed = false;
    auction.sellerConfirmed = false;
    auction.penaltyApplied = false;
    auction.confirmationDeadline = new Date(Date.now() + DEFAULT_CONFIRMATION_MS);
    await auction.save();

    return res.json({
      message: "Failure decision reverted",
      orderStatus: order.status,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const markCodPaidToSeller = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId } = req.params;
    const { otp, receiptNo = "" } = req.body;

    const order = await DeliveryOrder.findById(orderId).populate("auction");
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }

    const access = await ensureOrderAccess(req.user, order);
    if (!access.ok) {
      await session.abortTransaction();
      session.endSession();
      return res.status(access.status).json({ message: access.message });
    }

    if (order.status !== "DELIVERED") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Order must be in DELIVERED status to settle COD" });
    }

    const auction = await Auction.findById(order.auction._id);
    if (!auction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Auction not found" });
    }

    if (!auction.payoutOtpHash) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Payout OTP not set yet" });
    }

    const ok = hashOtp(normalizeOtp(otp)) === auction.payoutOtpHash;
    if (!ok) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const grossAmount = Number(auction.currentPrice || 0);
    const deliveryFee = Number(order.deliveryFee || 0);
    const commission = calculateCommission(grossAmount);
    const sellerPayout = Math.max(0, grossAmount - commission);  // صافي مستحق البائع بعد العمولة
    const buyerTotalDue = grossAmount + deliveryFee;

    // 1. Update Order status
    order.status = "COD_PAID_TO_SELLER";
    order.codPaidAt = new Date();
    order.staffUser = req.user._id;
    pushLog(order, {
      status: "COD_PAID_TO_SELLER",
      by: req.user._id,
      note: `receiptNo=${receiptNo};grossAmount=${grossAmount};commission=${commission};sellerPayout=${sellerPayout};deliveryFee=${deliveryFee};buyerTotalDue=${buyerTotalDue}`,
    });
    await order.save({ session });

    // 2. Update Auction status
    auction.sellerConfirmed = true;
    auction.payoutOtpCode = null;
    auction.payoutOtpHash = null;
    auction.status = "completed";
    auction.penaltyApplied = true;
    await auction.save({ session });

    // 3. User Wallet Updates (Refunds)

    // 🔄 إعادة عربون المشتري
    if (auction.winner && auction.depositAmount > 0) {
      const buyerUpdate = await User.findOneAndUpdate(
        { _id: auction.winner, heldBalance: { $gte: Number(auction.depositAmount || 0) } },
        {
          $inc: {
            balance: auction.depositAmount,
            heldBalance: -auction.depositAmount,
          },
        },
        { session, new: true }
      );

      if (buyerUpdate) {
        const receiptId = generateReceiptId();
        const signData = { action: "REFUND", auction: String(auction._id), user: String(auction.winner), amount: auction.depositAmount, receiptId };
        const signature = signReceipt(signData);

        await AuditLog.create(
          [
            {
              action: "REFUND",
              auction: auction._id,
              user: auction.winner,
              amount: auction.depositAmount,
              receiptId,
              reason: "إرجاع عربون المشتري بعد إتمام التوصيل والدفع",
              by: "SYSTEM",
              source: "BUYER",
              meta: { signature },
            },
          ],
          { session }
        );
      }
    }

    // 🔄 إعادة عربون البائع كاملاً + تسجيل عمولة المنصة من مبلغ الدفع
    if (auction.seller) {
      const sellerDeposit = Number(auction.sellerDeposit || 0);

      // إعادة العربون كاملاً
      if (sellerDeposit > 0) {
        const sellerDepositUpdate = await User.findOneAndUpdate(
          { _id: auction.seller, heldBalance: { $gte: sellerDeposit } },
          { $inc: { heldBalance: -sellerDeposit, balance: sellerDeposit } },
          { session, new: true }
        );

        if (sellerDepositUpdate) {
          const depositReceiptId = generateReceiptId();
          const signData = { action: "REFUND", auction: String(auction._id), user: String(auction.seller), amount: sellerDeposit, receiptId: depositReceiptId };
          const signature = signReceipt(signData);

          await AuditLog.create(
            [{
              action: "REFUND",
              auction: auction._id,
              user: auction.seller,
              amount: sellerDeposit,
              receiptId: depositReceiptId,
              reason: "إرجاع عربون البائع كاملاً — العمولة مُستقطعة من مبلغ الدفع",
              by: "SYSTEM",
              source: "SELLER",
              meta: { signature },
            }],
            { session }
          );
        }
      }

      // تسجيل العمولة من مبلغ الدفع (لا يُغيّر محفظة البائع)
      const commissionReceiptId = generateReceiptId();
      await AuditLog.create(
        [{
          action: "PLATFORM_COMMISSION",
          auction: auction._id,
          user: auction.seller,
          amount: commission,
          receiptId: commissionReceiptId,
          reason: `عمولة المنصة (${commission.toLocaleString()} د.ع) مُستقطعة من مبلغ الدفع (${grossAmount.toLocaleString()} د.ع). صافي البائع: ${sellerPayout.toLocaleString()} د.ع`,
          by: "SYSTEM",
          source: "SELLER",
        }],
        { session }
      );

      await FinanceLog.create(
        [{
          user: auction.seller,
          type: "PLATFORM_COMMISSION",
          amountIQD: commission,
          refModel: "Auction",
          refId: auction._id,
          receiptId: commissionReceiptId,
          meta: {
            note: `عمولة مزاد — مستقطعة من مبلغ الدفع`,
            grossAmount,
            commission,
            sellerPayout,
            deliveryFee,
          }
        }],
        { session }
      );

      // إضافة العمولة لمحفظة المنصة
      const PLATFORM_USER_ID = process.env.PLATFORM_USER_ID;
      if (PLATFORM_USER_ID) {
        await User.updateOne(
          { _id: PLATFORM_USER_ID },
          { $inc: { balance: commission } },
          { session }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Async notifications
    if (auction.winner) {
      notifyUser({
        userId: auction.winner,
        auctionId: auction._id,
        event: "DEPOSIT_REFUND",
        title: "💰 تم إرجاع عربونك",
        message: `تم إضافة عربونك بقيمة ${Number(auction.depositAmount).toLocaleString()} د.ع إلى رصيدك بعد إتمام الصفقة بنجاح.`,
      }).catch(e => console.error("Notification error:", e));

      notifyUser({
        userId: auction.winner,
        auctionId: auction._id,
        event: "DEAL_COMPLETED",
        title: "✅ تمت الصفقة بنجاح",
        message: "تم تسليم السلعة ودفع المبلغ للبائع. شكراً لاستخدامك المنصة.",
      }).catch(e => console.error("Notification error:", e));
    }

    if (auction.seller) {
      notifyUser({
        userId: auction.seller,
        auctionId: auction._id,
        event: "COD_PAYOUT_CONFIRMED",
        title: "✅ تمت الصفقة بنجاح",
        message: [
          `تفاصيل تسوية مزادك:`,
          `• سعر الرسو: ${grossAmount.toLocaleString()} د.ع`,
          `• عمولة المنصة: ${commission.toLocaleString()} د.ع`,
          `• أجرة التوصيل: ${deliveryFee.toLocaleString()} د.ع (تدفع من المشتري)`,
          `✔️ صافي مستحقك: ${sellerPayout.toLocaleString()} د.ع`,
          `✔️ تم إعادة عربونك كاملاً إلى محفظتك`,
        ].join("\n"),
      }).catch(e => console.error("Notification error:", e));
    }

    return res.json({
      message: "COD payout confirmed",
      breakdown: {
        sellerPayout,
        deliveryFee,
        buyerTotalDue,
      },
    });
  } catch (e) {
    if (session.inAtomicity) await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: e.message });
  }
};


export const listCompanyOrders = async (req, res) => {
  const { companyId } = req.params;

  // ✅ staff لازم يشوف شركته فقط
  if (req.user.role === "courier_staff") {
    const staff = await User.findById(req.user._id).select("courierCompany");
    if (!staff?.courierCompany) return res.status(400).json({ message: "Staff has no courierCompany" });

    if (String(staff.courierCompany) !== String(companyId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const orders = await DeliveryOrder.find({ company: companyId })
    .populate(courierAuctionPopulate)
    .populate("agentUser", "name phone")
    .sort({ createdAt: -1 });
  return res.json(orders);
};


export const listAgentOrders = async (req, res) => {
  const orders = await DeliveryOrder.find({ agentUser: req.user._id })
    .populate(courierAuctionPopulate)
    .populate("agentUser", "name phone")
    .sort({ createdAt: -1 });
  return res.json(orders);
};
export const listMyAgents = async (req, res) => {
  const staff = await User.findById(req.user._id).select("courierCompany");
  if (!staff?.courierCompany) return res.status(400).json({ message: "Staff has no courierCompany" });

  const agents = await User.find({
    role: "courier_agent",
    courierCompany: staff.courierCompany,
  }).select("_id name phone isCourierActive createdAt");

  return res.json(agents);
};
export const createAgentForMyCompany = async (req, res) => {
  const { name, phone, email, password, governorate, address } = req.body;

  if (!name || !phone || !email || !password) {
    return res.status(400).json({ message: "الاسم، الهاتف، الإيميل وكلمة المرور مطلوبة" });
  }

  const staff = await User.findById(req.user._id).select("courierCompany");
  if (!staff?.courierCompany) return res.status(400).json({ message: "Staff has no courierCompany" });

  const exists = await User.findOne({
    $or: [{ phone }, { email: email.toLowerCase().trim() }]
  });
  if (exists) return res.status(400).json({ message: "الهاتف أو البريد الإلكتروني مسجل مسبقاً" });

  const hashed = await bcrypt.hash(String(password), 10);

  const agent = await User.create({
    name,
    phone,
    email: email.toLowerCase().trim(),
    password: hashed,
    governorate,
    address,
    role: "courier_agent",
    courierCompany: staff.courierCompany,
    isCourierActive: true,
    accountType: "user",
  });
  return res.json({
    _id: agent._id,
    name: agent.name,
    phone: agent.phone,
    isCourierActive: agent.isCourierActive,
  });
};
export const toggleAgentActive = async (req, res) => {
  const { agentId } = req.params;

  const staff = await User.findById(req.user._id).select("courierCompany");
  if (!staff?.courierCompany) return res.status(400).json({ message: "Staff has no courierCompany" });

  const agent = await User.findOne({
    _id: agentId,
    role: "courier_agent",
    courierCompany: staff.courierCompany,
  });

  if (!agent) return res.status(404).json({ message: "Agent not found" });

  agent.isCourierActive = !agent.isCourierActive;
  await agent.save();

  return res.json({ message: "updated", isCourierActive: agent.isCourierActive });
};
export const listMyCompanyOrders = async (req, res) => {
  const staff = await User.findById(req.user._id).select("courierCompany");
  if (!staff?.courierCompany) return res.status(400).json({ message: "Staff has no courierCompany" });

  const orders = await DeliveryOrder.find({ company: staff.courierCompany })
    .populate(courierAuctionPopulate)
    .populate("agentUser", "name phone")
    .sort({ createdAt: -1 });
  return res.json(orders);
};
export const adminCreateCourierStaffForCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ message: "name, phone, password required" });
    }

    const company = await CourierCompany.findById(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const exists = await User.findOne({ phone });
    if (exists) return res.status(400).json({ message: "Phone already used" });

    // ✅ أهم نقطة: خزن الباسورد بنفس طريقة اللوجين عندك
    const hashed = await bcrypt.hash(String(password), 10);

    const staff = await User.create({
      name,
      phone,
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
