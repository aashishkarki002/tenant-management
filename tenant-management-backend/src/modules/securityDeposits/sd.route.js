/**
 * sd.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin HTTP layer — validate request, call service, return response.
 * Zero business logic here.
 *
 * ROUTES (register in app.js):
 *
 *   POST  /api/sd/create                  → createSdController
 *   GET   /api/sd/get-sd/:sdId            → getSdByIdController
 *   GET   /api/sd/by-tenant/:tenantId     → getSdByTenantController
 *   GET   /api/sd/all-by-tenant/:tenantId → getAllSdsByTenantController
 *   GET   /api/sd/by-block/:blockId       → getSdsByBlockController
 *   GET   /api/sd/summary/:tenantId       → getSdSummaryController
 *
 * All write routes: admin, super_admin only.
 * All read  routes: admin, super_admin, staff.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from "express";
import {
  createSdController,
  getSdByIdController,
  getSdByTenantController,
  getAllSdsByTenantController,
  getSdsByBlockController,
  getSdSummaryController,
} from "./sd.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// ── WRITE ────────────────────────────────────────────────────────────────────
router.post(
  "/create",
  protect,
  authorize("admin", "super_admin"),
  createSdController,
);

// ── READ ─────────────────────────────────────────────────────────────────────
router.get(
  "/get-sd/:sdId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getSdByIdController,
);

router.get(
  "/by-tenant/:tenantId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getSdByTenantController,
);

router.get(
  "/all-by-tenant/:tenantId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getAllSdsByTenantController,
);

router.get(
  "/by-block/:blockId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getSdsByBlockController,
);

router.get(
  "/summary/:tenantId",
  protect,
  authorize("admin", "super_admin", "staff"),
  getSdSummaryController,
);

export default router;

// ─────────────────────────────────────────────────────────────────────────────
// app.js registration:
//
//   import sdRoutes from "./modules/securityDeposits/sd.route.js";
//   app.use("/api/sd", sdRoutes);
// ─────────────────────────────────────────────────────────────────────────────
