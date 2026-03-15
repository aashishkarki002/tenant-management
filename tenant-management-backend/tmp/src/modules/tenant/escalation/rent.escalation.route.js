/**
 * RENT ESCALATION ROUTES
 *
 * Mount this in your main router:
 *   import escalationRoutes from "./escalation/rent.escalation.route.js";
 *   app.use("/api/escalation", escalationRoutes);
 */

import { Router } from "express";
import { protect } from "../../../middleware/protect.js";
import {
  previewEscalation,
  applyEscalation,
  enableEscalation,
  disableEscalation,
  getEscalationHistory,
  getEscalationData,
  processDueEscalations,
} from "./rent.escalation.controller.js";

const router = Router();

// ── READ ─────────────────────────────────────────────────────────────────────

// Preview what escalation would produce (dry run, no DB writes)
// GET /api/escalation/preview/:tenantId?percentage=5
router.get("/preview/:tenantId", protect, previewEscalation);

// Full escalation audit trail for a tenant
// GET /api/escalation/history/:tenantId
router.get("/history/:tenantId", protect, getEscalationHistory);

// Get escalation configuration and current status for a tenant
// GET /api/escalation/data/:tenantId
router.get("/data/:tenantId", protect, getEscalationData);

// ── CONFIGURE ─────────────────────────────────────────────────────────────────

// Enable (or reconfigure) escalation for a tenant
// POST /api/escalation/enable/:tenantId
// Body: { percentageIncrease: 5, intervalMonths: 12, appliesTo: "rent_only" }
router.post("/enable/:tenantId", protect, enableEscalation);

// Turn off escalation (history is kept)
// PATCH /api/escalation/disable/:tenantId
router.patch("/disable/:tenantId", protect, disableEscalation);

// ── APPLY ─────────────────────────────────────────────────────────────────────

// Manually apply escalation to one tenant right now
// POST /api/escalation/apply/:tenantId
// Body: { overridePercentage?: 7, note?: "Agreed in renewal talks" }
router.post("/apply/:tenantId", protect, applyEscalation);

// Process ALL tenants whose escalation date has passed (run by cron or super-admin)
// POST /api/escalation/process-due
// Body: { asOf?: "2025-01-01" }   ← optional, defaults to now
router.post("/process-due", protect, processDueEscalations);

export default router;
