import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minlength: 3,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
  accountType: { type: String, enum: ["user", "trader"], default: "user" },
    balance: {
  type: Number,
  default: 0,
},
heldBalance: {
  type: Number,
  default: 0,
},
penaltyCount: {
  type: Number,
  default: 0,
},
isBanned: {
  type: Boolean,
  default: false,
},
banUntil: {
  type: Date,
},
    governorate: {
      type: String,
    },
    address: {
      type: String,
    },
   role: {
  type: String,
  enum: ["user", "admin", "superAdmin", "courier_staff", "courier_agent"],
  default: "user",
},
courierCompany: { type: mongoose.Schema.Types.ObjectId, ref: "CourierCompany", default: null },
isCourierActive: { type: Boolean, default: true },

    blocked: {
      type: Boolean,
      default: false,
    },
  
    rating: {
  average: { type: Number, default: 0 },
  count: { type: Number, default: 0 },
},
isPlatform: { type: Boolean, default: false },
  },
  { timestamps: true }
  
);

export default mongoose.model("User", userSchema);
