import express from "express";
import { protect } from "../middleware/auth.js";
import { getUserProfile } from "../controllers/user.controller.js";
import { getMe } from "../controllers/user.controller.js";
const router = express.Router();
router.get("/me", protect, getMe);
// ملف المستخدم
router.get("/:id/profile", protect, getUserProfile);

export default router;
