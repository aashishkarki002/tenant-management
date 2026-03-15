/**
 * rent.route.js
 *
 * Changes in this revision:
 *   - Added POST /record-payment/:rentId → recordRentPaymentController.
 *     This route existed in the controller but was never registered here,
 *     so the frontend's pay-rent-and-cam flow had no backend endpoint.
 */

import { Router } from "express";
import {
  processMonthlyRents,
  getRentsController,
  getRentByIdController,
  getRentsByTenantController,
  updateRentController,
  sendEmailToTenantsController,
  recordRentPaymentController,
} from "./rent.controller.js";
import { protect } from "../../middleware/protect.js";

const router = Router();

// ── Cron / admin triggers ─────────────────────────────────────────────────────
router.post("/process-monthly-rents", protect, processMonthlyRents);
router.post("/send-email-to-tenants", protect, sendEmailToTenantsController);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get("/get-rents", protect, getRentsController);
router.get("/get-rent/:rentId", protect, getRentByIdController);
router.patch("/update-rent/:rentId", protect, updateRentController);
router.get(
  "/get-rents-by-tenant/:tenantId",
  protect,
  getRentsByTenantController,
);

// ── Payment recording ─────────────────────────────────────────────────────────
// FIX: this controller was implemented but the route was never registered.
router.post("/record-payment/:rentId", protect, recordRentPaymentController);

export default router;
