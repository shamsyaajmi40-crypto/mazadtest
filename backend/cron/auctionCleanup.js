import nodeCron from "node-cron";
import Auction from "../models/Auction.js";
import { deleteFromR2 } from "../utils/r2.js";

/**
 * وظيفة تنظيف المزادات المرفوضة القديمة (أكثر من 30 يوم)
 * تعمل يومياً في الساعة 3 فجراً
 */
const startAuctionCleanupCron = () => {
    nodeCron.schedule("0 3 * * *", async () => {
        console.log("🧹 Starting Rejected Auctions Cleanup Task...");

        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // البحث عن المزادات المرفوضة التي مر عليها 30 يوم
            const oldRejectedAuctions = await Auction.find({
                status: "rejected",
                updatedAt: { $lt: thirtyDaysAgo }
            });

            console.log(`🔍 Found ${oldRejectedAuctions.length} old rejected auctions to clean up.`);

            for (const auction of oldRejectedAuctions) {
                // 1. حذف الصور من Cloudflare R2
                if (auction.images && auction.images.length > 0) {
                    for (const imageUrl of auction.images) {
                        await deleteFromR2(imageUrl);
                    }
                }

                // 2. حذف المزاد من قاعدة البيانات
                await Auction.findByIdAndDelete(auction._id);
                console.log(`🗑️ Permanently deleted auction: ${auction._id} (${auction.title})`);
            }

            console.log("✅ Cleanup Task Finished Successfully.");
        } catch (error) {
            console.error("❌ Error in Auction Cleanup Cron:", error);
        }
    });
};

export default startAuctionCleanupCron;
