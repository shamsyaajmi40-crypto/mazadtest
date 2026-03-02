import mongoose from "mongoose";

const PaymentTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    kind: { type: String, enum: ["subscription", "wallet_topup"], default: "subscription" },

    // subscription فقط
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },

    amountIQD: { type: Number, required: true },

    orderId: { type: String, required: true, unique: true },
    provider: { type: String, enum: ["zaincash"], default: "zaincash" },
    transactionId: { type: String, default: null },

    status: { type: String, enum: ["initiated", "paid", "failed"], default: "initiated" },

    rawInitResponse: { type: Object, default: null },
    rawStatusResponse: { type: Object, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PaymentTransaction", PaymentTransactionSchema);
