import express from "express";
import { protect } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";
const router = express.Router();

router.get("/", protect, async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);
  const notifications = await Notification.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("auction", "title");

  res.json(notifications);
});

router.post("/:id/read", protect, async (req, res) => {
  // Guard: تحقق أن الـ ID صالح قبل الاستعلام
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid notification ID" });
  }

  await Notification.updateOne(
    { _id: req.params.id, user: req.user._id },
    { $set: { isRead: true } }
  );
  res.json({ success: true });
});

export default router;

