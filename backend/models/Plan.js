import mongoose from "mongoose";

const PlanSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true }, // USER_FREE, TRADER_PRO...
    audience: { type: String, enum: ["user", "trader"], required: true },
    name: { type: String, required: true },
    priceIQD: { type: Number, default: 0 }, // شهري
    monthlyAuctionLimit: { type: Number, default: 0 }, // 0 = لا يسمح أو حسب isUnlimited
    isUnlimited: { type: Boolean, default: false },
    fairUseMonthlyLimit: { type: Number, default: 0 }, // فقط إذا unlimited
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Plan", PlanSchema);
