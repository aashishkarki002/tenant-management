import { Router } from "express";
import {
  getAccountingSummaryController,
  getMonthlyChartController,
  getRevenueBreakdownController,
  getExpenseBreakdownController,
} from "./accounting.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

const guard = [protect, authorize("admin", "super_admin", "staff")];

// Existing: dashboard KPI summary
router.get("/summary", ...guard, getAccountingSummaryController);

// New: monthly chart data — replaces N round-trips from useMonthlyChart
// Query: quarter (1-4), fiscalYear (BS year)
router.get("/monthly-chart", ...guard, getMonthlyChartController);

// New: full revenue breakdown for RevenueBreakDown page
// Query: quarter (1-4) | startDate + endDate (ISO) | fiscalYear
router.get("/revenue-summary", ...guard, getRevenueBreakdownController);

// New: full expense breakdown for ExpenseBreakDown page
// Query: quarter (1-4) | startDate + endDate (ISO) | fiscalYear
router.get("/expense-summary", ...guard, getExpenseBreakdownController);

export default router;
