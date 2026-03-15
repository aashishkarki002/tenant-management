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

/**
 * Shared query params accepted by all routes below:
 *
 *   quarter    {1|2|3|4}    — BS fiscal quarter (3 months)
 *   month      {1-12}       — single BS month (1=Baisakh, 4=Shrawan …)   ← NEW
 *   fiscalYear {number}     — BS year, e.g. 2081                          ← NEW
 *   startDate  {ISO string} — explicit range start (overrides month/quarter)
 *   endDate    {ISO string} — explicit range end
 *
 * Filter precedence: startDate+endDate > month > quarter > all-time
 *
 * Example — Shrawan 2081 only:
 *   GET /summary?month=4&fiscalYear=2081
 *
 * Example — Q2 of FY 2081:
 *   GET /summary?quarter=2&fiscalYear=2081
 */

// Dashboard KPI summary
router.get("/summary", ...guard, getAccountingSummaryController);

/**
 * Monthly chart data.
 * Extra params:
 *   allYear {"true"|"1"} — return all 12 months of fiscalYear in fiscal order  ← NEW
 *
 * Example — full FY 2081/82 view:
 *   GET /monthly-chart?allYear=true&fiscalYear=2081
 *
 * Example — Q1 only:
 *   GET /monthly-chart?quarter=1&fiscalYear=2081
 */
router.get("/monthly-chart", ...guard, getMonthlyChartController);

// Full revenue breakdown for RevenueBreakDown page
router.get("/revenue-summary", ...guard, getRevenueBreakdownController);

// Full expense breakdown for ExpenseBreakDown page
router.get("/expense-summary", ...guard, getExpenseBreakdownController);

export default router;
