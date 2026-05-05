import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { Account } from "./accounts/Account.Model.js";
import { Transaction } from "./transactions/Transaction.Model.js";
import { LedgerEntry } from "./Ledger.Model.js";
import { ClosedPeriod } from "./ClosedPeriod.Model.js";
import { getMonthsInQuarter } from "../../utils/nepaliMonthQuarter.js";
import { paisaToRupees, formatMoney } from "../../utils/moneyUtil.js";
import { buildEntityFilter } from "../../utils/buildEntityFilter.js";
import {
  applyJournalBalances,
  computeBalanceChange,
  resolveAccountsByEntity,
} from "./domains/accountBalanceManger.js";

/** Nepal fiscal quarters (0-based BS month), aligned with accounting.service.js */
const FISCAL_QUARTER_MONTHS = {
  1: [3, 4, 5],
  2: [6, 7, 8],
  3: [9, 10, 11],
  4: [0, 1, 2],
};

const FISCAL_YEAR_MONTH_ORDER = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];

function bsMonthToDateRange(year, month0) {
  const firstNp = new NepaliDate(year, month0, 1);
  const lastDay = NepaliDate.getDaysOfMonth(year, month0);
  const lastNp = new NepaliDate(year, month0, lastDay);
  const toISO = (nd) => nd.getDateObject().toISOString().split("T")[0];
  return { startDate: toISO(firstNp), endDate: toISO(lastNp) };
}

function getQuarterMonths(quarter, fiscalYear) {
  const year = fiscalYear ?? new NepaliDate().getYear();
  return FISCAL_QUARTER_MONTHS[quarter].map((month0) => ({
    year: month0 <= 2 ? year + 1 : year,
    month0,
  }));
}

function getFiscalYearMonths(fiscalYear) {
  return FISCAL_YEAR_MONTH_ORDER.map((month0) => {
    const year = month0 <= 2 ? fiscalYear + 1 : fiscalYear;
    return { year, month0 };
  });
}

function resolveMonthToDateRange(month, fiscalYear) {
  const month0 = month - 1;
  const fy = fiscalYear ?? new NepaliDate().getYear();
  const calendarYear = month0 <= 2 ? fy + 1 : fy;
  return bsMonthToDateRange(calendarYear, month0);
}

/**
 * Match accounting summary precedence: explicit start/end > month > quarter > full FY.
 * When none apply, returns no range (caller may still use nepaliMonth / legacy quarter).
 */
function resolveLedgerGregorianRange(filters) {
  if (filters.startDate || filters.endDate) {
    return {
      resolvedStart: filters.startDate,
      resolvedEnd: filters.endDate,
    };
  }

  const fyRaw = filters.fiscalYear;
  const fiscalYear =
    fyRaw !== undefined && fyRaw !== null && fyRaw !== ""
      ? Number(fyRaw)
      : undefined;

  if (filters.month) {
    const r = resolveMonthToDateRange(Number(filters.month), fiscalYear);
    return { resolvedStart: r.startDate, resolvedEnd: r.endDate };
  }

  if (filters.quarter) {
    const months = getQuarterMonths(Number(filters.quarter), fiscalYear);
    const first = bsMonthToDateRange(months[0].year, months[0].month0);
    const last = bsMonthToDateRange(
      months[months.length - 1].year,
      months[months.length - 1].month0,
    );
    return { resolvedStart: first.startDate, resolvedEnd: last.endDate };
  }

  if (fiscalYear != null && Number.isFinite(fiscalYear)) {
    const fyMonths = getFiscalYearMonths(fiscalYear);
    const first = bsMonthToDateRange(fyMonths[0].year, fyMonths[0].month0);
    const last = bsMonthToDateRange(
      fyMonths[fyMonths.length - 1].year,
      fyMonths[fyMonths.length - 1].month0,
    );
    return { resolvedStart: first.startDate, resolvedEnd: last.endDate };
  }

  return { resolvedStart: undefined, resolvedEnd: undefined };
}

