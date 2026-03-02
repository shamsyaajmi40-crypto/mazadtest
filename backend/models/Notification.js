import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "WIN",
        "LOSE",
        "CONFIRM_SUCCESS",
        "PENALTY",
        "SYSTEM",

      ],
      required: true,
    },
    title: String,
    message: String,
    event: String,
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
