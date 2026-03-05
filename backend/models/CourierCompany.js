import mongoose from "mongoose";

const courierCompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    phone: { type: String, default: "" },
    deliveryFee: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },

    // التغطية الجغرافية: من أي محافظة يمكنها الشحن إلى أين
    coverage: [
      {
        from: { type: String, required: true },
        to: [{ type: String, required: true }],
      }
    ],

    // الفروع المادية لاستلام البضائع من البائعين
    branches: [
      {
        governorate: { type: String, required: true },
        name: { type: String, required: true },
        address: { type: String, required: true },
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("CourierCompany", courierCompanySchema);
