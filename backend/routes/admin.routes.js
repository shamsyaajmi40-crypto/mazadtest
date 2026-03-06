import express from "express";
import { protect } from "../middleware/auth.js";
import requireRole from "../middleware/roles.js";
import * as adminController from "../controllers/admin.controller.js";
import {
  getCompletedAuctions,
  deleteAuction,
} from "../controllers/auction.controller.js";
import * as subReq from "../controllers/subscriptionRequest.controller.js";
import {
  adminListRefundRequests,
  adminApproveRefundRequest,
  adminRejectRefundRequest,
  adminRefundLogs,
} from "../controllers/balance.controller.js";
import { getAdminAuctionArchive } from "../controllers/adminAuctionArchive.controller.js";
import * as adminFinancials from "../controllers/adminFinancials.controller.js";

const router = express.Router();
router.get(
  "/auctions/archive",
  protect,
  requireRole("admin", "superAdmin"),
  getAdminAuctionArchive
);

router.get(
  "/subscription-requests",
  protect,
  requireRole("admin", "superAdmin"),
  subReq.listRequests
);

router.post(
  "/subscription-requests/:id/approve",
  protect,
  requireRole("admin", "superAdmin"),
  subReq.approveRequest
);

router.post(
  "/subscription-requests/:id/reject",
  protect,
  requireRole("admin", "superAdmin"),
  subReq.rejectRequest
);

router.get(
  "/auctions/pending",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getPendingAuctions
);

router.get(
  "/counters",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getAdminCounters
);

router.patch(
  "/auctions/:id/approve",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.approveAuction
);

router.patch(
  "/auctions/:id/reject",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.rejectAuction
);

router.patch(
  "/auctions/:id/undo-reject",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.undoRejectAuction
);

router.get(
  "/stats",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getStats
);

router.get(
  "/archive",
  protect,
  requireRole("admin", "superAdmin"),
  getCompletedAuctions
);

router.delete(
  "/:id",
  protect,
  requireRole("superAdmin"),
  deleteAuction
);

router.get(
  "/auctions/export",
  protect,
  requireRole("superAdmin"),
  adminController.exportAuctionsToExcel
);

router.get(
  "/dashboard",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getAdminDashboardStats
);
router.get(
  "/stats/monthly-completed",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getMonthlyCompletedAuctions
);
router.get(
  "/users",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getAdminUsers
);

router.patch(
  "/users/:id/ban",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.toggleUserBan
);

router.patch(
  "/users/:id/role",
  protect,
  requireRole("superAdmin"),
  adminController.toggleUserAdminRole
);
router.get(
  "/users/:id",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getAdminUserDetails
);

router.delete(
  "/users/:id",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.adminDeleteUser
);

router.get(
  "/platform/balance",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getPlatformBalance
);

router.get(
  "/refund-requests",
  protect,
  requireRole("admin", "superAdmin"),
  adminListRefundRequests
);

router.post(
  "/refund-requests/:id/approve",
  protect,
  requireRole("admin", "superAdmin"),
  adminApproveRefundRequest
);

router.post(
  "/refund-requests/:id/reject",
  protect,
  requireRole("admin", "superAdmin"),
  adminRejectRefundRequest
);

router.get(
  "/refund-logs",
  protect,
  requireRole("admin", "superAdmin"),
  adminRefundLogs
);

// platform balance sources (audit log)
router.get(
  "/platform/balance/sources",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getPlatformBalanceSources
);

router.get(
  "/deposit-policy",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getDepositPolicySettings
);

router.patch(
  "/deposit-policy",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.updateDepositPolicySettings
);

// ===========================
// Courier Companies (Admin)
// ===========================
router.get(
  "/courier-companies",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.adminListCourierCompanies
);

router.post(
  "/courier-companies",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.adminCreateCourierCompany
);

router.patch(
  "/courier-companies/:id",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.adminUpdateCourierCompany
);

// ===========================
// Courier Staff (Admin)
// ===========================
router.get(
  "/courier-staff",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.adminListCourierStaff
);

router.post(
  "/courier-staff/assign",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.adminAssignCourierStaffToCompany
);
router.get(
  "/courier-companies/:id/staff",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.adminListCompanyCourierStaff
);
router.post(
  "/courier-companies/:companyId/staff",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.adminCreateCourierStaffForCompany
);

router.delete(
  "/courier-companies/:companyId/staff/:staffId",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.adminDeleteCourierStaff
);

// ===========================
// نظام النزاعات (Admin)
// ===========================
router.get(
  "/disputes",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.getDisputedAuctions
);

router.post(
  "/disputes/:id/resolve",
  protect,
  requireRole("admin", "superAdmin"),
  adminController.resolveDispute
);

// ===========================
// Financial Reports
// ===========================
router.get(
  "/financials/stats",
  protect,
  requireRole("admin", "superAdmin"),
  adminFinancials.getFinancialStats
);

router.get(
  "/financials/logs",
  protect,
  requireRole("admin", "superAdmin"),
  adminFinancials.getFinancialLogs
);

router.get(
  "/financials/export",
  protect,
  requireRole("superAdmin"),
  adminFinancials.exportFinancialsExcel
);

router.delete(
  "/financials/logs/:id",
  protect,
  requireRole("superAdmin"),
  adminFinancials.deleteFinancialLog
);

// ===========================
// Featured Auction Payments
// ===========================
router.get(
  "/financials/featured-payments",
  protect,
  requireRole("admin", "superAdmin"),
  adminFinancials.getFeaturedPayments
);

export default router;
