import mongoose from "mongoose";

const deliveryOrderSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.Types.ObjectId, ref: "Auction", required: true, unique: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "CourierCompany", required: true },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
      set: (v) => Math.floor(Number(v || 0)),
      validate: {
        validator: (v) => Number.isInteger(Number(v)),
        message: "deliveryFee must be an integer IQD value",
      },
    },

    agentUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // courier_agent
    staffUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // courier_staff (آخر موظف عدّل)

    status: {
      type: String,
      enum: [
        "READY_FOR_PICKUP",
        "PICKED_UP",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "DELIVERY_FAILED",
        "COD_PAID_TO_SELLER",
        "COMPLETED",
      ],
      default: "READY_FOR_PICKUP",
    },

    failureReason: {
      type: String,
      enum: [
        "BUYER_NO_SHOW",
        "BUYER_REFUSED",
        "BUYER_DID_NOT_RECEIVE",
        "BUYER_UNREACHABLE",
        "WRONG_ADDRESS",
        "SELLER_NO_SHOW",
        "SELLER_NOT_READY",
        "COURIER_ISSUE",
      ],
      default: null,
    },

    trackingCode: { type: String, default: "" },
    receiptId: { type: String, default: null },

    pickedUpAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    codPaidAt: { type: Date, default: null },

    logs: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: { type: String, default: "" },
        reason: { type: String, default: null },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("DeliveryOrder", deliveryOrderSchema);
