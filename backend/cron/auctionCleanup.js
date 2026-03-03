import nodeCron from "node-cron";
import Auction from "../models/Auction.js";
import { deleteFromR2 } from "../utils/r2.js";

/**
 * وظيفة تنظيف المزادات المرفوضة القديمة (أكثر من 30 يوم)
 * تعمل يومياً في الساعة 3 فجراً
 */
const startAuctionCleanupCron = () => {
    // تشغيل كل 30 دقيقة
    nodeCron.schedule("*/30 * * * *", async () => {
        console.log("🧹 Running Rejected Auctions Cleanup Task...");

        try {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            // المرحلة الأولى: حذف الصور بعد ساعة من الرفض
            const auctionsToClearImages = await Auction.find({
                status: "rejected",
                rejectedAt: { $lt: oneHourAgo },
                images: { $exists: true, $not: { $size: 0 } }
            });

            if (auctionsToClearImages.length > 0) {
                console.log(`🖼️ Clearing images for ${auctionsToClearImages.length} auctions rejected > 1 hour ago.`);
                for (const auction of auctionsToClearImages) {
                    for (const imageUrl of auction.images) {
                        await deleteFromR2(imageUrl);
                    }
                    auction.images = [];
                    await auction.save();
                    console.log(`✅ Images cleared for auction: ${auction._id}`);
                }
            }

            // المرحلة الثانية: حذف المزاد نهائياً بعد 30 يوم
            const auctionsToDelete = await Auction.find({
                status: "rejected",
                rejectedAt: { $lt: thirtyDaysAgo }
            });

            if (auctionsToDelete.length > 0) {
                console.log(`🗑️ Permanently deleting ${auctionsToDelete.length} records rejected > 30 days ago.`);
                for (const auction of auctionsToDelete) {
                    // للتأكد: نحذف الصور لو كانت لسه موجودة لسبب ما
                    if (auction.images && auction.images.length > 0) {
                        for (const imageUrl of auction.images) {
                            await deleteFromR2(imageUrl);
                        }
                    }
                    await Auction.findByIdAndDelete(auction._id);
                    console.log(`🔥 Record deleted: ${auction._id}`);
                }
            }

        } catch (error) {
            console.error("❌ Error in Auction Cleanup Cron:", error);
        }
    });
};

export default startAuctionCleanupCron;
