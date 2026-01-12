import { Router } from "express";
import {
  payRent,
  getRentSummary,
  sendReceiptEmail,
  getDashboardStats,
  getAllPaymentHistory,
  getPaymentHistoryByTenant,
} from "./payment.controller.js";
import { getFilteredPaymentHistory } from "./payment.controller.js";
import { protect } from "../../middleware/protect.js";
const router = Router();

router.post("/pay-rent", protect, payRent);
router.get("/get-rent-summary", protect, getRentSummary);
router.get("/dashboard-stats", protect, getDashboardStats);
router.post("/send-receipt/:paymentId", protect, sendReceiptEmail);
router.get("/get-all-payment-history", protect, getAllPaymentHistory);
router.get(
  "/get-payment-history-by-tenant/:tenantId",
  protect,
  getPaymentHistoryByTenant
);
router.get("/get-filtered-payment-history", protect, getFilteredPaymentHistory);
export default router;
