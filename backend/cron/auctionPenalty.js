import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import Rating from "../models/Rating.js";
import AuditLog from "../models/AuditLog.js";
import DeliveryOrder from "../models/DeliveryOrder.js";
import { getIo } from "../utils/socket.js";
import { sendAppNotification } from "../utils/notification.js";
import { generateReceiptId, signReceipt } from "../utils/receipt.js";
import { sendReceiptEmail } from "../utils/email.js";
import { createLedgerEntry, generateOperationId } from "../utils/ledger.js";
/**
 * حركة مالية آمنة:
 * - REFUND: يرجع heldBalance إلى balance (ذرّي)
 * - CONFISCATE: ينقص heldBalance (ذرّي) + يحوّلها لحساب منصة (اختياري)
 *
 * ضع PLATFORM_USER_ID في env إذا تريد تروح الغرامات لحساب منصة واضح.
 */


function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
const BUYER_REASONS = new Set([
  "BUYER_NO_SHOW",
  "BUYER_REFUSED",
  "BUYER_DID_NOT_RECEIVE",
  "BUYER_UNREACHABLE",
  "WRONG_ADDRESS",
]);

const SELLER_REASONS = new Set([
  "SELLER_NO_SHOW",
  "SELLER_NOT_READY",
]);

const COURIER_REASONS = new Set([
  "COURIER_ISSUE",
]);

async function transferHeldToBalance({ userId, amount, reason, auctionId, source }) {
  const amt = toNumber(amount);
  if (!userId || amt <= 0) return;

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, heldBalance: { $gte: amt } },
    { $inc: { heldBalance: -amt, balance: amt } },
    { new: true }
  );

  if (updatedUser) {
    const receiptId = generateReceiptId();
    const signData = { action: "REFUND", auction: String(auctionId), user: String(userId), amount: amt, receiptId };
    const signature = signReceipt(signData);

    await AuditLog.create({
      action: "REFUND",
      auction: auctionId,
      user: userId,
      amount: amt,
      reason: reason || "refunded",
      by: "SYSTEM",
      source: source || "OTHER",
      receiptId,
      meta: { signature }
    });

    const afterBalance = Number(updatedUser.balance || 0);
    const afterHeld = Number(updatedUser.heldBalance || 0);
    await createLedgerEntry({
      operationId: generateOperationId("penalty_refund"),
      userId,
      type: "DEPOSIT_REFUND",
      amountIQD: amt,
      balanceBefore: afterBalance - amt,
      balanceAfter: afterBalance,
      heldBefore: afterHeld + amt,
      heldAfter: afterHeld,
      referenceModel: "Auction",
      referenceId: auctionId,
      receiptId,
      metadata: {
        reason: reason || "refunded",
        source: source || "OTHER",
        signature,
      },
    });

    const user = await User.findById(userId).select("name email");
    if (user && user.email) {
      sendReceiptEmail({
        to: user.email,
        userName: user.name,
        receiptId,
        amount: amt,
        type: "DEPOSIT_REFUND",
        date: new Date(),
        details: reason || "تم إرجاع العربون المحجوز"
      }).catch(e => console.error("Email error:", e));
    }
  }
}

