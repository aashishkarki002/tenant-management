/**
 * payment.route.js  (FIXED)
 *
 * FIX — Added authorize() to every route.
 *   Old routes only had protect (authentication check).
 *   Any authenticated user (including staff) could record payments,
 *   trigger dashboard stats, and log activities.
 *
 * Role assignments:
 *   admin / super_admin — full access including recording payments
 *   staff               — read-only (history, stats, receipt, activities)
 *
 * Also: payRentAndCam now requires bankAccountCode in the request body.
 * The controller threads it through to createPayment() → journal builders.
 */

import { Router } from "express";
import {
  payRentAndCam,
  getRentSummary,
  sendReceiptEmail,
  getDashboardStats,
  getAllPaymentHistory,
  getPaymentHistoryByTenant,
  getPaymentByRentId,
  getFilteredPaymentHistory,
  getPaymentById,
  logActivity,
  getActivities,
} from "./payment.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

// ── Write — admin / super_admin only ─────────────────────────────────────────
router.post(
  "/pay-rent-and-cam",
  protect,
  authorize("admin", "super_admin"),
  payRentAndCam,
);

// ── Read — all authenticated roles ───────────────────────────────────────────
router.get(
  "/get-rent-summary",
  protect,
  authorize("admin", "super_admin", "staff"),
  getRentSummary,
);

router.get(
  "/dashboard-stats",
  protect,
  authorize("admin", "super_admin", "staff"),
  getDashboardStats,
);

router.get(
  "/get-all-payment-history",
  protect,
  authorize("admin", "super_admin", "staff"),
  getAllPaymentHistory,
);

router.get(
  "/get-payment-history-by-tenant/:tenantId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getPaymentHistoryByTenant,
);

router.get(
  "/get-filtered-payment-history",
  protect,
  authorize("admin", "super_admin", "staff"),
  getFilteredPaymentHistory,
);

router.get(
  "/get-payment-by-id/:paymentId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getPaymentById,
);

router.get(
  "/get-payment-by-rent-id/:rentId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getPaymentByRentId,
);

// ── Receipt — staff can trigger resend ───────────────────────────────────────
router.post(
  "/send-receipt/:paymentId",
  protect,
  authorize("admin", "super_admin", "staff"),
  sendReceiptEmail,
);

// ── Activity log ──────────────────────────────────────────────────────────────
router.post(
  "/log-activity/:paymentId",
  protect,
  authorize("admin", "super_admin"),
  logActivity,
);

router.get(
  "/get-activities/:paymentId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getActivities,
);

export default router;
