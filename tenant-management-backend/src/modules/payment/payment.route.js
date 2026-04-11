import { Router } from "express";
import multer from "multer";
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
  getTenantArrears,
  payArrears,
} from "./payment.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import { validateTdsDocumentMiddleware } from "../../utils/fileValidation.js";

const router = Router();
const upload = multer({ dest: "temp/" });

// ── Write — admin / super_admin only ─────────────────────────────────────────
router.post(
  "/pay-rent-and-cam",
  protect,
  authorize("admin", "super_admin"),
  upload.single("tdsDocument"),
  validateTdsDocumentMiddleware,
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

router.get(
  "/tenant-arrears/:tenantId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getTenantArrears,
);

router.post(
  "/pay-arrears",
  protect,
  authorize("admin", "super_admin"),
  payArrears,
);

export default router;