async function confiscateHeld({ userId, amount, reason, auctionId, source }) {
  const amt = Math.floor(toNumber(amount));
  const PLATFORM_USER_ID = process.env.PLATFORM_USER_ID || null;
  if (!userId || amt <= 0) return { ok: false, amount: 0, rate: 0 };
  if (!PLATFORM_USER_ID || !mongoose.Types.ObjectId.isValid(PLATFORM_USER_ID)) {
    throw new Error("Missing PLATFORM_USER_ID configuration for confiscation settlement");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let confiscatedAmount = 0;
  let confiscationRate = 0;
  let receiptId = null;

  let userBalanceBefore = 0;
  let userBalanceAfter = 0;
  let userHeldBefore = 0;
  let userHeldAfter = 0;

  let platformBalanceBefore = 0;
  let platformBalanceAfter = 0;
  let platformHeldBefore = 0;
  let platformHeldAfter = 0;

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const previousConfiscations = await AuditLog.countDocuments({
      user: userId,
      by: "SYSTEM",
      action: "CONFISCATE_OK",
      createdAt: { $gte: since },
    }).session(session);

    confiscationRate = previousConfiscations >= 1 ? 1 : 0.5;
    confiscatedAmount = Math.max(1, Math.ceil(amt * confiscationRate));
    const remainingAmount = amt - confiscatedAmount;

    const userUpdate = await User.findOneAndUpdate(
      { _id: userId, heldBalance: { $gte: amt } },
      { $inc: { heldBalance: -amt, balance: remainingAmount } },
      { session, new: true }
    );

    if (!userUpdate) {
      // Fallback: If heldBalance is slightly different than expected (e.g. 4999 instead of 5000)
      // We still want to take the penalty and try to refund the rest.
      const altUpdate = await User.findOneAndUpdate(
        { _id: userId, heldBalance: { $gte: confiscatedAmount } },
        { session, new: true }
      );

      if (!altUpdate) {
        await AuditLog.create([{
          action: "CONFISCATE_FAILED",
          auction: auctionId,
          user: userId,
          amount: confiscatedAmount,
          reason: reason || "confiscate_failed_insufficient_held",
          by: "SYSTEM",
          source: source || "OTHER",
        }], { session });
        await session.commitTransaction();
        return { ok: false, amount: 0, rate: confiscationRate };
      }

      // Now we know exactly how much they have held.
      const actualHeld = Number(altUpdate.heldBalance);
      const toTakeFromHeld = Math.min(actualHeld, amt); // Take up to the expected amount
      const reallyConfiscated = Math.min(toTakeFromHeld, confiscatedAmount);
      const reallyRefunded = toTakeFromHeld - reallyConfiscated;

      // Update the user again to actually move the funds (we already have the session)
      const finalUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { heldBalance: -toTakeFromHeld, balance: reallyRefunded } },
        { session, new: true }
      );

      if (!finalUser) throw new Error("Failed to update user in confiscation fallback");

      userBalanceAfter = Number(finalUser.balance || 0);
      userHeldAfter = Number(finalUser.heldBalance || 0);
      userBalanceBefore = userBalanceAfter - reallyRefunded;
      userHeldBefore = userHeldAfter + toTakeFromHeld;
      confiscatedAmount = reallyConfiscated; // Update the variable for subsequent logging
    } else {
      userBalanceAfter = Number(userUpdate.balance || 0);
      userHeldAfter = Number(userUpdate.heldBalance || 0);
      userBalanceBefore = userBalanceAfter - remainingAmount;
      userHeldBefore = userHeldAfter + amt;
    }

    const platformWallet = await User.findById(PLATFORM_USER_ID).select("balance heldBalance").session(session);
    if (!platformWallet) {
      throw new Error("Configured PLATFORM_USER_ID user not found");
    }
    platformBalanceBefore = Number(platformWallet.balance || 0);
    platformHeldBefore = Number(platformWallet.heldBalance || 0);

    const platformUpdate = await User.updateOne(
      { _id: PLATFORM_USER_ID, balance: platformBalanceBefore, heldBalance: platformHeldBefore },
      { $inc: { balance: confiscatedAmount } },
      { session }
    );
    if (platformUpdate.modifiedCount === 0) {
      throw new Error("Platform wallet update conflict during confiscation");
    }
    platformBalanceAfter = platformBalanceBefore + confiscatedAmount;
    platformHeldAfter = platformHeldBefore;

    receiptId = generateReceiptId();
    const signData = { action: "CONFISCATE_OK", auction: String(auctionId), user: String(userId), amount: confiscatedAmount, receiptId };
    const signature = signReceipt(signData);

    await AuditLog.create([{
      action: "CONFISCATE_OK",
      auction: auctionId,
      user: userId,
      amount: confiscatedAmount,
      receiptId,
      reason: reason || "confiscated",
      by: "SYSTEM",
      source: source || "OTHER",
      meta: {
        platformUserId: PLATFORM_USER_ID || null,
        requestedAmount: amt,
        confiscationRate,
        previousConfiscations30d: previousConfiscations,
        signature,
      },
    }], { session });

    await createLedgerEntry({
      session,
      operationId: generateOperationId("deposit_confiscate"),
      userId,
      type: "DEPOSIT_CONFISCATE",
      amountIQD: confiscatedAmount,
      balanceBefore: userBalanceBefore,
      balanceAfter: userBalanceAfter,
      heldBefore: userHeldBefore,
      heldAfter: userHeldAfter,
      referenceModel: "Auction",
      referenceId: auctionId,
      receiptId,
      metadata: {
        platformUserId: PLATFORM_USER_ID || null,
        requestedAmount: amt,
        confiscationRate,
        previousConfiscations30d: previousConfiscations,
        reason: reason || "confiscated",
        source: source || "OTHER",
        signature,
      },
    });

    await createLedgerEntry({
      session,
      operationId: generateOperationId("confiscation_platform_transfer"),
      userId: PLATFORM_USER_ID,
      type: "PLATFORM_TRANSFER",
      amountIQD: confiscatedAmount,
      balanceBefore: platformBalanceBefore,
      balanceAfter: platformBalanceAfter,
      heldBefore: platformHeldBefore,
      heldAfter: platformHeldAfter,
      referenceModel: "Auction",
      referenceId: auctionId,
      receiptId,
      metadata: {
        sourceType: "DEPOSIT_CONFISCATE",
        fromUserId: String(userId),
        reason: reason || "confiscated",
        source: source || "OTHER",
      },
    });

    await session.commitTransaction();
    return { ok: true, amount: confiscatedAmount, rate: confiscationRate, receiptId };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error("Confiscate transaction error:", error);
    return { ok: false, amount: 0, rate: 0 };
  } finally {
    session.endSession();
  }
}

