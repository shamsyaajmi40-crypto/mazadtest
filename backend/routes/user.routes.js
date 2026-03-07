import express from "express";
import { protect } from "../middleware/auth.js";
import { getUserProfile, getMe, updateProfile } from "../controllers/user.controller.js";
import { getMyFinancialLogs } from "../controllers/balance.controller.js";
const router = express.Router();
router.get("/me", protect, getMe);
router.put("/me/profile", protect, updateProfile);
router.get("/me/financial-logs", protect, getMyFinancialLogs);
// ملف المستخدم
router.get("/:id/profile", protect, getUserProfile);

export default router;
