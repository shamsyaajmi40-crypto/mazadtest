import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import applyAuctionPenalty from "./auctionPenalty.js";
import { getIo } from "../utils/socket.js";
import { generateReceiptId, signReceipt } from "../utils/receipt.js";
import { sendReceiptEmail } from "../utils/email.js";
import { sendAppNotification } from "../utils/notification.js";
import { createLedgerEntry, generateOperationId } from "../utils/ledger.js";

const closeAuctions = () => {
  console.log("PROCESS INITIALIZED (Auction Closer - 10s Interval)");

  const runClosing = async () => {
    try {
      const now = new Date();

      const expiredAuctions = await Auction.find({
        status: { $in: ["ACTIVE", "active"] },
        endTime: { $lte: now },
        closingLock: { $ne: true },
      }).select("_id");

      for (const a of expiredAuctions) {
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

        const session = await mongoose.startSession();
        const notifyQueue = [];
        const emailQueue = [];

        try {
          session.startTransaction();

          const auction = await Auction.findById(a._id).session(session);
          if (!auction) {
            await session.abortTransaction();
            session.endSession();
            continue;
          }

          const highestBid = await Bid.findOne({ auction: auction._id })
            .sort({ amount: -1, createdAt: 1 })
            .populate("bidder", "_id")
            .session(session);

          auction.status = "ENDED";
          auction.closedAt = now;

          if (highestBid) {
            const winnerId = highestBid.bidder._id;
            auction.winner = winnerId;
            auction.currentPrice = highestBid.amount;
            auction.confirmationDeadline = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

            notifyQueue.push({
              userId: winnerId,
              title: "🎉 مبروك!",
              message: "فزت بالمزاد ✅ الحالة الآن: بانتظار البائع لتحديد شركة التوصيل (سيصلك OTP عند التسليم).",
              event: "WIN",
              type: "WIN",
              auctionId: auction._id,
            });

            const sellerId = auction.owner || auction.seller;
            if (sellerId) {
              notifyQueue.push({
                userId: sellerId,
                title: "تم بيع مزادك! 🎉",
                message: `لقد رسا مزادك "${auction.title}" على أحد المزايدين. يرجى تحديد شركة توصيل خلال 48 ساعة وإلا سيتم إلغاء المزاد ومصادرة العربون.`,
                event: "AUCTION_SOLD",
                type: "SYSTEM",
                auctionId: auction._id,
              });
            }

            if (auction.depositAmount > 0) {
              const losers = await Bid.distinct("bidder", {
                auction: auction._id,
                bidder: { $ne: winnerId },
              }).session(session);

              for (const loserId of losers) {
                const loserBefore = await User.findById(loserId).select("balance heldBalance name email").session(session);
                if (loserBefore) {
                  const beforeBalance = Number(loserBefore.balance || 0);
                  const beforeHeld = Number(loserBefore.heldBalance || 0);
                  const deposit = Number(auction.depositAmount || 0);

                  if (beforeHeld >= deposit) {
                    const refundRes = await User.updateOne(
                      { _id: loserId, balance: beforeBalance, heldBalance: beforeHeld },
                      { $inc: { heldBalance: -deposit, balance: deposit } },
                      { session }
                    );

                    if (refundRes.modifiedCount === 0) {
                      throw new Error(`Wallet update conflict while refunding loser deposit for user ${loserId}`);
                    }

                    const receiptId = generateReceiptId();
                    const signData = {
                      action: "REFUND",
                      auction: String(auction._id),
                      user: String(loserId),
                      amount: deposit,
                      receiptId,
                    };
                    const signature = signReceipt(signData);

                    await AuditLog.create(
                      [{
                        action: "REFUND",
                        auction: auction._id,
                        user: loserId,
                        amount: deposit,
                        receiptId,
                        reason: "Bidder deposit refund (lost auction)",
                        by: "SYSTEM",
                        meta: { signature },
                      }],
                      { session }
                    );

                    await createLedgerEntry({
                      session,
                      operationId: generateOperationId("close_loser_refund"),
                      userId: loserId,
                      type: "DEPOSIT_REFUND",
                      amountIQD: deposit,
                      balanceBefore: beforeBalance,
                      balanceAfter: beforeBalance + deposit,
                      heldBefore: beforeHeld,
                      heldAfter: beforeHeld - deposit,
                      referenceModel: "Auction",
                      referenceId: auction._id,
                      receiptId,
                      metadata: { reason: "Bidder deposit refund (lost auction)", signature },
                    });

                    if (loserBefore.email) {
                      emailQueue.push({
                        to: loserBefore.email,
                        userName: loserBefore.name,
                        receiptId,
                        amount: deposit,
                        type: "DEPOSIT_REFUND",
                        date: new Date(),
                        details: "إرجاع عربون دخول المزاد بعد انتهاء المزاد وعدم فوزك.",
                      });
                    }
                  }
                }

                notifyQueue.push({
                  userId: loserId,
                  title: "انتهى المزاد",
                  message: "للأسف، لم تفز في هذا المزاد، وقد تمت إعادة العربون إلى رصيدك المتاح.",
                  event: "LOSE",
                  type: "LOSE",
                  auctionId: auction._id,
                });
              }
            }
          } else {
            const sellerId = auction.owner || auction.seller;
            if (sellerId && auction.sellerDeposit > 0) {
              const sellerBefore = await User.findById(sellerId).select("balance heldBalance name email").session(session);
              if (sellerBefore) {
                const beforeBalance = Number(sellerBefore.balance || 0);
                const beforeHeld = Number(sellerBefore.heldBalance || 0);
                const deposit = Number(auction.sellerDeposit || 0);

                if (beforeHeld >= deposit) {
                  const refundRes = await User.updateOne(
                    { _id: sellerId, balance: beforeBalance, heldBalance: beforeHeld },
                    { $inc: { heldBalance: -deposit, balance: deposit } },
                    { session }
                  );

                  if (refundRes.modifiedCount === 0) {
                    throw new Error(`Wallet update conflict while refunding seller deposit for user ${sellerId}`);
                  }

                  const receiptId = generateReceiptId();
                  const signData = {
                    action: "REFUND",
                    auction: String(auction._id),
                    user: String(sellerId),
                    amount: deposit,
                    receiptId,
                  };
                  const signature = signReceipt(signData);

                  await AuditLog.create(
                    [{
                      action: "REFUND",
                      auction: auction._id,
                      user: sellerId,
                      amount: deposit,
                      receiptId,
                      reason: "Seller deposit refund (no bids)",
                      by: "SYSTEM",
                      meta: { signature },
                    }],
                    { session }
                  );

                  await createLedgerEntry({
                    session,
                    operationId: generateOperationId("close_seller_refund"),
                    userId: sellerId,
                    type: "DEPOSIT_REFUND",
                    amountIQD: deposit,
                    balanceBefore: beforeBalance,
                    balanceAfter: beforeBalance + deposit,
                    heldBefore: beforeHeld,
                    heldAfter: beforeHeld - deposit,
                    referenceModel: "Auction",
                    referenceId: auction._id,
                    receiptId,
                    metadata: { reason: "Seller deposit refund (no bids)", signature },
                  });

                  if (sellerBefore.email) {
                    emailQueue.push({
                      to: sellerBefore.email,
                      userName: sellerBefore.name,
                      receiptId,
                      amount: deposit,
                      type: "DEPOSIT_REFUND",
                      date: new Date(),
                      details: "إرجاع عربون المزاد لعدم وجود مزايدين.",
                    });
                  }
                }
              }
            }

            if (sellerId) {
              notifyQueue.push({
                userId: sellerId,
                title: "انتهى المزاد بدون فائز 😔",
                message: `للأسف، انتهى الوقت المخصص لمزادك "${auction.title}" دون تلقي أي مزايدات فعالة. تمت إعادة عربون النشر إلى رصيدك.`,
                event: "AUCTION_NO_BIDS",
                type: "SYSTEM",
                auctionId: auction._id,
              });
            }
          }

          await auction.save({ session });
          await session.commitTransaction();

          for (const mail of emailQueue) {
            sendReceiptEmail(mail).catch((e) => console.error("Email error:", e));
          }

          for (const notif of notifyQueue) {
            await sendAppNotification(notif);
          }

          const io = getIo();
          if (io) {
            const uniqueUsers = new Set(notifyQueue.map((n) => String(n.userId)).filter(Boolean));
            for (const uid of uniqueUsers) {
              io.to(uid).emit("user_refresh");
            }
          }
        } catch (err) {
          if (session.inTransaction()) {
            await session.abortTransaction();
          }
          console.error("Auction close transaction error:", err);
          // unlock for retry in next cycle
          await Auction.updateOne({ _id: a._id }, { $set: { closingLock: false } });
        } finally {
          session.endSession();
        }
      }

      await applyAuctionPenalty();
    } catch (err) {
      console.error("Auction closer error:", err);
    }
  };

  setInterval(runClosing, 10000);
  runClosing();
};

export default closeAuctions;
