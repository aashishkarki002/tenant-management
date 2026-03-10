import {
  getAccountingSummary,
  getMonthlyChartData,
  getRevenueBreakdownSummary,
  getExpenseBreakdownSummary,
} from "./accounting.service.js";

// ─── Shared query extractor ────────────────────────────────────────────────────
/**
 * Extracts all supported filter params from req.query.
 *
 * Supported params:
 *   quarter    (1-4)          — BS fiscal quarter
 *   month      (1-12)         — single BS month (NEW)
 *   fiscalYear (BS year)      — e.g. 2081 (NEW, replaces/supplements nepaliYear)
 *   startDate  (ISO string)   — explicit range start
 *   endDate    (ISO string)   — explicit range end
 *   allYear    ("true"|"1")   — return all 12 months for fiscalYear (NEW, chart only)
 *
 * Filter priority in service layer:
 *   startDate+endDate > month > quarter > all-time
 */
function extractFilters(query) {
  const { quarter, month, startDate, endDate, fiscalYear, allYear } = query;
  return {
    quarter: quarter ? Number(quarter) : null,
    month: month ? Number(month) : null, // NEW
    startDate: startDate || null,
    endDate: endDate || null,
    fiscalYear: fiscalYear ? Number(fiscalYear) : null,
    allYear: allYear === "true" || allYear === "1", // NEW
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getAccountingSummaryController(req, res) {
  try {
    const { quarter, month, startDate, endDate, fiscalYear } = extractFilters(
      req.query,
    );
    const data = await getAccountingSummary({
      quarter,
      month,
      startDate,
      endDate,
      fiscalYear,
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[accounting] summary error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch accounting summary" });
  }
}

export async function getMonthlyChartController(req, res) {
  try {
    const { quarter, fiscalYear, allYear } = extractFilters(req.query);
    const data = await getMonthlyChartData({ quarter, fiscalYear, allYear });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[accounting] monthly-chart error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch monthly chart data" });
  }
}

export async function getRevenueBreakdownController(req, res) {
  try {
    const { quarter, month, startDate, endDate, fiscalYear } = extractFilters(
      req.query,
    );
    const data = await getRevenueBreakdownSummary({
      quarter,
      month,
      startDate,
      endDate,
      fiscalYear,
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[accounting] revenue-summary error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch revenue breakdown" });
  }
}

export async function getExpenseBreakdownController(req, res) {
  try {
    const { quarter, month, startDate, endDate, fiscalYear } = extractFilters(
      req.query,
    );
    const data = await getExpenseBreakdownSummary({
      quarter,
      month,
      startDate,
      endDate,
      fiscalYear,
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[accounting] expense-summary error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch expense breakdown" });
  }
}