class LedgerService {
  // ─────────────────────────────────────────────────────────────────────────
  // Backward-compat shim
  // ─────────────────────────────────────────────────────────────────────────
  calculateBalanceChange(accountType, debitAmountPaisa, creditAmountPaisa) {
    return computeBalanceChange(
      accountType,
      debitAmountPaisa,
      creditAmountPaisa,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // postJournalEntry
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Post a double-entry journal for a specific OwnershipEntity.
   *
   * @param {Object}                       payload
   * @param {mongoose.ClientSession|null}  [session]
   * @param {string|ObjectId}              entityId   REQUIRED — which entity owns this journal
   */
  async postJournalEntry(payload, session = null, entityId) {
    // ── Session guard ───────────────────────────────────────────────────────
    // Without a session, partial failures (e.g. LedgerEntry insert succeeds but
    // Account $inc fails) cannot be rolled back. Always pass a Mongoose session.
    if (!session) {
      console.warn(
        "[ledger] WARNING: postJournalEntry called without a Mongoose session. " +
          "Atomicity is not guaranteed — partial failures will not auto-rollback. " +
          "Pass a ClientSession to ensure all-or-nothing posting.",
      );
    }

    // entityId from argument takes precedence over payload
    const resolvedEntityId = entityId ?? payload.entityId ?? null;

    if (!resolvedEntityId) {
      throw new Error(
        "postJournalEntry: entityId is required. " +
          "Every journal must be scoped to an OwnershipEntity.",
      );
    }

    const {
      transactionType,
      referenceType,
      referenceId,
      transactionDate,
      nepaliDate,
      nepaliMonth,
      nepaliYear,
      description,
      createdBy,
      totalAmountPaisa,
      entries,
      tenant: payloadTenant,
      property: payloadProperty,
      billingFrequency,
      quarter,
    } = payload;

    if (!entries?.length)
      throw new Error("Journal payload must have at least one entry");

    // ── Period-close guard ──────────────────────────────────────────────────
    // Reject postings to a closed period.
    if (nepaliMonth && nepaliYear) {
      const closedPeriod = await ClosedPeriod.findOne({
        entityId: resolvedEntityId,
        nepaliYear: Number(nepaliYear),
        nepaliMonth: Number(nepaliMonth),
        isClosed: true,
      }).session(session);
      if (closedPeriod) {
        throw new Error(
          `Period ${nepaliYear}/${String(nepaliMonth).padStart(2, "0")} is closed for this entity. ` +
            `Reopen the period before posting new entries.`,
        );
      }
    }

    // ── Idempotency guard ───────────────────────────────────────────────────
    // Must include `type` so a reversal (e.g. RENT_CHARGE_REVERSAL) can
    // coexist with the original (RENT_CHARGE) on the same referenceId.
    // Without `type`, the guard finds the original and silently returns it
    // instead of posting the reversal — reversals would never be recorded.
    const existing = await Transaction.findOne({
      type: transactionType,
      referenceType,
      referenceId,
      entityId: resolvedEntityId,
    }).session(session);

    if (existing) {
      const existingEntries = await LedgerEntry.find({
        transaction: existing._id,
      }).session(session);
      return {
        transaction: existing,
        ledgerEntries: existingEntries,
        duplicate: true,
      };
    }

    // ── Debit/credit balance check ──────────────────────────────────────────
    const totalDebitPaisa = entries.reduce(
      (s, e) => s + (e.debitAmountPaisa || 0),
      0,
    );
    const totalCreditPaisa = entries.reduce(
      (s, e) => s + (e.creditAmountPaisa || 0),
      0,
    );

    if (totalDebitPaisa !== totalCreditPaisa) {
      throw new Error(
        `Journal entries do not balance: debits ${formatMoney(totalDebitPaisa)} ` +
          `vs credits ${formatMoney(totalCreditPaisa)}`,
      );
    }

    // ── Resolve accounts (code, entityId) pair ──────────────────────────────
    const accountByCode = await resolveAccountsByEntity(
      entries,
      resolvedEntityId,
      session,
    );

    // ── Create Transaction ──────────────────────────────────────────────────
    const [transaction] = await Transaction.create(
      [
        {
          type: transactionType,
          transactionDate,
          nepaliDate,
          description,
          referenceType,
          referenceId,
          totalAmountPaisa,
          createdBy,
          entityId: resolvedEntityId,
          status: "POSTED",
          billingFrequency,
          quarter,
        },
      ],
      { session },
    );

    // ── Build ledger docs ───────────────────────────────────────────────────
    const resolvedNepaliDate =
      typeof nepaliDate === "string"
        ? nepaliDate
        : nepaliDate instanceof Date
          ? nepaliDate.toISOString().split("T")[0]
          : null;

    const ledgerDocs = entries.map((entry) => {
      const account = accountByCode[entry.accountCode];
      return {
        transaction: transaction._id,
        account: account._id,
        debitAmountPaisa: entry.debitAmountPaisa || 0,
        creditAmountPaisa: entry.creditAmountPaisa || 0,
        balancePaisa: 0, // running balance computed on reads (getLedger)
        description: entry.description ?? description,
        tenant: entry.tenant ?? payloadTenant ?? null,
        property: entry.property ?? payloadProperty ?? null,
        entityId: resolvedEntityId,
        nepaliMonth,
        nepaliYear,
        nepaliDate: resolvedNepaliDate,
        transactionDate,
        // Audit trail: who triggered this posting
        createdBy: createdBy ?? null,
      };
    });

    // ── Insert entries FIRST — safe even if $inc below fails ────────────────
    // Ordering rationale: if LedgerEntry insert fails, no balance change
    // has occurred — state is fully consistent. If $inc fails after entries
    // are stored, rebuildAccountBalance() can repair the drift. The inverse
    // order ($inc first) leaves an incremented balance with no journal record,
    // which is undetectable without full reconciliation.
    const ledgerEntries = await LedgerEntry.insertMany(ledgerDocs, { session });

    // ── Apply balance changes via domain (entity-scoped) ────────────────────
    await applyJournalBalances(entries, resolvedEntityId, session);

    return { transaction, ledgerEntries };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getLedger
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Returns ledger lines in chronological order (FIFO): oldest transaction first,
   * newest last. Running balances are computed in that same sequence. Clients
   * should render `entries` as-is without reordering.
   */
  async getLedger(filters = {}) {
    try {
      const query = {};

      if (filters.tenantId)
        query.tenant = new mongoose.Types.ObjectId(filters.tenantId);
      if (filters.propertyId)
        query.property = new mongoose.Types.ObjectId(filters.propertyId);
      if (filters.entityId) {
        Object.assign(query, buildEntityFilter(filters.entityId));
      }

      const { resolvedStart, resolvedEnd } = resolveLedgerGregorianRange(filters);

      if (resolvedStart || resolvedEnd) {
        query.transactionDate = {};
        if (resolvedStart)
          query.transactionDate.$gte = new Date(resolvedStart);
        if (resolvedEnd) {
          const end = new Date(resolvedEnd);
          end.setHours(23, 59, 59, 999);
          query.transactionDate.$lte = end;
        }
      } else {
        if (filters.nepaliYear) query.nepaliYear = Number(filters.nepaliYear);
        if (filters.nepaliMonth) query.nepaliMonth = Number(filters.nepaliMonth);
        if (filters.quarter) {
          const months = getMonthsInQuarter(parseInt(filters.quarter));
          query.nepaliMonth = { $in: months };
        }
      }

      if (filters.accountCode) {
        if (!filters.entityId) {
          throw new Error(
            "getLedger: entityId is required when filtering by accountCode",
          );
        }
        const acc = await Account.findOne({
          code: filters.accountCode,
          entityId: new mongoose.Types.ObjectId(filters.entityId),
        }).lean();
        if (!acc)
          throw new Error(
            `Account "${filters.accountCode}" not found for entity ${filters.entityId}`,
          );
        query.account = acc._id;
      }

      if (filters.type && filters.type !== "all") {
        const TYPE_MAP = {
          revenue: "REVENUE",
          expense: "EXPENSE",
          asset: "ASSET",
          liability: "LIABILITY",
          equity: "EQUITY",
        };
        const accountType = TYPE_MAP[filters.type.toLowerCase()];
        if (!accountType) {
          throw new Error(`getLedger: unknown type filter "${filters.type}". Use: revenue, expense, asset, liability, equity`);
        }
        const typeFilter = { type: accountType };
        if (filters.entityId)
          typeFilter.entityId = new mongoose.Types.ObjectId(filters.entityId);
        const typeAccounts = await Account.find(typeFilter)
          .select("_id")
          .lean();
        // Use $or to avoid Mongoose CastError casting $in object as ObjectId (older Mongoose)
        const accountIds = typeAccounts.map((a) => a._id);
        query.$or = accountIds.map((id) => ({ account: id }));
        delete query.account; // type filter replaces any single-account filter
      }

      if (filters.propertyType) {
        const { Property } = await import("../property/Property.Model.js");
        const matchingProps = await Property.find({
          type: filters.propertyType,
        })
          .select("_id")
          .lean();
        const propIds = matchingProps.map((p) => p._id);
        if (query.property) {
          const hit = propIds.some(
            (id) => String(id) === String(query.property),
          );
          if (!hit) return this._emptyLedger(filters);
        } else {
          query.property = { $in: propIds };
        }
      }

      const entries = await LedgerEntry.find(query)
        .populate("account", "code name type")
        .populate("transaction", "type description transactionDate nepaliDate")
        .populate("tenant", "name email phone")
        .populate("property", "name address type")
        .populate("entityId", "name type")
        .sort({ transactionDate: 1, transaction: 1, _id: 1 })
        .lean();

      const runningBalances = {};

      const statement = entries.map((entry) => {
        const code = entry.account?.code ?? "UNKNOWN";
        const accountType = entry.account?.type;

        // Key running balance by "code:entityId" so two entities sharing the
        // same account code (e.g. both have "1200") don't bleed into each other
        // when the ledger is fetched without an entity filter.
        const entityKey = entry.entityId
          ? String(entry.entityId._id ?? entry.entityId)
          : "global";
        const balanceKey = `${code}:${entityKey}`;

        if (runningBalances[balanceKey] === undefined) runningBalances[balanceKey] = 0;

        const isDebitNormal =
          accountType === "ASSET" || accountType === "EXPENSE";
        const change = isDebitNormal
          ? entry.debitAmountPaisa - entry.creditAmountPaisa
          : entry.creditAmountPaisa - entry.debitAmountPaisa;

        runningBalances[balanceKey] += change;

        return {
          _id: entry._id,
          date: entry.transactionDate,
          nepaliDate: entry.nepaliDate ?? entry.transaction?.nepaliDate ?? null,
          nepaliMonth: entry.nepaliMonth,
          nepaliYear: entry.nepaliYear,
          account: entry.account,
          description: entry.description,
          entity: entry.entityId ?? null,
          property: entry.property,
          tenant: entry.tenant,
          transaction: entry.transaction,
          createdAt: entry.createdAt,
          paisa: {
            debit: entry.debitAmountPaisa,
            credit: entry.creditAmountPaisa,
            runningBalance: runningBalances[balanceKey],
          },
          debit: paisaToRupees(entry.debitAmountPaisa),
          credit: paisaToRupees(entry.creditAmountPaisa),
          runningBalance: paisaToRupees(runningBalances[balanceKey]),
          formatted: {
            debit: formatMoney(entry.debitAmountPaisa),
            credit: formatMoney(entry.creditAmountPaisa),
            runningBalance: formatMoney(runningBalances[balanceKey]),
          },
        };
      });

      const totalDebitPaisa = entries.reduce(
        (s, e) => s + e.debitAmountPaisa,
        0,
      );
      const totalCreditPaisa = entries.reduce(
        (s, e) => s + e.creditAmountPaisa,
        0,
      );

      return {
        entries: statement,
        summary: {
          totalEntries: statement.length,
          paisa: {
            totalDebit: totalDebitPaisa,
            totalCredit: totalCreditPaisa,
            netBalance: totalDebitPaisa - totalCreditPaisa,
          },
          totalDebit: paisaToRupees(totalDebitPaisa),
          totalCredit: paisaToRupees(totalCreditPaisa),
          netBalance: paisaToRupees(totalDebitPaisa - totalCreditPaisa),
          formatted: {
            totalDebit: formatMoney(totalDebitPaisa),
            totalCredit: formatMoney(totalCreditPaisa),
            netBalance: formatMoney(totalDebitPaisa - totalCreditPaisa),
          },
        },
        filters,
      };
    } catch (error) {
      console.error("Failed to get ledger:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getLedgerSummary
  // ─────────────────────────────────────────────────────────────────────────
  async getLedgerSummary(filters = {}) {
    try {
      const query = {};

      if (filters.tenantId)
        query.tenant = new mongoose.Types.ObjectId(filters.tenantId);
      if (filters.nepaliYear) query.nepaliYear = Number(filters.nepaliYear);
      if (filters.entityId) {
        Object.assign(query, buildEntityFilter(filters.entityId));
      }

      if (filters.quarter) {
        const months = getMonthsInQuarter(parseInt(filters.quarter));
        query.nepaliMonth = { $in: months };
      }

      if (filters.startDate || filters.endDate) {
        query.transactionDate = {};
        if (filters.startDate)
          query.transactionDate.$gte = new Date(filters.startDate);
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          query.transactionDate.$lte = end;
        }
      }

      const summary = await LedgerEntry.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$account",
            totalDebitPaisa: { $sum: "$debitAmountPaisa" },
            totalCreditPaisa: { $sum: "$creditAmountPaisa" },
            entryCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "accounts",
            localField: "_id",
            foreignField: "_id",
            as: "accountDetails",
          },
        },
        { $unwind: "$accountDetails" },
        {
          $project: {
            accountCode: "$accountDetails.code",
            accountName: "$accountDetails.name",
            accountType: "$accountDetails.type",
            entityId: "$accountDetails.entityId",
            totalDebitPaisa: 1,
            totalCreditPaisa: 1,
            netBalancePaisa: {
              $subtract: ["$totalDebitPaisa", "$totalCreditPaisa"],
            },
            totalDebit: { $divide: ["$totalDebitPaisa", 100] },
            totalCredit: { $divide: ["$totalCreditPaisa", 100] },
            netBalance: {
              $divide: [
                { $subtract: ["$totalDebitPaisa", "$totalCreditPaisa"] },
                100,
              ],
            },
            entryCount: 1,
          },
        },
        { $sort: { accountCode: 1 } },
      ]);

      const grandTotalDebitPaisa = summary.reduce(
        (s, a) => s + a.totalDebitPaisa,
        0,
      );
      const grandTotalCreditPaisa = summary.reduce(
        (s, a) => s + a.totalCreditPaisa,
        0,
      );
      const grandTotalEntries = summary.reduce((s, a) => s + a.entryCount, 0);

      return {
        accounts: summary,
        grandTotal: {
          paisa: {
            totalDebit: grandTotalDebitPaisa,
            totalCredit: grandTotalCreditPaisa,
            netBalance: grandTotalDebitPaisa - grandTotalCreditPaisa,
          },
          totalDebit: paisaToRupees(grandTotalDebitPaisa),
          totalCredit: paisaToRupees(grandTotalCreditPaisa),
          netBalance: paisaToRupees(
            grandTotalDebitPaisa - grandTotalCreditPaisa,
          ),
          formatted: {
            totalDebit: formatMoney(grandTotalDebitPaisa),
            totalCredit: formatMoney(grandTotalCreditPaisa),
            netBalance: formatMoney(
              grandTotalDebitPaisa - grandTotalCreditPaisa,
            ),
          },
          totalEntries: grandTotalEntries,
        },
        filters,
      };
    } catch (error) {
      console.error("Failed to get ledger summary:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getPropertyLedger
  // ─────────────────────────────────────────────────────────────────────────
  async getPropertyLedger(propertyId, filters = {}) {
    if (!propertyId) throw new Error("propertyId is required");
    return this.getLedger({ ...filters, propertyId });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getEntitySummary — P&L per OwnershipEntity
  // ─────────────────────────────────────────────────────────────────────────
  async getEntitySummary(filters = {}) {
    try {
      const matchStage = {};

      if (filters.nepaliYear)
        matchStage.nepaliYear = Number(filters.nepaliYear);
      if (filters.nepaliMonth)
        matchStage.nepaliMonth = Number(filters.nepaliMonth);
      if (filters.entityId)
        matchStage.entityId = new mongoose.Types.ObjectId(filters.entityId);

      if (filters.quarter) {
        const months = getMonthsInQuarter(parseInt(filters.quarter));
        matchStage.nepaliMonth = { $in: months };
      }

      const rows = await LedgerEntry.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: "accounts",
            localField: "account",
            foreignField: "_id",
            as: "acct",
          },
        },
        { $unwind: "$acct" },
        {
          $group: {
            _id: { entityId: "$entityId", accountType: "$acct.type" },
            totalDebitPaisa: { $sum: "$debitAmountPaisa" },
            totalCreditPaisa: { $sum: "$creditAmountPaisa" },
            entryCount: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "ownershipentities",
            localField: "_id.entityId",
            foreignField: "_id",
            as: "entity",
          },
        },
        {
          $project: {
            entityId: "$_id.entityId",
            entityName: { $arrayElemAt: ["$entity.name", 0] },
            entityType: { $arrayElemAt: ["$entity.type", 0] },
            accountType: "$_id.accountType",
            totalDebitPaisa: 1,
            totalCreditPaisa: 1,
            entryCount: 1,
          },
        },
        { $sort: { entityName: 1, accountType: 1 } },
      ]);

      const byEntity = {};
      for (const row of rows) {
        const key = String(row.entityId ?? "legacy");
        if (!byEntity[key]) {
          byEntity[key] = {
            entityId: row.entityId,
            entityName: row.entityName ?? "Legacy (untagged)",
            entityType: row.entityType ?? "private",
            revenuePaisa: 0,
            expensePaisa: 0,
            assetPaisa: 0,
            liabilityPaisa: 0,
            entryCount: 0,
          };
        }
        const e = byEntity[key];
        e.entryCount += row.entryCount;

        if (row.accountType === "REVENUE") {
          e.revenuePaisa += row.totalCreditPaisa - row.totalDebitPaisa;
        } else if (row.accountType === "EXPENSE") {
          e.expensePaisa += row.totalDebitPaisa - row.totalCreditPaisa;
        } else if (row.accountType === "ASSET") {
          e.assetPaisa += row.totalDebitPaisa - row.totalCreditPaisa;
        } else if (row.accountType === "LIABILITY") {
          e.liabilityPaisa += row.totalCreditPaisa - row.totalDebitPaisa;
        }
      }

      const summaries = Object.values(byEntity).map((e) => ({
        ...e,
        netProfitPaisa: e.revenuePaisa - e.expensePaisa,
        revenue: formatMoney(e.revenuePaisa),
        expense: formatMoney(e.expensePaisa),
        netProfit: formatMoney(e.revenuePaisa - e.expensePaisa),
        netProfitRupees: paisaToRupees(e.revenuePaisa - e.expensePaisa),
      }));

      const grandRevenue = summaries.reduce((s, e) => s + e.revenuePaisa, 0);
      const grandExpense = summaries.reduce((s, e) => s + e.expensePaisa, 0);

      return {
        entities: summaries,
        consolidated: {
          revenuePaisa: grandRevenue,
          expensePaisa: grandExpense,
          netProfitPaisa: grandRevenue - grandExpense,
          revenue: formatMoney(grandRevenue),
          expense: formatMoney(grandExpense),
          netProfit: formatMoney(grandRevenue - grandExpense),
        },
        filters,
      };
    } catch (error) {
      console.error("Failed to get entity summary:", error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // reverseJournalEntry
  // ─────────────────────────────────────────────────────────────────────────
  async reverseJournalEntry(
    originalTransactionId,
    reason,
    reversedBy,
    session = null,
  ) {
    const orig = await Transaction.findById(originalTransactionId).session(
      session,
    );
    if (!orig)
      throw new Error(`Transaction ${originalTransactionId} not found`);
    if (orig.type.endsWith("_REVERSAL")) {
      throw new Error("Cannot reverse a reversal transaction");
    }

    if (!orig.entityId) {
      throw new Error(
        "Cannot reverse a transaction with no entityId — migrate it first",
      );
    }

    const origEntries = await LedgerEntry.find({
      transaction: originalTransactionId,
    })
      .populate("account", "code")
      .session(session)
      .lean();

    if (!origEntries.length)
      throw new Error("No ledger entries found for transaction");

    // Reversal posts in the CURRENT period (date of reversal), not the original
    // period. Transaction schema has no nepaliMonth/Year — derive from now.
    const nowNp = new NepaliDate();
    const reversalNepaliYear = nowNp.getYear();
    const reversalNepaliMonth = nowNp.getMonth() + 1; // getMonth() is 0-based
    const reversalNepaliDate = `${reversalNepaliYear}-${String(reversalNepaliMonth).padStart(2, "0")}-${String(nowNp.getDate()).padStart(2, "0")}`;

    const reversalPayload = {
      transactionType: `${orig.type}_REVERSAL`,
      referenceType: orig.referenceType,
      referenceId: orig.referenceId,
      transactionDate: new Date(),
      nepaliDate: reversalNepaliDate,
      nepaliMonth: reversalNepaliMonth,
      nepaliYear: reversalNepaliYear,
      description: `REVERSAL: ${reason} (original: ${orig.description})`,
      createdBy: reversedBy,
      totalAmountPaisa: orig.totalAmountPaisa,
      entityId: orig.entityId,
      tenant: null,
      property: null,
      entries: origEntries.map((e) => ({
        accountCode: e.account.code,
        debitAmountPaisa: e.creditAmountPaisa,
        creditAmountPaisa: e.debitAmountPaisa,
        description: `REVERSAL: ${e.description}`,
      })),
    };

    return this.postJournalEntry(reversalPayload, session, orig.entityId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Period closing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Close a BS month/year for an entity. Prevents new journal postings to that period.
   *
   * @param {string|ObjectId} entityId
   * @param {number}          nepaliYear
   * @param {number}          nepaliMonth   1–12
   * @param {string|ObjectId} adminId       who is closing
   * @param {string}          [note]
   */
  async closePeriod(entityId, nepaliYear, nepaliMonth, adminId, note) {
    if (!entityId) throw new Error("closePeriod: entityId is required");
    if (!nepaliYear || !nepaliMonth) throw new Error("closePeriod: nepaliYear and nepaliMonth are required");
    if (nepaliMonth < 1 || nepaliMonth > 12) throw new Error("closePeriod: nepaliMonth must be 1–12");

    const result = await ClosedPeriod.findOneAndUpdate(
      { entityId, nepaliYear: Number(nepaliYear), nepaliMonth: Number(nepaliMonth) },
      {
        $set: {
          isClosed: true,
          closedBy: adminId,
          closedAt: new Date(),
          closeNote: note ?? null,
        },
      },
      { upsert: true, returnDocument: "after", new: true },
    );

    return result;
  }

  /**
   * Reopen a previously closed period to allow corrections.
   *
   * @param {string|ObjectId} entityId
   * @param {number}          nepaliYear
   * @param {number}          nepaliMonth
   * @param {string|ObjectId} adminId       who is reopening
   * @param {string}          [note]
   */
  async reopenPeriod(entityId, nepaliYear, nepaliMonth, adminId, note) {
    if (!entityId) throw new Error("reopenPeriod: entityId is required");

    const result = await ClosedPeriod.findOneAndUpdate(
      { entityId, nepaliYear: Number(nepaliYear), nepaliMonth: Number(nepaliMonth) },
      {
        $set: {
          isClosed: false,
          reopenedBy: adminId,
          reopenedAt: new Date(),
          reopenNote: note ?? null,
        },
      },
      { returnDocument: "after", new: true },
    );

    if (!result) {
      throw new Error(
        `Period ${nepaliYear}/${String(nepaliMonth).padStart(2, "0")} was never closed for this entity`,
      );
    }

    return result;
  }

  /**
   * List all period close records for an entity.
   *
   * @param {string|ObjectId} entityId
   * @param {boolean}         [closedOnly=false]   when true, return only currently-closed periods
   */
  async getClosedPeriods(entityId, closedOnly = false) {
    if (!entityId) throw new Error("getClosedPeriods: entityId is required");

    const filter = { entityId };
    if (closedOnly) filter.isClosed = true;

    const periods = await ClosedPeriod.find(filter)
      .populate("closedBy", "name email")
      .populate("reopenedBy", "name email")
      .sort({ nepaliYear: -1, nepaliMonth: -1 })
      .lean();

    return periods;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────
  _emptyLedger(filters) {
    return {
      entries: [],
      summary: {
        totalEntries: 0,
        paisa: { totalDebit: 0, totalCredit: 0, netBalance: 0 },
        totalDebit: 0,
        totalCredit: 0,
        netBalance: 0,
        formatted: {
          totalDebit: formatMoney(0),
          totalCredit: formatMoney(0),
          netBalance: formatMoney(0),
        },
      },
      filters,
    };
  }
}

export const ledgerService = new LedgerService();
