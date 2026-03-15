import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import {
  createChecklistController,
  submitChecklistController,
  getChecklistsController,
  getChecklistByIdController,
  getChecklistSummaryController,
  deleteChecklistController,
} from "./dailyChecksList.controller.js";

const router = Router();

// ── Named routes FIRST (before /:id wildcard) ─────────────────────────────────

// GET /api/checklists/summary?propertyId=&nepaliYear=&nepaliMonth=
router.get("/summary", protect, getChecklistSummaryController);

// GET /api/checklists?propertyId=&category=&...
router.get("/", protect, getChecklistsController);

// POST /api/checklists/create
router.post("/create", protect, createChecklistController);

// ── ID-based routes ────────────────────────────────────────────────────────────

// GET /api/checklists/:id
router.get("/:id", protect, getChecklistByIdController);

// PATCH /api/checklists/:id/submit  — fill in results + auto-create repair tasks
router.patch("/:id/submit", protect, submitChecklistController);

// DELETE /api/checklists/:id
router.delete("/:id", protect, deleteChecklistController);

export default router;
