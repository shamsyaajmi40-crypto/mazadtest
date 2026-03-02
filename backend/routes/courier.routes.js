import express from "express";
import { protect } from "../middleware/auth.js"; // عدّل حسب اسم ملفك
import { requireRole } from "../middleware/requireRole.js";
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
  listMyAgents,
  createAgentForMyCompany,
  toggleAgentActive,
  listMyCompanyOrders
} from "../controllers/courier.controller.js";

const router = express.Router();

// courier_staff
router.post("/orders/:auctionId/create", protect, createDeliveryOrder);


router.post(
  "/orders/:orderId/picked-up",
  protect,
  requireRole("courier_staff"),
  markPickedUp
);

router.post("/orders/:orderId/failed", protect, requireRole("courier_staff", "courier_agent"), markFailed);
router.post("/orders/:orderId/failed/revert", protect, requireRole("courier_staff", "courier_agent"), revertFailedDecision);
router.post("/orders/:orderId/cod-paid", protect, requireRole("courier_staff"), markCodPaidToSeller);
router.get("/company/:companyId/orders", protect, requireRole("courier_staff"), listCompanyOrders);


// courier_agent
router.get("/agent/orders", protect, requireRole("courier_agent"), listAgentOrders);
router.post("/orders/:orderId/delivered", protect, requireRole("courier_agent", "courier_staff"), markDeliveredByOtp);
router.get(
  "/companies",
  protect,
  requireRole("courier_staff", "admin", "superAdmin", "user")
  , listCourierCompanies
);
// موظف الشركة: يدير المندوبين
router.get("/staff/agents", protect, requireRole("courier_staff"), listMyAgents);
router.post("/staff/agents", protect, requireRole("courier_staff"), createAgentForMyCompany);
router.patch("/staff/agents/:agentId/toggle", protect, requireRole("courier_staff"), toggleAgentActive);

// تعيين مندوب للطلب (ضمن نفس الشركة)
router.post("/orders/:orderId/assign-agent", protect, requireRole("courier_staff"), assignAgent);
router.get(
  "/staff/orders",
  protect,
  requireRole("courier_staff"),
  listMyCompanyOrders
);
export default router;
