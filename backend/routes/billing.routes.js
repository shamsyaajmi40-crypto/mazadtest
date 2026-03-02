import express from "express";
import { protect } from "../middleware/auth.js";
import { getPlans, getMySubscription, choosePlan } from "../controllers/billing.controller.js";
import upload from "../middleware/upload.js";
import { createUpgradeRequest } from "../controllers/subscriptionRequest.controller.js";

const router = express.Router();

router.get("/plans", getPlans);
router.get("/me", protect, getMySubscription);
router.post("/choose-plan", protect, choosePlan);
router.post("/upgrade-request", protect, upload.single("receipt"), createUpgradeRequest);

export default router;
