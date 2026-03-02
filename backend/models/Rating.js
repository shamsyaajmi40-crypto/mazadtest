import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
    },

    fromUser: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: function () {
    return !this.auto;
  },
  default: null,
},


    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
  type: String,
  enum: ["buyer_to_seller", "seller_to_buyer"],
  required: function () {
    return !this.auto;
  },
},

    score: {
      type: Number,
      min: 1,
      max: 5,
      required: function () {
  return !this.auto;
},
    },

    reasons: {
  type: [String],
  required: function () {
    return !this.auto;
  },
  default: [],
  validate: {
    validator: function (v) {
      if (this.auto) return true;
      return v.length > 0;
    },
    message: "At least one reason is required",
  },
},
auto: {
  type: Boolean,
  default: false,
},
    comment: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

/**
 * منع التقييم المكرر:
 * نفس المستخدم لا يمكنه تقييم نفس المزاد مرتين
 */
ratingSchema.index(
  { auction: 1, toUser: 1, auto: 1 },
  { unique: true, partialFilterExpression: { auto: true } }
);


export default mongoose.model("Rating", ratingSchema);
