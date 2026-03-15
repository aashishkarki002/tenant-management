// ─── ADD THIS ROUTE to maintenance.route.js ──────────────────────────────────
//
// IMPORTANT: place this BEFORE the /:id wildcard route, otherwise Express
// will treat "my-tasks" as an ObjectId and 500 with a CastError.
//
//   router.get("/my-tasks", protect, getMyMaintenanceTasksController);
//
// The full router with the new route in the correct position:

import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import {
  createMaintenanceController,
  getAllMaintenanceController,
  getMaintenanceByIdController,
  updateMaintenanceStatusController,
  updateMaintenanceAssignedToController,
  getMaintenanceByTenantIdController,
  getMyMaintenanceTasksController, // ← new
} from "./maintenance.controller.js";

const router = Router();

// Create a new maintenance task
router.post("/create", protect, createMaintenanceController);

// Get all maintenance tasks (admin)
router.get("/all", protect, getAllMaintenanceController);

// ── NEW: staff-scoped — returns only tasks assigned to the authenticated user ──
// Must be declared before /:id so Express doesn't parse "my-tasks" as an ObjectId
router.get("/my-tasks", protect, getMyMaintenanceTasksController);

// Tenant-specific maintenance
router.get("/get-maintenance/:id", protect, getMaintenanceByTenantIdController);

// Single task by id — keep LAST among GET routes to avoid swallowing named paths
router.get("/:id", protect, getMaintenanceByIdController);

// Mutations
router.patch("/:id/status", protect, updateMaintenanceStatusController);
router.patch("/:id/assign", protect, updateMaintenanceAssignedToController);

export default router;
