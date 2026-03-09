import express from "express";
import { register, login, me, logout } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/register", authLimiter, register);
//router.post("/login", authLimiter, login);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, me);

export default router;
