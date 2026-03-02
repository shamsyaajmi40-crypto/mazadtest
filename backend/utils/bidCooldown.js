import mongoose from "mongoose";
import BidThrottle from "../models/BidThrottle.js";

export async function rollbackBidCooldown({ userId, auctionId }) {
  const now = new Date();
  await BidThrottle.updateOne(
    { userId: new mongoose.Types.ObjectId(userId), auctionId: new mongoose.Types.ObjectId(auctionId) },
    { $set: { nextAllowedAt: now } }
  );
}
export async function enforceBidCooldown({ userId, auctionId, windowMs }) {
  const now = new Date();
  const nextAllowedAt = new Date(now.getTime() + windowMs);

  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
    auctionId: new mongoose.Types.ObjectId(auctionId),
    $or: [{ nextAllowedAt: { $lte: now } }, { nextAllowedAt: { $exists: false } }],
  };

  try {
    const doc = await BidThrottle.findOneAndUpdate(
      filter,
      { $set: { nextAllowedAt } },
      { new: true, upsert: true }
    ).lean();

    return { allowed: true, nextAllowedAt: doc.nextAllowedAt };
  } catch (err) {
    const existing = await BidThrottle.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      auctionId: new mongoose.Types.ObjectId(auctionId),
    }).lean();

    if (existing?.nextAllowedAt && existing.nextAllowedAt > now) {
      const retryAfterMs = existing.nextAllowedAt.getTime() - now.getTime();
      return { allowed: false, nextAllowedAt: existing.nextAllowedAt, retryAfterMs };
    }

    return { allowed: true, nextAllowedAt };
  }
}
