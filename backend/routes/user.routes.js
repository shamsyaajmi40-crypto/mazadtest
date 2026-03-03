import express from "express";
import { protect } from "../middleware/auth.js";
import { getUserProfile, getMe } from "../controllers/user.controller.js";
import { getMyFinancialLogs } from "../controllers/balance.controller.js";
const router = express.Router();
router.get("/me", protect, getMe);
router.get("/me/financial-logs", protect, getMyFinancialLogs);
// ملف المستخدم
router.get("/:id/profile", protect, getUserProfile);

export default router;
