import mongoose from "mongoose";

const FinanceLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: [
        "REFUND_REQUEST_CREATED",
        "REFUND_REQUEST_APPROVED",
        "REFUND_REQUEST_REJECTED",
        "WALLET_TOPUP_PAID",
        "FEATURE_AUCTION_PAYMENT",
        "DEPOSIT_REFUND",
        "DEPOSIT_CONFISCATE",
        "PLATFORM_COMMISSION",
      ],
      required: true,
    },

    amountIQD: { type: Number, default: 0 },
    refModel: { type: String, default: "" }, // "RefundRequest" | "PaymentTransaction" | ...
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },

    receiptId: { type: String, unique: true, sparse: true, index: true },
    isImmutable: { type: Boolean, default: true },

    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("FinanceLog", FinanceLogSchema);
