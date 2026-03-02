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

export default mongoose.model("Bid", bidSchema);
