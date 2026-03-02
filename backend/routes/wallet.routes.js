import express from "express";
import { protect } from "../middleware/auth.js";
import { createRefundRequest } from "../controllers/balance.controller.js";

const router = express.Router();

router.post("/refund-request", protect, createRefundRequest);

export default router;
