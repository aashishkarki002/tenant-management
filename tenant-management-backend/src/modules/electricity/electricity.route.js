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
import upload from "../../middleware/upload.js";
import { protect } from "../../middleware/protect.js";
const router = Router();

// Create new electricity reading
router.post("/create-reading", protect, createElectricityReading);

// Get all electricity readings with filters
router.get("/get-readings", getElectricityReadings);

// Get specific electricity reading
router.get("/get-reading/:id", getElectricityReadingById);

// Record electricity payment (with optional receipt image)
router.post(
  "/record-payment",
  protect,
  upload.single("receiptImage"),
  recordElectricityPayment,
);

// Get unit consumption history (shows all readings for a unit, including tenant transitions)
router.get("/unit-history/:unitId", getUnitConsumptionHistory);

// Get tenant electricity summary
router.get("/tenant-summary/:tenantId", getTenantElectricitySummary);

// Update electricity reading
router.put("/update-reading/:id", updateElectricityReading);

// Delete (cancel) electricity reading
router.delete("/delete-reading/:id", deleteElectricityReading);

export default router;
