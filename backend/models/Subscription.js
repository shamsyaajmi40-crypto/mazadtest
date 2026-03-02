import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },

    status: { type: String, enum: ["active", "due", "overdue", "suspended"], default: "active" },

    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },

    auctionsUsedThisPeriod: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", SubscriptionSchema);
