import mongoose from "mongoose";
import dotenv from "dotenv";
import Rating from "./models/Rating.js";
import User from "./models/User.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mazad";

mongoose.connect(MONGO_URI).then(async () => {
    console.log("Connected to MongoDB. Syncing all user ratings...");
    try {
        const users = await User.find();
        let updatedCount = 0;

        for (const user of users) {
            const ratings = await Rating.find({ toUser: user._id });
            const count = ratings.length;
            const average = count > 0 ? ratings.reduce((acc, r) => acc + r.score, 0) / count : 0;

            await User.findByIdAndUpdate(user._id, {
                "rating.average": Number(average.toFixed(1)),
                "rating.count": count
            });

            if (count > 0) {
                console.log(`Updated ${user.name}: ${average.toFixed(1)} stars (${count} ratings)`);
            }
            updatedCount++;
        }

        console.log(`Successfully synced ratings for ${updatedCount} users.`);
    } catch (e) {
        console.error("Error syncing ratings:", e);
    } finally {
        mongoose.disconnect();
        process.exit(0);
    }
}).catch(console.error);
