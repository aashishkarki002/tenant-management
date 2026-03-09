import {
  getAccountingSummary,
  getMonthlyChartData,
  getRevenueBreakdownSummary,
  getExpenseBreakdownSummary,
} from "./accounting.service.js";

// ─── Shared query extractor ────────────────────────────────────────────────────
function extractFilters(query) {
  const { quarter, startDate, endDate, fiscalYear } = query;
  return {
    quarter: quarter ? Number(quarter) : null,
    startDate: startDate || null,
    endDate: endDate || null,
    fiscalYear: fiscalYear ? Number(fiscalYear) : null,
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getAccountingSummaryController(req, res) {
  try {
    const { quarter, startDate, endDate } = extractFilters(req.query);
    const data = await getAccountingSummary({ quarter, startDate, endDate });
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
    const { quarter, fiscalYear } = extractFilters(req.query);
    const data = await getMonthlyChartData({ quarter, fiscalYear });
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
    const { quarter, startDate, endDate, fiscalYear } = extractFilters(
      req.query,
    );
    const data = await getRevenueBreakdownSummary({
      quarter,
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
    const { quarter, startDate, endDate, fiscalYear } = extractFilters(
      req.query,
    );
    const data = await getExpenseBreakdownSummary({
      quarter,
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
