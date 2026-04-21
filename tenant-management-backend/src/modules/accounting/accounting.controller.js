import {
  getAccountingSummary,
  getMonthlyChartData,
  getRevenueBreakdownSummary,
  getExpenseBreakdownSummary,
  getPortfolioHealth,
} from "./accounting.service.js";
import { OwnershipEntity } from "../ownership/OwnershipEntity.Model.js";
import { SystemConfig } from "../systemConfig/SystemConfig.Model.js";

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

export async function getPortfolioHealthController(req, res) {
  try {
    const { quarter, month, startDate, endDate, fiscalYear, entityId } =
      extractFilters(req.query);
    const data = await getPortfolioHealth({
      quarter,
      month,
      startDate,
      endDate,
      fiscalYear,
      entityId,
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[accounting] portfolio-health error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch portfolio health" });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSOLIDATED VIEW
// Returns per-entity P&L + combined totals. Only available when systemMode
// is 'merged' or 'company'.
// ─────────────────────────────────────────────────────────────────────────────

export async function getConsolidatedController(req, res) {
  try {
    const config = await SystemConfig.findOne({ key: "ownershipConfig" }).lean();
    if (!config || config.systemMode === "private") {
      return res
        .status(403)
        .json({ success: false, message: "Consolidated view requires merged or company mode" });
    }

    const { quarter, month, startDate, endDate, fiscalYear, paymentMethod } =
      extractFilters(req.query);

    const sharedFilters = { quarter, month, startDate, endDate, fiscalYear, paymentMethod };

    // Fetch all active entities (excluding head_office — it has no direct charges)
    const entities = await OwnershipEntity.find({
      isActive: true,
      type: { $ne: "head_office" },
    }).lean();

    // Run per-entity summaries in parallel
    const perEntityData = await Promise.all(
      entities.map(async (entity) => {
        const summary = await getAccountingSummary({
          ...sharedFilters,
          entityId: entity._id.toString(),
        });
        return {
          entity: {
            _id: entity._id,
            name: entity.name,
            type: entity.type,
            chartOfAccountsPrefix: entity.chartOfAccountsPrefix,
          },
          summary,
        };
      }),
    );

    // Also include legacy null-entity entries under private
    const privateEntitySummary = await getAccountingSummary({
      ...sharedFilters,
      entityId: "private",
    });

    // Calculate combined totals across all entities
    const allSummaries = [...perEntityData.map((e) => e.summary), privateEntitySummary];
    const combined = {
      totalRevenuePaisa: allSummaries.reduce(
        (sum, s) => sum + (s.totalRevenuePaisa ?? 0),
        0,
      ),
      totalExpensePaisa: allSummaries.reduce(
        (sum, s) => sum + (s.totalExpensePaisa ?? 0),
        0,
      ),
      netProfitPaisa: 0,
    };
    combined.netProfitPaisa = combined.totalRevenuePaisa - combined.totalExpensePaisa;

    res.json({
      success: true,
      data: {
        entities: perEntityData,
        combined,
        systemMode: config.systemMode,
      },
    });
  } catch (err) {
    console.error("[accounting] consolidated error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch consolidated data" });
  }
}
