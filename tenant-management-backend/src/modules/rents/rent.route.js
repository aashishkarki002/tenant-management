/**
 * rent.route.js
 *
 * Changes in this revision:
 *   - Added POST /record-payment/:rentId → recordRentPaymentController.
 *     This route existed in the controller but was never registered here,
 *     so the frontend's pay-rent-and-cam flow had no backend endpoint.
 *   - Added multer middleware for TDS document upload support.
 */

import { Router } from "express";
import multer from "multer";
import {
  processMonthlyRents,
  getRentsController,
  getRentByIdController,
  getRentsByTenantController,
  updateRentController,
  sendEmailToTenantsController,
  recordRentPaymentController,
  markTdsPaidController,
  uploadTdsDocumentController,
  backfillTenantRentsController,
} from "./rent.controller.js";
import { protect } from "../../middleware/protect.js";
import { validateTdsDocumentMiddleware } from "../../utils/fileValidation.js";

const router = Router();
const upload = multer({ dest: "temp/" });

// ── Cron / admin triggers ─────────────────────────────────────────────────────
router.post("/process-monthly-rents", protect, processMonthlyRents);
router.post("/send-email-to-tenants", protect, sendEmailToTenantsController);
router.post("/backfill-tenant-rents", protect, backfillTenantRentsController);

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
// Support optional TDS document upload via multipart/form-data
router.post(
  "/record-payment/:rentId",
  protect,
  upload.single("tdsDocument"),
  validateTdsDocumentMiddleware,
  recordRentPaymentController,
);

// ── TDS Management ────────────────────────────────────────────────────────────
// Support TDS document upload for marking TDS as paid separately
router.patch(
  "/:rentId/tds/mark-paid",
  protect,
  upload.single("tdsDocument"),
  validateTdsDocumentMiddleware,
  markTdsPaidController,
);
router.post(
  "/:rentId/tds/upload-document",
  protect,
  upload.single("tdsDocument"),
  validateTdsDocumentMiddleware,
  uploadTdsDocumentController,
);

export default router;
