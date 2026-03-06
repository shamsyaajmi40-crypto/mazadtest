
import cron from "node-cron";
import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import FinanceLog from "../models/FinanceLog.js";
import applyAuctionPenalty from "./auctionPenalty.js";
import { getIo } from "../utils/socket.js";
import { generateReceiptId, signReceipt } from "../utils/receipt.js";
import { sendReceiptEmail } from "../utils/email.js";
import { sendAppNotification } from "../utils/notification.js";

const closeAuctions = () => {
  console.log("CRON INITIALIZED (Auction Closer - ATOMIC LOCK)");

  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const expiredAuctions = await Auction.find({
        status: { $in: ["ACTIVE", "active"] },
        endTime: { $lte: now },
        closingLock: { $ne: true },
      }).select("_id");

      for (const a of expiredAuctions) {
        // ✅ LOCK ذري (بدون ENDING)
        const lock = await Auction.updateOne(
          {
            _id: a._id,
            status: { $in: ["ACTIVE", "active"] },
            endTime: { $lte: now },
            closingLock: { $ne: true },
          },
          { $set: { closingLock: true } }
        );

        if (lock.modifiedCount === 0) continue;

        const auction = await Auction.findById(a._id);
        if (!auction) continue;

        const highestBid = await Bid.findOne({ auction: auction._id })
          .sort({ amount: -1, createdAt: 1 })
          .populate("bidder", "_id");

        auction.status = "ENDED";
        auction.closedAt = now;

        if (highestBid) {
          const winnerId = highestBid.bidder._id;
          auction.winner = winnerId;
          auction.currentPrice = highestBid.amount;
          auction.confirmationDeadline = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); //4 ايام

        }

        await auction.save();

        // إشعارات
        if (highestBid) {
          const winnerId = highestBid.bidder._id;
          await sendAppNotification({
            userId: winnerId,
            title: "🎉 مبروك!",
            message: "فزت بالمزاد ✅ الحالة الآن: بانتظار تأكيد شركة التوصيل (OTP عند التسليم).",
            event: "WIN",
            type: "WIN",
            auctionId: auction._id,
          });

          const sellerId = auction.owner || auction.seller;
          if (sellerId) {
            await sendAppNotification({
              userId: sellerId,
              title: "تم بيع مزادك! 🎉",
              message: `لقد رسا مزادك "${auction.title}" على أحد المزايدين.يرجى الاستعداد وتسليم الطلب.`,
              event: "AUCTION_SOLD",
              type: "SYSTEM",
              auctionId: auction._id,
            });
          }

          const io = getIo();
          if (io) {
            io.to(winnerId.toString()).emit("user_refresh"); // تحديث عداد الصفقات للفائز
            if (sellerId) {
              io.to(sellerId.toString()).emit("user_refresh"); // تحديث عداد الصفقات للبائع
            }
          }

          const losers = await Bid.distinct("bidder", {
            auction: auction._id,
            bidder: { $ne: winnerId },
          });

          for (const loserId of losers) {
            // ✅ Refund loser deposit
            if (auction.depositAmount > 0) {
              const refundRes = await User.updateOne(
                { _id: loserId, heldBalance: { $gte: auction.depositAmount } },
                { $inc: { heldBalance: -auction.depositAmount, balance: auction.depositAmount } }
              );

              if (refundRes.modifiedCount > 0) {
                const receiptId = generateReceiptId();
                const signData = { action: "REFUND", auction: String(auction._id), user: String(loserId), amount: auction.depositAmount, receiptId };
                const signature = signReceipt(signData);

                await AuditLog.create({
                  action: "REFUND",
                  auction: auction._id,
                  user: loserId,
                  amount: auction.depositAmount,
                  receiptId,
                  reason: "Bidder deposit refund (lost auction)",
                  by: "SYSTEM",
                  meta: { signature }
                });

                await FinanceLog.create({
                  user: loserId,
                  type: "DEPOSIT_REFUND",
                  amountIQD: auction.depositAmount,
                  refModel: "Auction",
                  refId: auction._id,
                  receiptId,
                  meta: {
                    reason: "Bidder deposit refund (lost auction)",
                    signature
                  }
                });

                const loserUser = await User.findById(loserId).select("name email");
                if (loserUser && loserUser.email) {
                  sendReceiptEmail({
                    to: loserUser.email,
                    userName: loserUser.name,
                    receiptId,
                    amount: auction.depositAmount,
                    type: "DEPOSIT_REFUND",
                    date: new Date(),
                    details: "إرجاع عربون دخول المزاد بعد انتهاء المزاد وعدم فوزك."
                  }).catch(e => console.error("Email error:", e));
                }
              }
            }

            await sendAppNotification({
              userId: loserId,
              title: "انتهى المزاد",
              message: "للأسف، لم تفز في هذا المزاد، وقد تمت إعادة العربون إلى رصيدك المتاح.",
              event: "LOSE",
              type: "LOSE",
              auctionId: auction._id,
            });
          }
        } else {
          // اختياري: NO_BIDS للبائع
          const sellerId = auction.owner || auction.seller;
          if (sellerId) {
            // ✅ Refund seller deposit (no bids)
            if (auction.sellerDeposit > 0) {
              const refundRes = await User.updateOne(
                { _id: sellerId, heldBalance: { $gte: auction.sellerDeposit } },
                { $inc: { heldBalance: -auction.sellerDeposit, balance: auction.sellerDeposit } }
              );

              if (refundRes.modifiedCount > 0) {
                const receiptId = generateReceiptId();
                const signData = { action: "REFUND", auction: String(auction._id), user: String(sellerId), amount: auction.sellerDeposit, receiptId };
                const signature = signReceipt(signData);

                await AuditLog.create({
                  action: "REFUND",
                  auction: auction._id,
                  user: sellerId,
                  amount: auction.sellerDeposit,
                  receiptId,
                  reason: "Seller deposit refund (no bids)",
                  by: "SYSTEM",
                  meta: { signature }
                });

                await FinanceLog.create({
                  user: sellerId,
                  type: "DEPOSIT_REFUND",
                  amountIQD: auction.sellerDeposit,
                  refModel: "Auction",
                  refId: auction._id,
                  receiptId,
                  meta: {
                    reason: "Seller deposit refund (no bids)",
                    signature
                  }
                });

                const sellerUser = await User.findById(sellerId).select("name email");
                if (sellerUser && sellerUser.email) {
                  sendReceiptEmail({
                    to: sellerUser.email,
                    userName: sellerUser.name,
                    receiptId,
                    amount: auction.sellerDeposit,
                    type: "DEPOSIT_REFUND",
                    date: new Date(),
                    details: "إرجاع عربون المزاد لعدم وجود مزايدين."
                  }).catch(e => console.error("Email error:", e));
                }
              }
            }

            await sendAppNotification({
              userId: sellerId,
              title: "انتهى المزاد بدون فائز 😔",
              message: `للأسف، انتهى الوقت المخصص لمزادك "${auction.title}" دون تلقي أي مزايدات فعالة.تمت إعادة عربون النشر إلى رصيدك.`,
              event: "AUCTION_NO_BIDS",
              type: "SYSTEM",
              auctionId: auction._id,
            });

            const io = getIo();
            if (io) {
              io.to(sellerId.toString()).emit("user_refresh");
            }
          }
        }
      }

      await applyAuctionPenalty();
    } catch (err) {
      console.error("Auction cron error:", err);
    }
  });
};

export default closeAuctions;
