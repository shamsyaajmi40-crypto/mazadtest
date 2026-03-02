import mongoose from "mongoose";

const courierCompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    phone: { type: String, default: "" },
    deliveryFee: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("CourierCompany", courierCompanySchema);
