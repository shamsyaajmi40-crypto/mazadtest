import mongoose from "mongoose";

const PaymentTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    kind: { type: String, enum: ["wallet_topup"], default: "wallet_topup" },

    amountIQD: { type: Number, required: true },

    orderId: { type: String, required: true, unique: true },
    provider: { type: String, enum: ["zaincash"], default: "zaincash" },
    transactionId: { type: String, default: null },

    status: { type: String, enum: ["initiated", "paid", "failed"], default: "initiated" },
    receiptId: { type: String, unique: true, sparse: true, index: true },

    rawInitResponse: { type: Object, default: null },
    rawStatusResponse: { type: Object, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PaymentTransaction", PaymentTransactionSchema);
