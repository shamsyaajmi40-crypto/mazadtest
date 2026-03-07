import express from "express";
import { protect } from "../middleware/auth.js";
import { getUserProfile, getMe, updateProfile, toggleFavorite, getFavorites, changePassword, submitVerification } from "../controllers/user.controller.js";
import { auctionImageUpload } from "../middleware/upload.js";
import { getMyFinancialLogs } from "../controllers/balance.controller.js";
const router = express.Router();
router.get("/me", protect, getMe);
router.put("/me/profile", protect, updateProfile);
router.put("/me/password", protect, changePassword);
router.post("/me/favorites", protect, toggleFavorite);
router.get("/me/favorites", protect, getFavorites);
router.get("/me/financial-logs", protect, getMyFinancialLogs);
router.post("/me/verify", protect, auctionImageUpload.array("images", 3), submitVerification);
// ملف المستخدم
router.get("/:id/profile", protect, getUserProfile);

export default router;
