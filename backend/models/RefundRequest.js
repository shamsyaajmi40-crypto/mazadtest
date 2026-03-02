import mongoose from "mongoose";

const RefundRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amountIQD: { type: Number, required: true, min: 1 },
    payoutInfo: { type: String, required: true }, // رقم زين كاش/معلومات تحويل
    note: { type: String, default: "" },

    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminNote: { type: String, default: "" },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("RefundRequest", RefundRequestSchema);
