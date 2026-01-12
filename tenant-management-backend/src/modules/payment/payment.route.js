import { Router } from "express";
import {
  payRent,
  getRentSummary,
  sendReceiptEmail,
  getDashboardStats,
  getAllPaymentHistory,
  getPaymentHistoryByTenant,
} from "./payment.controller.js";
import { protect } from "../../middleware/protect.js";
const router = Router();

router.post("/pay-rent", payRent);
router.get("/get-rent-summary", getRentSummary);
router.get("/dashboard-stats", protect, getDashboardStats);
router.post("/send-receipt/:paymentId", protect, sendReceiptEmail);
router.get("/get-all-payment-history", protect, getAllPaymentHistory);
router.get(
  "/get-payment-history-by-tenant/:tenantId",
  protect,
  getPaymentHistoryByTenant
);
export default router;
