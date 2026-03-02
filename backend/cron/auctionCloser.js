import cron from "node-cron";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import Notification from "../models/Notification.js";
import applyAuctionPenalty from "./auctionPenalty.js";
import { getIo } from "../utils/socket.js";

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
          const winNotification = await Notification.create({
            user: winnerId,
            type: "WIN",
            event: "WIN", // Added this field
            title: "🎉 مبروك!",
            message: "فزت بالمزاد ✅ الحالة الآن: بانتظار تأكيد شركة التوصيل (OTP عند التسليم).",
            auction: auction._id,
          });

          const sellerId = auction.owner || auction.seller;
          const sellerWinNotif = sellerId ? await Notification.create({
            user: sellerId,
            type: "SYSTEM",
            event: "AUCTION_SOLD",
            title: "تم بيع مزادك! 🎉",
            message: `لقد رسا مزادك "${auction.title}" على أحد المزايدين. يرجى الاستعداد وتسليم الطلب.`,
            auction: auction._id,
          }) : null;

          const io = getIo();
          if (io) {
            io.to(winnerId.toString()).emit("new_notification", winNotification);
            io.to(winnerId.toString()).emit("user_refresh"); // تحديث عداد الصفقات للفائز

            if (sellerId) {
              if (sellerWinNotif) io.to(sellerId.toString()).emit("new_notification", sellerWinNotif);
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
                await AuditLog.create({
                  action: "REFUND",
                  auction: auction._id,
                  user: loserId,
                  amount: auction.depositAmount,
                  reason: "Bidder deposit refund (lost auction)",
                  by: "SYSTEM",
                });
              }
            }

            const loseNotification = await Notification.create({
              user: loserId,
              type: "LOSE",
              event: "LOSE",
              title: "انتهى المزاد",
              message: "للأسف، لم تفز في هذا المزاد، وقد تمت إعادة العربون إلى رصيدك المتاح.",
              auction: auction._id,
            });

            const io = getIo();
            if (io) io.to(loserId.toString()).emit("new_notification", loseNotification);
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
                await AuditLog.create({
                  action: "REFUND",
                  auction: auction._id,
                  user: sellerId,
                  amount: auction.sellerDeposit,
                  reason: "Seller deposit refund (no bids)",
                  by: "SYSTEM",
                });
              }
            }

            const noBidsNotif = await Notification.create({
              user: sellerId,
              type: "SYSTEM",
              event: "AUCTION_NO_BIDS",
              title: "انتهى المزاد بدون فائز 😔",
              message: `للأسف، انتهى الوقت المخصص لمزادك "${auction.title}" دون تلقي أي مزايدات فعالة. تمت إعادة عربون النشر إلى رصيدك.`,
              auction: auction._id,
            });
            const io = getIo();
            if (io) {
              io.to(sellerId.toString()).emit("new_notification", noBidsNotif);
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
