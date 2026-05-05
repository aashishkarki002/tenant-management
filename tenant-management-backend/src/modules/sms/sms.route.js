import { Router } from "express";
import {
  sendBroadcastSms,
  sendBulkSms,
  sendSingleSms,
  previewSmsRecipients,
  getSmsBalance,
  getSmsPlaceholders,
} from "./sms.controller.js";

const router = Router();

// Personalised SMS to each matching tenant (supports {{placeholders}})
router.post("/send-broadcast", sendBroadcastSms);

// Single NestSMS bulk-send call — identical message, no placeholders
router.post("/send-bulk", sendBulkSms);

// Send to one phone number directly
router.post("/send-single", sendSingleSms);

// Preview tenants that will receive the SMS
router.post("/preview-recipients", previewSmsRecipients);

// NestSMS wallet balance
router.get("/balance", getSmsBalance);

// Available template placeholders
router.get("/placeholders", getSmsPlaceholders);

export default router;
