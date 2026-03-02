import Auction from "../models/Auction.js";
export const activateScheduledAuctions = async () => {
  const now = new Date();

  const result = await Auction.updateMany(
    {
      status: "upcoming",
      startTime: { $lte: now },
    },
    {
      $set: { status: "active" },
    }
  );

  if (result.modifiedCount > 0) {
    console.log(`✅ Activated ${result.modifiedCount} scheduled auctions`);
  }
};
