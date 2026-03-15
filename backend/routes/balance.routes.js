import express from "express";
import { protect } from "../middleware/auth.js";
import requireRole from "../middleware/roles.js";
import {
  createBalanceRequest,
  getAllBalanceRequests,
  approveBalanceRequest,
  rejectBalanceRequest,
  getMyBalanceRequests
} from "../controllers/balance.controller.js";

const router = express.Router();
// USER
router.get("/my-requests", protect, getMyBalanceRequests);
// USER
router.post("/request", protect, createBalanceRequest);

// ADMIN
router.get(
  "/requests",
  protect,
  requireRole("superAdmin", "admin"),
  getAllBalanceRequests
);

router.post(
  "/approve/:id",
  protect,
  requireRole("admin"),
  approveBalanceRequest
);

router.post(
  "/reject/:id",
  protect,
  requireRole("admin"),
  rejectBalanceRequest
);

export default router;
