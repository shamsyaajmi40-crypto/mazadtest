import mongoose from "mongoose";

import "./config/env.js";

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ ERROR: MONGO_URI is missing from environment variables.");
    process.exit(1);
}
async function check() {
    await mongoose.connect(MONGO_URI);
    console.log("Connected");

    const PlatformSetting = mongoose.connection.collection("platformsettings");
    const policy = await PlatformSetting.findOne({ key: "deposit_policy" });
    console.log("Deposit Policy in DB:");
    console.log(JSON.stringify(policy, null, 2));

    await mongoose.disconnect();
}

check().catch(console.error);
