import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import {
  createMaintenanceController,
  getAllMaintenanceController,
  getMaintenanceByIdController,
  updateMaintenanceStatusController,
} from "./maintenance.controller.js";

const router = Router();

// Create a new maintenance task
router.post("/create", protect, createMaintenanceController);

// Get all maintenance tasks
router.get("/all", protect, getAllMaintenanceController);

// Get a single maintenance task by id
router.get("/:id", protect, getMaintenanceByIdController);

// Update maintenance status (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)
router.patch("/:id/status", protect, updateMaintenanceStatusController);

export default router;