async function notifyUser({ userId, title, message, auctionId, event }) {
  await sendAppNotification({
    userId,
    title,
    message,
    event,
    type: "SYSTEM",
    auctionId,
  });

  const io = getIo();
  if (io) {
    io.to(userId.toString()).emit("user_refresh"); // تحديث عداد الصفقات
  }
}

/* ================================
   🔒 تصعيد الحظر عند تكرار المخالفات
================================ */
const checkAndBanUserIfNeeded = async (userId) => {
  if (!userId) return;

  // لاحظ: أنت تحسب المخالفات على action: "CONFISCATE"
  // لكن الآن المصادرة الحقيقية تُسجل بـ CONFISCATE_OK + قديمة بـ CONFISCATE
  // نخلي العد يشمل الاثنين حتى ما يضيع التصعيد.
  const violationsCount = await AuditLog.countDocuments({
    user: userId,
    by: "SYSTEM",
    action: "CONFISCATE_OK",
  });

  if (violationsCount >= 3) {
    await User.findByIdAndUpdate(userId, { blocked: true });
  }
};

/* ================================
   🧾 Audit Log
================================ */
const createAuditLog = async ({ action, auctionId, userId, amount, reason, source }) => {
  await AuditLog.create({
    action,
    auction: auctionId,
    user: userId,
    amount,
    reason,
    by: "SYSTEM",
    source: source || "OTHER",
  });
};

/* ================================
   ⭐ تقييم سلبي تلقائي (مرة واحدة)
================================ */
const createAutoNegativeRating = async ({ auctionId, toUser }) => {
  if (!toUser) return;

  const exists = await Rating.exists({ auction: auctionId, toUser: toUser, auto: true });


  if (exists) return;

  await Rating.create({
    auction: auctionId,
    toUser: toUser,
    score: 1,
    auto: true,
    reasons: [],
  });
};

