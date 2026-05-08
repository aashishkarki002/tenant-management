import { ledgerService } from "./ledger.service.js";
import { getBalanceSummary } from "./domains/accountBalanceManger.js";
import { formatMoney } from "../../utils/moneyUtil.js";
import { rebuildAccountBalance } from "./domains/accountBalanceManger.js";
import { resolveFiscalGregorianRange } from "../../config/fiscalCalendar.js";

/**
 * Get ledger entries with various filtering options
 * Query parameters:
 * - tenantId: Filter by specific tenant
 * - startDate: Start date (English calendar) - ISO format
 * - endDate: End date (English calendar) - ISO format
 * - nepaliMonth: Nepali month name (e.g., "बैशाख")
 * - nepaliYear: Nepali year (e.g., 2081)
 * - quarter: Quarter number (1-4), Nepal fiscal quarter (with fiscalYear)
 * - month: BS month 1–12 (with fiscalYear), same as accounting summary
 * - fiscalYear: BS year (e.g. 2081)
 * - accountCode: Filter by specific account code
 * - propertyId: Filter by specific property
 */
export const getLedger = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      tenantId,
      nepaliMonth,
      nepaliYear,
      quarter,
      month,
      fiscalYear,
      accountCode,
      propertyId,
      entityId,
      type,
    } = req.query;

    // Validate type if provided
    if (type && !["all", "revenue", "expense"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type must be 'all', 'revenue', or 'expense'",
      });
    }

    // Validate quarter if provided
    if (quarter && (quarter < 1 || quarter > 4)) {
      return res.status(400).json({
        success: false,
        message: "Quarter must be between 1 and 4",
      });
    }

    // Validate nepaliYear if provided
    if (nepaliYear && (nepaliYear < 2000 || nepaliYear > 2100)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Nepali year",
      });
    }

    const ledger = await ledgerService.getLedger({
      startDate,
      endDate,
      tenantId,
      nepaliMonth,
      nepaliYear: nepaliYear ? parseInt(nepaliYear) : undefined,
      quarter: quarter ? parseInt(quarter) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      fiscalYear: fiscalYear ? parseInt(fiscalYear, 10) : undefined,
      accountCode,
      propertyId,
      type: type || "all", // Default to 'all' if not specified
      entityId,
    });

    res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    console.error("Error in getLedger controller:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get ledger summary by account
 * Provides aggregated view of debits, credits, and balances per account
 */
export const getLedgerSummary = async (req, res) => {
  try {
    const { startDate, endDate, tenantId, nepaliYear, quarter, entityId } =
      req.query;

    const summary = await ledgerService.getLedgerSummary({
      startDate,
      endDate,
      tenantId,
      nepaliYear: nepaliYear ? parseInt(nepaliYear) : undefined,
      quarter: quarter ? parseInt(quarter) : undefined,
      entityId,
    });

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("Error in getLedgerSummary controller:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get tenant-specific ledger statement
 * Shows running balance for a specific tenant
 */
export const getTenantLedger = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate, nepaliYear, quarter } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    const ledger = await ledgerService.getLedger({
      tenantId,
      startDate,
      endDate,
      nepaliYear: nepaliYear ? parseInt(nepaliYear) : undefined,
      quarter: quarter ? parseInt(quarter) : undefined,
    });

    res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    console.error("Error in getTenantLedger controller:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get account-specific ledger
 * Shows all transactions for a specific account
 */
export const getAccountLedger = async (req, res) => {
  try {
    const { accountCode } = req.params;
    const { startDate, endDate, tenantId } = req.query;

    if (!accountCode) {
      return res.status(400).json({
        success: false,
        message: "Account code is required",
      });
    }

    const ledger = await ledgerService.getLedger({
      accountCode,
      startDate,
      endDate,
      tenantId,
    });

    res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    console.error("Error in getAccountLedger controller:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * GET /ledger/trial-balance
 * Returns all accounts with their debit/credit totals and net balance.
 * A properly-posted double-entry ledger will always have totalDebit === totalCredit.
 */
export const getTrialBalance = async (req, res) => {
  try {
    const { entityId, fiscalYear, quarter, month, startDate, endDate } = req.query;

    const { resolvedStart, resolvedEnd } = resolveFiscalGregorianRange({
      fiscalYear, quarter, month, startDate, endDate,
    });

    const summary = await getBalanceSummary({
      entityId,
      nonZeroOnly: false,
      startDate: resolvedStart,
      endDate: resolvedEnd,
    });

    const { accounts, subtotals, trialBalance } = summary;

    // Flatten accounts grouped by type into a single ordered list
    const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
    const rows = [];
    for (const type of TYPE_ORDER) {
      for (const acct of (accounts[type] ?? [])) {
        rows.push(acct);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        rows,
        subtotals,
        totals: trialBalance,
        isBalanced: trialBalance.isBalanced,
        discrepancy: trialBalance.discrepancy,
      },
    });
  } catch (error) {
    console.error("Error in getTrialBalance controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a formatted balance sheet: Assets = Liabilities + Equity
 * Equity includes permanent equity accounts + Retained Earnings (Revenue − Expenses)
 */
export const getBalanceSheet = async (req, res) => {
  try {
    const { entityId, fiscalYear, quarter, month, startDate, endDate } = req.query;

    const { resolvedStart, resolvedEnd } = resolveFiscalGregorianRange({
      fiscalYear, quarter, month, startDate, endDate,
    });

    const summary = await getBalanceSummary({
      entityId,
      nonZeroOnly: false,
      startDate: resolvedStart,
      endDate: resolvedEnd,
    });
    const { accounts, subtotals, trialBalance } = summary;

    const assetAccounts     = accounts.ASSET     ?? [];
    const liabilityAccounts = accounts.LIABILITY  ?? [];
    const equityAccounts    = accounts.EQUITY     ?? [];

    const totalAssetPaisa           = subtotals.ASSET?.paisa     ?? 0;
    const totalLiabilityPaisa       = subtotals.LIABILITY?.paisa  ?? 0;
    const totalPermanentEquityPaisa = subtotals.EQUITY?.paisa    ?? 0;
    const totalRevenuePaisa         = subtotals.REVENUE?.paisa   ?? 0;
    const totalExpensePaisa         = subtotals.EXPENSE?.paisa   ?? 0;

    const retainedEarningsPaisa         = totalRevenuePaisa - totalExpensePaisa;
    const totalEquityPaisa              = totalPermanentEquityPaisa + retainedEarningsPaisa;
    const totalLiabilitiesAndEquityPaisa = totalLiabilityPaisa + totalEquityPaisa;

    const isBalanced      = totalAssetPaisa === totalLiabilitiesAndEquityPaisa;
    const discrepancyPaisa = Math.abs(totalAssetPaisa - totalLiabilitiesAndEquityPaisa);

    // Use the same formatter as the rest of the system.
    // Coerce to integer — guards against NaN if any account has no balance yet.
    const fmt = (paisa) => {
      const safe = Number.isInteger(paisa) ? paisa : 0;
      return {
        paisa: safe,
        rupees: safe / 100,
        formatted: formatMoney(safe),
      };
    };

    res.status(200).json({
      success: true,
      data: {
        asOfDate: new Date().toISOString(),
        assetAccounts,
        liabilityAccounts,
        equityAccounts,
        retainedEarnings: {
          code: "RE",
          name: "Retained Earnings (Net Income)",
          type: "EQUITY",
          balance: fmt(retainedEarningsPaisa),
          balanceSide: retainedEarningsPaisa >= 0 ? "CR" : "DR (deficit)",
          isSynthetic: true,
        },
        totalAssets:               fmt(totalAssetPaisa),
        totalLiabilities:          fmt(totalLiabilityPaisa),
        totalEquity:               fmt(totalEquityPaisa),
        totalLiabilitiesAndEquity: fmt(totalLiabilitiesAndEquityPaisa),
        isBalanced,
        discrepancy: fmt(discrepancyPaisa),
        trialBalance,
      },
    });
  } catch (error) {
    console.error("Error in getBalanceSheet controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /ledger/ar-aging
 * AR Aging Report: outstanding balances per tenant bucketed by months overdue.
 */
export const getArAging = async (req, res) => {
  try {
    const { propertyId } = req.query;
    const data = await ledgerService.getArAging({ propertyId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error in getArAging controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── New Reporting Endpoints ─────────────────────────────────────────────────

/** GET /ledger/property-pl?propertyId=&fiscalYear=&quarter=&month= */
export const getPropertyPL = async (req, res) => {
  try {
    const { propertyId, fiscalYear, quarter, month, startDate, endDate } = req.query;
    if (!propertyId) return res.status(400).json({ success: false, message: "propertyId required" });
    const { resolvedStart, resolvedEnd } = resolveFiscalGregorianRange({ fiscalYear, quarter, month, startDate, endDate });
    const data = await ledgerService.getPropertyPL(propertyId, { startDate: resolvedStart, endDate: resolvedEnd });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** GET /ledger/bank-reconciliation?entityId= */
export const getBankReconciliation = async (req, res) => {
  try {
    const { entityId } = req.query;
    if (!entityId) return res.status(400).json({ success: false, message: "entityId required" });
    const data = await ledgerService.getBankReconciliation(entityId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** GET /ledger/tds-filing?nepaliYear=&tenantId= */
export const getTdsFilingSummary = async (req, res) => {
  try {
    const { nepaliYear, tenantId } = req.query;
    if (!nepaliYear) return res.status(400).json({ success: false, message: "nepaliYear required" });
    const data = await ledgerService.getTdsFilingSummary(Number(nepaliYear), tenantId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** GET /ledger/cam-reconciliation?entityId=&nepaliYear= */
export const getCamReconciliation = async (req, res) => {
  try {
    const { entityId, nepaliYear } = req.query;
    if (!entityId || !nepaliYear) return res.status(400).json({ success: false, message: "entityId and nepaliYear required" });
    const data = await ledgerService.getCamReconciliation(Number(nepaliYear), entityId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** GET /ledger/petty-cash?entityId=&fiscalYear=&quarter=&month= */
export const getPettyCashLedger = async (req, res) => {
  try {
    const { entityId, fiscalYear, quarter, month, startDate, endDate } = req.query;
    const { resolvedStart, resolvedEnd } = resolveFiscalGregorianRange({ fiscalYear, quarter, month, startDate, endDate });
    const data = await ledgerService.getPettyCashLedger(entityId, { startDate: resolvedStart, endDate: resolvedEnd });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** GET /ledger/tenant-statement/:tenantId?fiscalYear=&quarter=&month= */
export const getTenantStatement = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { fiscalYear, quarter, month, startDate, endDate } = req.query;
    const { resolvedStart, resolvedEnd } = resolveFiscalGregorianRange({ fiscalYear, quarter, month, startDate, endDate });
    const data = await ledgerService.getTenantStatement(tenantId, { startDate: resolvedStart, endDate: resolvedEnd });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** GET /ledger/accounts?entityId=&type= */
export const listAccounts = async (req, res) => {
  try {
    const { entityId, type } = req.query;
    const data = await ledgerService.getAccounts({ entityId, type });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/** POST /ledger/accounts */
export const createAccountEntry = async (req, res) => {
  try {
    const data = await ledgerService.createAccount(req.body);
    res.status(201).json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/** PUT /ledger/accounts/:id */
export const updateAccountEntry = async (req, res) => {
  try {
    const data = await ledgerService.updateAccount(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// ─── Period Closing ───────────────────────────────────────────────────────────

/**
 * POST /ledger/close-period
 * Body: { entityId, nepaliYear, nepaliMonth, note? }
 */
export const closePeriod = async (req, res) => {
  try {
    const { entityId, nepaliYear, nepaliMonth, note } = req.body;
    const adminId = req.user?._id ?? req.user?.id;

    if (!entityId || !nepaliYear || !nepaliMonth) {
      return res.status(400).json({
        success: false,
        message: "entityId, nepaliYear, and nepaliMonth are required",
      });
    }

    const result = await ledgerService.closePeriod(
      entityId,
      Number(nepaliYear),
      Number(nepaliMonth),
      adminId,
      note,
    );

    res.status(200).json({
      success: true,
      message: `Period ${nepaliYear}/${String(nepaliMonth).padStart(2, "0")} closed`,
      data: result,
    });
  } catch (error) {
    console.error("Error in closePeriod controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /ledger/reopen-period
 * Body: { entityId, nepaliYear, nepaliMonth, note? }
 */
export const reopenPeriod = async (req, res) => {
  try {
    const { entityId, nepaliYear, nepaliMonth, note } = req.body;
    const adminId = req.user?._id ?? req.user?.id;

    if (!entityId || !nepaliYear || !nepaliMonth) {
      return res.status(400).json({
        success: false,
        message: "entityId, nepaliYear, and nepaliMonth are required",
      });
    }

    const result = await ledgerService.reopenPeriod(
      entityId,
      Number(nepaliYear),
      Number(nepaliMonth),
      adminId,
      note,
    );

    res.status(200).json({
      success: true,
      message: `Period ${nepaliYear}/${String(nepaliMonth).padStart(2, "0")} reopened`,
      data: result,
    });
  } catch (error) {
    console.error("Error in reopenPeriod controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /ledger/closed-periods?entityId=&closedOnly=true
 */
export const getClosedPeriods = async (req, res) => {
  try {
    const { entityId, closedOnly } = req.query;

    if (!entityId) {
      return res.status(400).json({
        success: false,
        message: "entityId is required",
      });
    }

    const periods = await ledgerService.getClosedPeriods(
      entityId,
      closedOnly === "true",
    );

    res.status(200).json({ success: true, data: periods });
  } catch (error) {
    console.error("Error in getClosedPeriods controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /ledger/rebuild-balance
 * Admin-only: recompute an account's balance from full ledger history.
 * Body: { entityId, accountCode }
 */
export const rebuildBalance = async (req, res) => {
  try {
    const { entityId, accountCode } = req.body;

    if (!entityId || !accountCode) {
      return res.status(400).json({
        success: false,
        message: "entityId and accountCode are required",
      });
    }

    const result = await rebuildAccountBalance(accountCode, entityId);

    res.status(200).json({
      success: true,
      message: result.hadDrift
        ? `Balance corrected — drift of ${result.driftFormatted}`
        : "Balance verified — no drift detected",
      data: result,
    });
  } catch (error) {
    console.error("Error in rebuildBalance controller:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
