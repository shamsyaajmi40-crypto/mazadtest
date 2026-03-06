import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
    },
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    depositHeld: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
      required: true,
    },
    isDepositHeld: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// فهرس لتحسين جلب أعلى مزايدة بسرعة
bidSchema.index({ auction: 1, amount: -1, createdAt: 1 });

// ✅ Additional performance indexes
bidSchema.index({ bidder: 1 });          // user bid history queries
bidSchema.index({ createdAt: -1 });       // newest-first sort

export default mongoose.model("Bid", bidSchema);
