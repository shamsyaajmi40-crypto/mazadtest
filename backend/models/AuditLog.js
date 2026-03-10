import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["CONFISCATE",
        "CONFISCATE_OK",
        "CONFISCATE_FAILED",
        "CONFISCATE_BLOCKED",
        "REFUND",
        "SELLER_DEPOSIT_LOCKED",
        "REFUND_FAILED",
        "CLOSE",
        "WALLET_TOPUP_PAID",
        "REFUND_REQUEST_CREATED",
        "REFUND_REQUEST_APPROVED",
        "REFUND_REQUEST_REJECTED",
        "UNDO_REJECT",
        "FEATURE_AUCTION_PAYMENT",
      ],
      required: true,
    },
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    amount: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      required: true,
    },
    by: {
      type: String,
      default: "SYSTEM",
    },
    receiptId: { type: String, unique: true, sparse: true, index: true },
    source: {
      type: String,
      enum: ["SELLER", "BUYER", "PLATFORM", "OTHER"],
      default: "OTHER",
    },
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditLogSchema);
