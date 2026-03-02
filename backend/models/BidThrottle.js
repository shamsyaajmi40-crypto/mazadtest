import mongoose from "mongoose";

const BidThrottleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    auctionId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    nextAllowedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

BidThrottleSchema.index({ userId: 1, auctionId: 1 }, { unique: true });

export default mongoose.model("BidThrottle", BidThrottleSchema);
