import mongoose from "mongoose";
import crypto from "crypto";

const FINANCE_LOG_TYPES = [
  "REFUND_REQUEST_CREATED",
  "REFUND_REQUEST_APPROVED",
  "REFUND_REQUEST_REJECTED",
  "WALLET_TOPUP_PAID",
  "FEATURE_AUCTION_PAYMENT",
  "DEPOSIT_HOLD",
  "DEPOSIT_REFUND",
  "DEPOSIT_CONFISCATE",
  "PLATFORM_COMMISSION",
  "COD_SELLER_PAYOUT",
  "COD_DELIVERY_FEE",
  "PLATFORM_TRANSFER",
  "LEDGER_REVERSAL",
];

const toIntegerOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : null;
};

const FinanceLogSchema = new mongoose.Schema(
  {
    operationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => crypto.randomUUID(),
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      alias: "userId",
    },
    type: {
      type: String,
      enum: FINANCE_LOG_TYPES,
      required: true,
      index: true,
    },
    amountIQD: {
      type: Number,
      required: true,
      default: 0,
      alias: "amount",
      set: (v) => Number(v),
    },
    balanceBefore: {
      type: Number,
      required: true,
      default: 0,
      set: (v) => Number(v),
    },
    balanceAfter: {
      type: Number,
      required: true,
      default: 0,
      set: (v) => Number(v),
    },
    heldBefore: {
      type: Number,
      default: null,
      set: (v) => toIntegerOrNull(v),
    },
    heldAfter: {
      type: Number,
      default: null,
      set: (v) => toIntegerOrNull(v),
    },
    refModel: { type: String, default: "" },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null, alias: "referenceId" },
    receiptId: { type: String, unique: true, sparse: true, index: true },
    isImmutable: { type: Boolean, default: true, immutable: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {}, alias: "metadata" },
  },
  { timestamps: true, minimize: false }
);

FinanceLogSchema.pre("validate", function validateIntegers(next) {
  const numericFields = ["amountIQD", "balanceBefore", "balanceAfter", "heldBefore", "heldAfter"];
  for (const field of numericFields) {
    if (this[field] === null || this[field] === undefined) continue;
    if (!Number.isInteger(Number(this[field]))) {
      return next(new Error(`FinanceLog.${field} must be an integer IQD value`));
    }
  }
  if (!this.operationId) this.operationId = crypto.randomUUID();
  return next();
});

const immutableError = () => new Error("FinanceLog is immutable and cannot be modified or deleted.");
const immutableHooks = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findByIdAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
  "findByIdAndDelete",
];
immutableHooks.forEach((hook) => {
  FinanceLogSchema.pre(hook, function preventMutation(next) {
    return next(immutableError());
  });
});

export { FINANCE_LOG_TYPES };
export default mongoose.model("FinanceLog", FinanceLogSchema);
