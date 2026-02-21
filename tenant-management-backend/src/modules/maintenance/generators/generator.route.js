import { Router } from "express";
import { protect } from "../../../middleware/protect.js";
import {
  createGeneratorController,
  getAllGeneratorsController,
  getGeneratorByIdController,
  recordDailyCheckController,
  recordFuelRefillController,
  recordServiceLogController,
  updateGeneratorStatusController,
} from "./generator.controller.js";

const router = Router();

// CRUD
router.post("/create", protect, createGeneratorController);
router.get("/all", protect, getAllGeneratorsController);
router.get("/:id", protect, getGeneratorByIdController);

// Operations
router.post("/:id/daily-check", protect, recordDailyCheckController);
router.post("/:id/fuel-refill", protect, recordFuelRefillController);
router.post("/:id/service-log", protect, recordServiceLogController);
router.patch("/:id/status", protect, updateGeneratorStatusController);

export default router;
