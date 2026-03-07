import mongoose from "mongoose";


// Auction Schema
const auctionSchema = new mongoose.Schema(
  {


    isDeleted: {
      type: Boolean,
      default: false,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    featuredUntil: {
      type: Date,
      default: null,
    },
    featuredPriority: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
    },
    images: [String],
    startingPrice: {
      type: Number,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    currentPrice: {
      type: Number,
      required: true,
    },
    increment: {
      type: Number,
      required: true,
      min: 1,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "upcoming", "active", "rejected", "ended", "ENDED", "completed",
        "cancelled_by_winner",
        "cancelled_by_seller",
        "rejected", "cancelled_by_both",

      ],
      default: "pending",
    },
    depositAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    sellerDeposit: {
      type: Number,
      default: 0,
    },
    auto: {
      type: Boolean,
      default: false,
    },
    penaltyApplied: {
      type: Boolean,
      default: false,
    },


    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    governorate: {
      type: String,
      required: true,
    },
    confirmationDeadline: {
      type: Date,
    },
    winnerConfirmed: {
      type: Boolean,
      default: false,
    },
    sellerConfirmed: {
      type: Boolean,
      default: false,
    },
    deliveryMode: {
      type: String,
      enum: ["manual", "courier"],
      default: "manual",
    },
    deliveryOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryOrder",
      default: null,
    },
    deliveryPenaltyReason: {
      type: String,
      default: null,
    },
    settlementStatus: {
      type: String,
      enum: ["pending", "processing", "done"],
      default: "pending"
    },
    deliveryOtpHash: { type: String, default: null }, // OTP للمشتري (hashed)
    payoutOtpHash: { type: String, default: null },   // OTP للبائع (hashed)
    deliveryOtpCode: { type: String, default: null },
    payoutOtpCode: { type: String, default: null },
    completedAt: {
      type: Date,
    },
    closingLock: { type: Boolean, default: false },
    closedAt: { type: Date, default: null },

    // نظام الاعتراض الذكي الذكي 
    isDisputed: { type: Boolean, default: false },
    disputeReason: { type: String, default: null },

    // أسباب الرفض
    rejectionReasons: [String], // قائمة الأسباب المختارة
    rejectionNote: { type: String, default: null }, // ملاحظة إضافية من الأدمن
    rejectedAt: { type: Date, default: null }, // تاريخ الرفض (للتنظيف التلقائي)
  },
  { timestamps: true }
);

// الفهارس البرمجية لتحسين الأداء (Indexes)
auctionSchema.index({ status: 1, endTime: 1 });
auctionSchema.index({ seller: 1 });
auctionSchema.index({ owner: 1 });
auctionSchema.index({ category: 1, governorate: 1 });
auctionSchema.index({ isFeatured: -1, featuredPriority: -1, createdAt: -1 }); // Index for fast sorting of featured auctions
auctionSchema.index({ createdAt: -1 });

export default mongoose.model("Auction", auctionSchema);
