import express from "express";
import { protect } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import { otpLimiter } from "../middleware/rateLimit.js";
import {
  createDeliveryOrder,
  assignAgent,
  markPickedUp,
  markDeliveredByOtp,
  markFailed,
  revertFailedDecision,
  markCodPaidToSeller,
  listCompanyOrders,
  listAgentOrders,
  listCourierCompanies,
  getAvailableCouriers,
  listMyAgents,
  createAgentForMyCompany,
  toggleAgentActive,
  listMyCompanyOrders,
} from "../controllers/courier.controller.js";

const router = express.Router();

router.post("/orders/:auctionId/create", protect, createDeliveryOrder);

router.post(
  "/orders/:orderId/picked-up",
  protect,
  requireRole("courier_staff"),
  markPickedUp
);

router.post(
  "/orders/:orderId/failed",
  protect,
  requireRole("courier_staff", "courier_agent"),
  markFailed
);

router.post(
  "/orders/:orderId/failed/revert",
  protect,
  requireRole("courier_staff", "courier_agent"),
  revertFailedDecision
);

router.post(
  "/orders/:orderId/cod-paid",
  protect,
  requireRole("courier_staff"),
  otpLimiter,
  markCodPaidToSeller
);

router.get(
  "/company/:companyId/orders",
  protect,
  requireRole("courier_staff"),
  listCompanyOrders
);

router.get("/agent/orders", protect, requireRole("courier_agent"), listAgentOrders);

router.post(
  "/orders/:orderId/delivered",
  protect,
  requireRole("courier_agent", "courier_staff"),
  otpLimiter,
  markDeliveredByOtp
);

router.get(
  "/companies",
  protect,
  requireRole("courier_staff", "admin", "superAdmin", "user"),
  listCourierCompanies
);

router.get("/companies/available", getAvailableCouriers);

router.get("/staff/agents", protect, requireRole("courier_staff"), listMyAgents);
router.post("/staff/agents", protect, requireRole("courier_staff"), createAgentForMyCompany);
router.patch("/staff/agents/:agentId/toggle", protect, requireRole("courier_staff"), toggleAgentActive);

router.post(
  "/orders/:orderId/assign-agent",
  protect,
  requireRole("courier_staff"),
  assignAgent
);

router.get(
  "/staff/orders",
  protect,
  requireRole("courier_staff"),
  listMyCompanyOrders
);

export default router;
