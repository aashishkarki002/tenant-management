import { Router } from "express";
import {
  payRent,
  getRentSummary,
  sendReceiptEmail,
} from "./payment.controller.js";
import { protect } from "../../middleware/protect.js";
const router = Router();

router.post("/pay-rent", payRent);
router.get("/get-rent-summary", getRentSummary);
router.post("/send-receipt/:paymentId", protect, sendReceiptEmail);
export default router;
