import mongoose from "mongoose";

const MONGO_URI = "mongodb+srv://mazaDB:EngenerOmar89@cluster0.cdaeyzl.mongodb.net/?appName=Cluster0";

async function check() {
    await mongoose.connect(MONGO_URI);
    console.log("Connected");

    const User = mongoose.connection.collection("users");
    const Auction = mongoose.connection.collection("auctions");

    // Find users with high balance to identify the user
    const users = await User.find({ balance: { $gte: 10000 } }).toArray();
    console.log("Users with balance >= 10k:");
    users.forEach(u => console.log(`- ${u.name}: balance=${u.balance}, heldBalance=${u.heldBalance}, objType=${typeof u.balance}`));

    const auctions = await Auction.find({ status: "active" }).toArray();
    console.log("\nActive Auctions:");
    auctions.forEach(a => console.log(`- ${a.title}: depositAmount=${a.depositAmount}, objType=${typeof a.depositAmount}`));

    await mongoose.disconnect();
}

check().catch(console.error);
