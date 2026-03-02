import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const db = mongoose.connection.db;
    const users = db.collection("users");

    const platformId = process.env.PLATFORM_USER_ID;
    console.log("Checking PLATFORM_USER_ID:", platformId);

    if (!platformId) {
        console.log("No PLATFORM_USER_ID in .env!");
        process.exit(0);
    }

    const { ObjectId } = mongoose.Types;
    let id;
    try {
        id = new ObjectId(platformId);
    } catch (e) {
        console.log("Invalid ObjectId format:", platformId);
        process.exit(0);
    }

    const user = await users.findOne({ _id: id });
    if (user) {
        console.log("Platform user exists! Balance:", user.balance);
    } else {
        console.log("Platform user NOT FOUND! Creating...");
        await users.insertOne({
            _id: id,
            name: "Platform Admin",
            email: "admin@mazaad.iq",
            phone: "0000000000",
            password: "hashed_dummy_password",
            role: "admin",
            balance: 0,
            heldBalance: 0,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log("Created successfully.");
    }
    process.exit(0);
});
