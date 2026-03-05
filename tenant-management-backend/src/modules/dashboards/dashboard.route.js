import { Router } from "express";
import { getDashboardStats, getQuarterlyStats } from "./dashboard.service.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

// Shared middleware — applied once at router level instead of repeating per route.
// Industry pattern: "DRY middleware" — if all routes in a router require the same
// guards, register them on the router, not on individual route handlers.
router.use(protect, authorize("admin", "super_admin", "staff"));

/**
 * GET /api/dashboard/stats
 * Full dashboard payload — all KPIs, charts, activity feed.
 */
router.get("/stats", getDashboardStats);

/**
 * GET /api/dashboard/stats/quarterly
 * Lightweight quarterly breakdown — used by drill-down views and future Portfolio page.
 * Returns only quarterly + monthly revenue; no tenant/maintenance/generator data.
 */
router.get("/stats/quarterly", getQuarterlyStats);

export default router;
