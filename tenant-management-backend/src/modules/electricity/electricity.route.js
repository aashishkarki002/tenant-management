/**
 * electricity.route.js — updated
 *
 * Sub-meter routes added under /api/electricity/sub-meters/*
 */

import { Router } from "express";
import {
  createElectricityReading,
  getElectricityReadings,
  getElectricityReadingById,
  recordElectricityPayment,
  getUnitConsumptionHistory,
  getTenantElectricitySummary,
  updateElectricityReading,
  deleteElectricityReading,
} from "./electricity.controller.js";
import {
  getElectricityRate,
  setElectricityRate,
} from "./electricity.rate.controller.js";
import {
  createSubMeter,
  getSubMeters,
  updateSubMeter,
} from "./subMeter.controller.js";
import upload from "../../middleware/upload.js";
import { protect } from "../../middleware/protect.js";

const router = Router();

// ── Rate config (owner only) ──────────────────────────────────────────────────
router.get("/rate/:propertyId", protect, getElectricityRate);
router.post("/rate/:propertyId", protect, setElectricityRate);

// ── Sub-Meters ────────────────────────────────────────────────────────────────
// NOTE: specific paths before parameterised ones to avoid route collisions
router.post("/sub-meters/create", protect, createSubMeter);

router.put("/sub-meters/update/:subMeterId", protect, updateSubMeter);

// GET /api/electricity/sub-meters?propertyId=... (query param; controller validates)
router.get("/sub-meters", getSubMeters);

// ── Unit Readings ─────────────────────────────────────────────────────────────
router.post("/create-reading", protect, createElectricityReading);
router.get("/get-readings", getElectricityReadings);
router.get("/get-reading/:id", getElectricityReadingById);
router.put("/update-reading/:id", updateElectricityReading);
router.delete("/delete-reading/:id", deleteElectricityReading);

// ── Payments ──────────────────────────────────────────────────────────────────
router.post(
  "/record-payment",
  protect,
  upload.single("receiptImage"),
  recordElectricityPayment,
);

// ── History / summaries ───────────────────────────────────────────────────────
router.get("/unit-history/:unitId", getUnitConsumptionHistory);
router.get("/tenant-summary/:tenantId", getTenantElectricitySummary);

export default router;
