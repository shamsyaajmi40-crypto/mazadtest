import nodeCron from "node-cron";
import Auction from "../models/Auction.js";
import Rating from "../models/Rating.js";
import User from "../models/User.js";

/**
 * Automatically creates 5-star ratings for completed deals
 * that haven't been rated by either party within 7 days.
 */
const autoPositiveRating = async () => {
    try {
        console.log("🕒 Starting Auto Positive Rating Cron...");
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Find completed auctions older than 7 days
        const auctions = await Auction.find({
            status: "completed",
            updatedAt: { $lt: sevenDaysAgo }
        });

        console.log(`🔍 Found ${auctions.length} completed auctions older than 7 days`);

        for (const auction of auctions) {
            // Find existing ratings for this auction
            const ratings = await Rating.find({ auction: auction._id });
            const ratingFromUserIds = ratings.map(r => r.fromUser.toString());

            // 1. Rating from Winner to Owner (Buyer to Seller)
            if (auction.winner && !ratingFromUserIds.includes(auction.winner.toString())) {
                await createAutoPositiveRating(auction, auction.winner, auction.owner, "buyer_to_seller");
                console.log(`✅ Created auto-rating: Winner ${auction.winner} -> Owner ${auction.owner}`);
            }

            // 2. Rating from Owner to Winner (Seller to Buyer)
            if (auction.owner && !ratingFromUserIds.includes(auction.owner.toString())) {
                await createAutoPositiveRating(auction, auction.owner, auction.winner, "seller_to_buyer");
                console.log(`✅ Created auto-rating: Owner ${auction.owner} -> Winner ${auction.winner}`);
            }
        }
        console.log("🏁 Auto Positive Rating Cron finished.");
    } catch (error) {
        console.error("❌ Auto Positive Rating Error:", error);
    }
};

const createAutoPositiveRating = async (auction, fromUser, toUser, role) => {
    try {
        await Rating.create({
            auction: auction._id,
            fromUser,
            toUser,
            role,
            score: 5,
            reasons: ["auto_positive"],
            comment: "تقييم تلقائي إيجابي لإتمام الصفقة بنجاح",
        });

        // Update toUser average
        const allUserRatings = await Rating.find({ toUser });
        const count = allUserRatings.length;
        const average = count > 0 ? allUserRatings.reduce((sum, r) => sum + r.score, 0) / count : 0;

        await User.findByIdAndUpdate(toUser, {
            "rating.average": Number(average.toFixed(1)),
            "rating.count": count,
        });
    } catch (err) {
        console.error("Failed to create auto rating:", err);
    }
};

// Start cron - run once a day at midnight
const startAutoPositiveRatingCron = () => {
    nodeCron.schedule("0 0 * * *", autoPositiveRating);
    console.log("📅 Auto Positive Rating Cron Scheduled: Daily at 00:00");
};

export { autoPositiveRating, startAutoPositiveRatingCron };
