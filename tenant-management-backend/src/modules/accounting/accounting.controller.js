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
 *   quarter       (1-4)          — BS fiscal quarter
 *   month         (1-12)         — single BS month
 *   fiscalYear    (BS year)      — e.g. 2081
 *   startDate     (ISO string)   — explicit range start
 *   endDate       (ISO string)   — explicit range end
 *   allYear       ("true"|"1")   — return all 12 months for fiscalYear (chart only)
 *   entityId      (string)       — OwnershipEntity _id, "private" sentinel, or omit for merged view
 *   paymentMethod (string)       — "cash", "bank_transfer", "cheque", "mobile_wallet", or omit for all methods
 *
 * entityId behaviour:
 *   omitted / null  → merged view (all entities, including legacy null entries)
 *   "private"       → private entity only (records with entityId=null + explicit private)
 *   <ObjectId str>  → specific company entity only
 *
 * Filter priority in service layer:
 *   startDate+endDate > month > quarter > all-time
 */
function extractFilters(query) {
  const { quarter, month, startDate, endDate, fiscalYear, allYear, entityId, paymentMethod } =
    query;
  return {
    quarter: quarter ? Number(quarter) : null,
    month: month ? Number(month) : null,
    startDate: startDate || null,
    endDate: endDate || null,
    fiscalYear: fiscalYear ? Number(fiscalYear) : null,
    allYear: allYear === "true" || allYear === "1",
    // Pass through as-is — service layer interprets "private" sentinel and ObjectId strings
    entityId: entityId || null,
    paymentMethod: paymentMethod || null,
  };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getAccountingSummaryController(req, res) {
  try {
    const { quarter, month, startDate, endDate, fiscalYear, entityId, paymentMethod } =
      extractFilters(req.query);
    const data = await getAccountingSummary({
      quarter,
      month,
      startDate,
      endDate,
      fiscalYear,
      entityId,
      paymentMethod,
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
    const { quarter, fiscalYear, allYear, entityId, paymentMethod } = extractFilters(
      req.query,
    );
    const data = await getMonthlyChartData({
      quarter,
      fiscalYear,
      allYear,
      entityId,
      paymentMethod,
    });
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
    const { quarter, month, startDate, endDate, fiscalYear, entityId, paymentMethod } =
      extractFilters(req.query);
    const data = await getRevenueBreakdownSummary({
      quarter,
      month,
      startDate,
      endDate,
      fiscalYear,
      entityId,
      paymentMethod,
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
    const { quarter, month, startDate, endDate, fiscalYear, entityId, paymentMethod } =
      extractFilters(req.query);
    const data = await getExpenseBreakdownSummary({
      quarter,
      month,
      startDate,
      endDate,
      fiscalYear,
      entityId,
      paymentMethod,
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[accounting] expense-summary error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch expense breakdown" });
  }
}
