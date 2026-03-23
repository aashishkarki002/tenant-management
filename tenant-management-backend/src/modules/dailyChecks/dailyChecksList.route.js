/**
 * dailyChecksList.route.js  (v2 — Template + Result split)
 *
 * Route map:
 *
 *   Templates (admin setup):
 *     GET    /api/checklists/templates              → list templates
 *     POST   /api/checklists/templates              → create template
 *     GET    /api/checklists/templates/:id          → get template (full sections)
 *     POST   /api/checklists/templates/:id/rebuild  → regenerate sections from factory
 *
 *   Results (daily operational):
 *     GET    /api/checklists/results                → list results (paginated)
 *     POST   /api/checklists/results                → create result for a template+date
 *     GET    /api/checklists/summary                → aggregated health summary
 *     GET    /api/checklists/results/:id            → full merged view
 *     PATCH  /api/checklists/results/:id/submit     → submit outcome delta
 *     DELETE /api/checklists/results/:id            → delete (admin only)
 */

import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

import {
  createTemplateController,
  rebuildTemplateController,
  getTemplatesController,
  getTemplateByIdController,
  createResultController,
  submitResultController,
  getResultsController,
  getResultByIdController,
  getResultSummaryController,
  deleteResultController,
} from "./dailyChecksList.controller.js";

const router = Router();

// ── All routes require authentication ─────────────────────────────────────────
router.use(protect);

// ── Template routes ───────────────────────────────────────────────────────────
// Named routes before /:id wildcard

router.get("/templates", getTemplatesController);
router.post(
  "/templates",
  authorize("admin", "super_admin"),
  createTemplateController,
);
router.get("/templates/:id", getTemplateByIdController);
router.post(
  "/templates/:id/rebuild",
  authorize("admin", "super_admin"),
  rebuildTemplateController,
);

// ── Result routes ─────────────────────────────────────────────────────────────

// Summary must be before /results/:id to avoid being caught by the wildcard
router.get("/summary", getResultSummaryController);

router.get("/results", getResultsController);
router.post("/results", createResultController);

router.get("/results/:id", getResultByIdController);
router.patch("/results/:id/submit", submitResultController);
router.delete(
  "/results/:id",
  authorize("admin", "super_admin"),
  deleteResultController,
);

export default router;