/* ================================
   ⏱️ Cron العقوبة بعد 48 ساعة
================================ */
const applyAuctionPenalty = async () => {
  const now = new Date();

  const auctions = await Auction.find({
    status: "ENDED",
    confirmationDeadline: { $lte: now },
    penaltyApplied: false,
    isDisputed: false, // لا تعاقب المزادات التي فيها نزاع قيد المراجعة
  });

  if (!auctions.length) return;

  for (const auction of auctions) {
    /* 🔒 LOCK (ذري – يمنع التكرار) */
    const lock = await Auction.updateOne(
      { _id: auction._id, penaltyApplied: false },
      { $set: { penaltyApplied: true } }
    );

    if (lock.modifiedCount === 0) continue;

    // ✅ Sync memory state to prevent auction.save() from reverting the lock
    auction.penaltyApplied = true;

    const winnerId = auction.winner;
    const sellerId = auction.seller;

    const winnerUser = winnerId ? await User.findById(winnerId) : null;
    const sellerUser = sellerId ? await User.findById(sellerId) : null;

    // helper: مشكلة شركة => لا عقوبات + نعيد جدولة فحص 24 ساعة
    const rescheduleCourierIssue = async (msgBuyer, msgSeller, newReason = "COURIER_ISSUE") => {
      // Any grace-period reschedule is treated as a courier-side issue.
      auction.deliveryPenaltyReason = newReason;

      // رجّع penaltyApplied حتى يعيد الكرون الفحص بعد تمديد المهلة
      auction.penaltyApplied = false;
      auction.confirmationDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +48 ساعة

      if (winnerUser) {
        await notifyUser({
          userId: winnerUser._id,
          auctionId: auction._id,
          event: "DELIVERY_ISSUE",
          title: "تعذر/تأخر التوصيل",
          message: msgBuyer || "صار تأخير/مشكلة من شركة التوصيل. سيتم إعادة المتابعة تلقائياً أو يمكنك تغيير الشركة.",
        });
      }

      if (sellerUser) {
        await notifyUser({
          userId: sellerUser._id,
          auctionId: auction._id,
          event: "DELIVERY_ISSUE",
          title: "تعذر/تأخر التوصيل",
          message: msgSeller || "صار تأخير/مشكلة من شركة التوصيل. سيتم إعادة المتابعة تلقائياً أو يمكنك تغيير الشركة.",
        });
      }

      await auction.save();
    };

    const penalizeSellerFailure = async (reason = "SELLER_NOT_READY") => {
      auction.status = "cancelled_by_seller";

      if (winnerUser) {
        await transferHeldToBalance({
          userId: winnerUser._id,
          amount: auction.depositAmount,
          reason: "إعادة عربون المشتري بعد فشل التوصيل بسبب البائع",
          auctionId: auction._id,
          source: "BUYER",
        });

        await notifyUser({
          userId: winnerUser._id,
          auctionId: auction._id,
          event: "DEPOSIT_REFUND",
          title: "تم إرجاع العربون",
          message: `تم إرجاع عربونك بقيمة ${toNumber(auction.depositAmount).toLocaleString()} د.ع بسبب فشل التوصيل (خطأ من البائع).`,
        });
      }

      if (sellerUser) {
        const confiscation = await confiscateHeld({
          userId: sellerUser._id,
          amount: auction.sellerDeposit,
          reason: `مصادرة عربون البائع بسبب فشل التوصيل (${reason})`,
          auctionId: auction._id,
          source: "SELLER",
        });

        await createAutoNegativeRating({ auctionId: auction._id, toUser: sellerUser._id });
        await checkAndBanUserIfNeeded(sellerUser._id);

        await notifyUser({
          userId: sellerUser._id,
          auctionId: auction._id,
          event: "PENALTY_CONFISCATE",
          title: "تمت مصادرة العربون",
          message: `تمت مصادرة عربونك بقيمة ${toNumber(confiscation.amount).toLocaleString()} د.ع بسبب فشل التوصيل (${reason}).`,
        });
      }

      await auction.save();
    };


    // ================================
    // 🚚 Courier Mode (COD + OTP)
    // ================================
    if (auction.deliveryMode === "courier") {
      const order = auction.deliveryOrder
        ? await DeliveryOrder.findById(auction.deliveryOrder)
        : await DeliveryOrder.findOne({ auction: auction._id });

      // 1) لا يوجد طلب توصيل:
      // يمنح تمديد فقط إذا كان السبب اللوجستي موثق، وإلا تقصير بائع.
      if (!order) {
        if (COURIER_REASONS.has(auction.deliveryPenaltyReason) && auction.deliveryPenaltyReason !== "COURIER_ISSUE_EXTENDED") {
          await rescheduleCourierIssue(
            "لم يتم العثور على طلب توصيل مرتبط بالمزاد. سيتم إعادة المحاولة تلقائياً أو تواصل مع شركة التوصيل.",
            "لم يتم العثور على طلب توصيل مرتبط بالمزاد. سيتم إعادة المحاولة تلقائياً أو تواصل مع شركة التوصيل.",
            "COURIER_ISSUE_EXTENDED"
          );
        } else {
          await penalizeSellerFailure("SELLER_NOT_READY");
        }
        continue;
      }

      // 2) إذا وصلنا لمرحلة دفع البائع => اكتمال نهائي (COD)
      if (order.status === "COD_PAID_TO_SELLER") {
        // ✅ إرجاع عربون المشتري
        if (winnerUser && auction.depositAmount > 0) {
          await transferHeldToBalance({
            userId: winnerUser._id,
            amount: auction.depositAmount,
            reason: "إرجاع عربون المشتري بعد إتمام الصفقة",
            auctionId: auction._id,
            source: "BUYER",
          });
        }

        // ✅ إرجاع عربون البائع
        if (sellerUser && auction.sellerDeposit > 0) {
          await transferHeldToBalance({
            userId: sellerUser._id,
            amount: auction.sellerDeposit,
            reason: "إرجاع عربون البائع بعد إتمام الصفقة",
            auctionId: auction._id,
            source: "SELLER",
          });
        }

        auction.status = "completed";
        await auction.save();
        continue;
      }

      // 3) إذا تم التسليم للمشتري لكن لم يتم دفع البائع بعد => لا عقوبة (بانتظار payout)
      if (order.status === "DELIVERED") {
        await rescheduleCourierIssue(
          "تم تسليم الطلب، بانتظار إتمام دفع المبلغ للبائع من شركة التوصيل.",
          "تم تسليم الطلب للمشتري، بانتظار تأكيد استلامك لمبلغ الـCOD من شركة التوصيل."
        );
        continue;
      }

      // 4) فشل التوصيل => عقوبة حسب السبب
      if (order.status === "DELIVERY_FAILED") {
        const reason = order.failureReason || auction.deliveryPenaltyReason || "COURIER_ISSUE";

        // سبب من المشتري => مصادرة عربون المشتري + Refund للبائع
        if (BUYER_REASONS.has(reason)) {
          auction.status = "cancelled_by_winner";

          if (sellerUser) {
            await transferHeldToBalance({
              userId: sellerUser._id,
              amount: auction.sellerDeposit,
              reason: "إعادة عربون البائع بعد فشل التوصيل بسبب المشتري",
              auctionId: auction._id,
              source: "SELLER",
            });

            await notifyUser({
              userId: sellerUser._id,
              auctionId: auction._id,
              event: "DEPOSIT_REFUND",
              title: "تم إرجاع العربون",
              message: `تم إرجاع عربونك بقيمة ${toNumber(auction.sellerDeposit).toLocaleString()} د.ع بسبب فشل التوصيل (خطأ من المشتري).`,
            });
          }

          if (winnerUser) {
            const confiscation = await confiscateHeld({
              userId: winnerUser._id,
              amount: auction.depositAmount,
              reason: `مصادرة عربون المشتري بسبب فشل التوصيل (${reason})`,
              auctionId: auction._id,
              source: "BUYER",
            });

            await createAutoNegativeRating({ auctionId: auction._id, toUser: winnerUser._id });
            await checkAndBanUserIfNeeded(winnerUser._id);

            await notifyUser({
              userId: winnerUser._id,
              auctionId: auction._id,
              event: "PENALTY_CONFISCATE",
              title: "تمت مصادرة العربون",
              message: `تمت مصادرة عربونك بقيمة ${toNumber(confiscation.amount).toLocaleString()} د.ع بسبب فشل التوصيل (${reason}).`,
            });
          }

          await auction.save();
          continue;
        }

        // سبب من البائع => مصادرة عربون البائع + Refund للمشتري
        if (SELLER_REASONS.has(reason)) {
          await penalizeSellerFailure(reason);
          continue;
        }

        // لا نمنح تمديد إلا إذا كان السبب لوجستي من شركة التوصيل
        if (COURIER_REASONS.has(reason) && auction.deliveryPenaltyReason !== "COURIER_ISSUE_EXTENDED") {
          await rescheduleCourierIssue(
            "تعذر إتمام التوصيل بسبب مشكلة لوجستية. سيتم إعادة المتابعة تلقائياً أو يمكنك تغيير الشركة.",
            "تعذر إتمام التوصيل بسبب مشكلة لوجستية. سيتم إعادة المتابعة تلقائياً أو يمكنك تغيير الشركة.",
            "COURIER_ISSUE_EXTENDED"
          );
          continue;
        }

        if (COURIER_REASONS.has(reason) && auction.deliveryPenaltyReason === "COURIER_ISSUE_EXTENDED") {
          await penalizeSellerFailure(reason);
          continue;
        }

        // أي سبب غير مصنف/غير لوجستي يُعامل كتقصير من البائع بعد انتهاء المهلة
        await penalizeSellerFailure(reason || "SELLER_NOT_READY");
        continue;
      }

      // 5) حالات غير مكتملة بعد 4 أيام:
      if (COURIER_REASONS.has(auction.deliveryPenaltyReason) && auction.deliveryPenaltyReason !== "COURIER_ISSUE_EXTENDED") {
        await rescheduleCourierIssue(
          "التوصيل متأخر ولم يكتمل خلال المهلة. سيتم إعادة المتابعة تلقائياً بدون عقوبات.",
          "التوصيل متأخر ولم يكتمل خلال المهلة. سيتم إعادة المتابعة تلقائياً بدون عقوبات.",
          "COURIER_ISSUE_EXTENDED"
        );
        continue;
      }

      await penalizeSellerFailure("SELLER_NOT_READY");
      continue;
    }

    // ================================
    // 🚧 Manual Mode / No Order Cleanup
    // ================================
    if (auction.deliveryPenaltyReason !== "MANUAL_WAIT_EXTENDED") {
      // First extension: 48 hours for the seller to choose a courier.
      auction.deliveryPenaltyReason = "MANUAL_WAIT_EXTENDED";
      auction.penaltyApplied = false;
      auction.confirmationDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

      if (winnerUser) {
        await notifyUser({
          userId: winnerUser._id,
          auctionId: auction._id,
          event: "WAITING_COURIER_SETUP",
          title: "بانتظار البائع",
          message: "انتهت مهلة المزاد الأولية. تم منح البائع 48 ساعة إضافية لتحديد شركة التوصيل.",
        });
      }

      if (sellerUser) {
        await notifyUser({
          userId: sellerUser._id,
          auctionId: auction._id,
          event: "WAITING_COURIER_SETUP",
          title: "⚠️ تنبيه: اختر شركة توصيل فوراً",
          message: "انتهت المهلة ولم تختر شركة توصيل. تم منحك 48 ساعة نهائية قبل إلغاء المزاد ومصادرة عربونك.",
        });
      }

      await auction.save();
      continue;
    } else {
      // Second check: Time's up for the seller.
      await penalizeSellerFailure("SELLER_NOT_READY");
      continue;
    }
    const {
      winner,
      seller,
      depositAmount,
      sellerDeposit,
      winnerConfirmed,
      sellerConfirmed,
    } = auction;

    // إذا الطرفان ملتزمين → لا عقوبة
    if (winnerConfirmed && sellerConfirmed) {
      auction.status = "completed";
      await auction.save();
      continue;
    }

    /* ================================
       ❌ كلا الطرفين لم يؤكدا
    ================================ */
    if (!winnerConfirmed && !sellerConfirmed) {
      auction.status = "cancelled_by_both";

      // مصادرة المشتري
      if (winnerUser) {
        const confiscation = await confiscateHeld({
          userId: winnerUser._id,
          amount: depositAmount,
          reason: "مصادرة عربون المشتري لعدم الالتزام",
          auctionId: auction._id,
        });

        // احتفظ بالـ audit القديم إذا تحب (اختياري):


        await createAutoNegativeRating({
          auctionId: auction._id,
          toUser: winnerUser._id,
        });
        await checkAndBanUserIfNeeded(winnerUser._id);

        await notifyUser({
          userId: winnerUser._id,
          auctionId: auction._id,
          event: "PENALTY_CONFISCATE",
          title: "تمت مصادرة العربون",
          message: `تمت مصادرة عربونك بقيمة ${toNumber(confiscation.amount).toLocaleString()} د.ع بسبب عدم تأكيد الصفقة خلال المهلة.`,
        });
      }

      // مصادرة البائع
      if (sellerUser) {
        const confiscation = await confiscateHeld({
          userId: sellerUser._id,
          amount: sellerDeposit,
          reason: "مصادرة عربون البائع لعدم الالتزام",
          auctionId: auction._id,
        });



        await createAutoNegativeRating({
          auctionId: auction._id,
          toUser: sellerUser._id,
        });
        await checkAndBanUserIfNeeded(sellerUser._id);

        await notifyUser({
          userId: sellerUser._id,
          auctionId: auction._id,
          event: "PENALTY_CONFISCATE",
          title: "تمت مصادرة العربون",
          message: `تمت مصادرة عربونك بقيمة ${toNumber(confiscation.amount).toLocaleString()} د.ع بسبب عدم تأكيد الصفقة خلال المهلة.`,
        });
      }
    }

    /* ================================
       ❌ الفائز لم يؤكد
    ================================ */
    else if (!winnerConfirmed && sellerConfirmed) {
      auction.status = "cancelled_by_winner";

      // Refund للبائع
      if (sellerUser) {
        await transferHeldToBalance({
          userId: sellerUser._id,
          amount: sellerDeposit,
          reason: "إعادة عربون البائع بعد تخلف الفائز",
          auctionId: auction._id,
        });



        await notifyUser({
          userId: sellerUser._id,
          auctionId: auction._id,
          event: "DEPOSIT_REFUND",
          title: "تم إرجاع العربون",
          message: `تم إرجاع عربونك بقيمة ${toNumber(sellerDeposit).toLocaleString()} د.ع بعد تخلف الفائز.`,
        });
      }

      // مصادرة الفائز
      if (winnerUser) {
        const confiscation = await confiscateHeld({
          userId: winnerUser._id,
          amount: depositAmount,
          reason: "مصادرة عربون الفائز لعدم تأكيد الصفقة خلال المهلة",
          auctionId: auction._id,
        });



        await createAutoNegativeRating({
          auctionId: auction._id,
          toUser: winnerUser._id,
        });
        await checkAndBanUserIfNeeded(winnerUser._id);

        await notifyUser({
          userId: winnerUser._id,
          auctionId: auction._id,
          event: "PENALTY_CONFISCATE",
          title: "تمت مصادرة العربون",
          message: `تمت مصادرة عربونك بقيمة ${toNumber(confiscation.amount).toLocaleString()} د.ع بسبب عدم تأكيد الصفقة خلال المهلة.`,
        });
      }
    }

    /* ================================
       ❌ البائع لم يؤكد
    ================================ */
    else if (winnerConfirmed && !sellerConfirmed) {
      auction.status = "cancelled_by_seller";

      // Refund للمشتري
      if (winnerUser) {
        await transferHeldToBalance({
          userId: winnerUser._id,
          amount: depositAmount,
          reason: "إعادة عربون المشتري بعد تخلف البائع",
          auctionId: auction._id,
        });



        await notifyUser({
          userId: winnerUser._id,
          auctionId: auction._id,
          event: "DEPOSIT_REFUND",
          title: "تم إرجاع العربون",
          message: `تم إرجاع عربونك بقيمة ${toNumber(depositAmount).toLocaleString()} د.ع بعد تخلف البائع.`,
        });
      }

      // مصادرة البائع
      if (sellerUser) {
        const confiscation = await confiscateHeld({
          userId: sellerUser._id,
          amount: sellerDeposit,
          reason: "مصادرة عربون البائع لعدم تأكيد تسليم السلعة",
          auctionId: auction._id,
        });



        await createAutoNegativeRating({
          auctionId: auction._id,
          toUser: sellerUser._id,
        });
        await checkAndBanUserIfNeeded(sellerUser._id);

        await notifyUser({
          userId: sellerUser._id,
          auctionId: auction._id,
          event: "PENALTY_CONFISCATE",
          title: "تمت مصادرة العربون",
          message: `تمت مصادرة عربونك بقيمة ${toNumber(confiscation.amount).toLocaleString()} د.ع بسبب عدم تأكيد التسليم خلال المهلة.`,
        });
      }
    }

    /* ================================
       🔔 إشعار عام بإغلاق المزاد
    ================================ */
    if (winnerUser) {
      await notifyUser({
        userId: winnerUser._id,
        auctionId: auction._id,
        event: "AUCTION_CLOSED",
        title: "⚠️ إغلاق مزاد",
        message: "تم إغلاق المزاد بسبب عدم الالتزام بعد انتهاء المهلة.",
      });
    }

    if (sellerUser) {
      await notifyUser({
        userId: sellerUser._id,
        auctionId: auction._id,
        event: "AUCTION_CLOSED",
        title: "⚠️ إغلاق مزاد",
        message: "تم إغلاق المزاد بسبب عدم الالتزام بعد انتهاء المهلة.",
      });
    }

    await auction.save();
  }

  console.log("Auction penalty cron executed successfully");
};

export default applyAuctionPenalty;
