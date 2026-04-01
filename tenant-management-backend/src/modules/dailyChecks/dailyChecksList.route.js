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
  getCalendarSummaryController,
  getTodayResultsController,
  addSectionController,
  updateSectionController,
  removeSectionController,
  addItemController,
  updateItemController,
  removeItemController,
  reorderSectionsController,
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
router.post("/templates/:id/sections", addSectionController);
router.patch(
  "/templates/:id/sections/:sectionKey",
  updateSectionController,
);
router.delete(
  "/templates/:id/sections/:sectionKey",
  removeSectionController,
);
router.post(
  "/templates/:id/sections/:sectionKey/items",
  addItemController,
);
router.patch(
  "/templates/:id/sections/:sectionKey/items/:itemId",
  updateItemController,
);
router.delete(
  "/templates/:id/sections/:sectionKey/items/:itemId",
  removeItemController,
);
router.post(
  "/templates/:id/sections/reorder",
  reorderSectionsController,
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
// router.get("/calendar", getCalendarSummaryController);
router.get("/calendar", getCalendarSummaryController);
router.get("/today", getTodayResultsController);

export default router;
