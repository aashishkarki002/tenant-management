import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { Account } from "./accounts/Account.Model.js";
import { Transaction } from "./transactions/Transaction.Model.js";
import { LedgerEntry } from "./Ledger.Model.js";
import { ClosedPeriod } from "./ClosedPeriod.Model.js";
import { VacateSettlement } from "./vacateSettlement/VacateSettlement.Model.js";
import { paisaToRupees, formatMoney } from "../../utils/moneyUtil.js";
import { buildEntityFilter } from "../../utils/buildEntityFilter.js";
import {
  applyJournalBalances,
  computeBalanceChange,
  resolveAccountsByEntity,
} from "./domains/accountBalanceManger.js";
import { auditService } from "../audit/audit.service.js";
import {
  getFiscalQuarterMonths,
  resolveFiscalGregorianRange
} from "../../config/fiscalCalendar.js";
import { assignVoucherNumber } from "./vouchers/voucherNumbering.js";

// Inside getLedger(filters = {})
// ...

// ...
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

    // ── Tenant ledger lock guard ────────────────────────────────────────────
    // Reject any new postings to a vacated tenant's ledger.
    const tenantId = payload.tenant ?? null;
    if (tenantId) {
      const lockedSettlement = await VacateSettlement.findOne({
        tenant: tenantId,
        status: "COMPLETED",
      }).select("ledgerLockedAt").session(session).lean();
      if (lockedSettlement?.ledgerLockedAt) {
        throw new Error(
          `Tenant ledger is locked — this tenant has been vacated and their ledger is closed. ` +
          `No new journal entries can be posted.`,
        );
      }
    }

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

    // ── Assign voucher number ───────────────────────────────────────────────
    const { voucherNo, voucherType } = await assignVoucherNumber(
      transactionType,
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
          voucherNo,
          voucherType,
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

    // ── Audit log (fire-and-forget — never blocks the main path) ────────────
    auditService.log("TRANSACTION_CREATED", createdBy ?? resolvedEntityId, {
      entityId: resolvedEntityId,
      resourceType: "Transaction",
      resourceId: transaction._id,
      amountPaisa: totalAmountPaisa,
      nepaliYear,
      nepaliMonth,
    }).catch(() => { }); // swallow — audit failure must not affect posting

    return { transaction, ledgerEntries };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // postReversalEntry
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Post an accounting reversal for a previously posted transaction.
   *
   * A reversal is an equal-and-opposite journal entry that nullifies the
   * effect of the original transaction. The original Transaction is never
   * mutated — this preserves the immutable audit trail.
   *
   * Rules:
   *  - Original transaction must exist and have status "POSTED".
   *  - Every debit in the original becomes a credit in the reversal, and vice versa.
   *  - The reversed transaction's status is set to "VOIDED" after the reversal posts.
   *  - The reversal Transaction type uses the original type + "_REVERSAL" suffix.
   *  - Idempotency is inherited from postJournalEntry (same guard applies).
   *
   * @param {Object} options
   * @param {string|ObjectId}  options.transactionId   — _id of the Transaction to reverse
   * @param {string}           options.reason          — Human-readable reason (required)
   * @param {ObjectId}         options.reversedBy      — Admin performing the reversal
   * @param {string}           [options.nepaliDate]    — Override posting date (BS "YYYY-MM-DD")
   * @param {number}           [options.nepaliMonth]   — Override posting period month
   * @param {number}           [options.nepaliYear]    — Override posting period year
   * @param {mongoose.ClientSession} [options.session] — Pass for atomicity with caller
   *
   * @returns {Promise<{ reversalTransaction, ledgerEntries, voidedTransaction }>}
   *
   * @throws {Error} If transaction not found, already voided, or period is closed.
   */
  async postReversalEntry(options = {}) {
    const {
      transactionId,
      reason,
      reversedBy,
      nepaliDate: overrideNepaliDate,
      nepaliMonth: overrideMonth,
      nepaliYear: overrideYear,
      session: externalSession = null,
    } = options;

    if (!transactionId) throw new Error("postReversalEntry: transactionId is required");
    if (!reason?.trim()) throw new Error("postReversalEntry: reason is required");
    if (!reversedBy) throw new Error("postReversalEntry: reversedBy is required");

    // Use caller's session if provided; otherwise manage our own.
    const ownSession = !externalSession;
    const session = externalSession ?? (await mongoose.startSession());
    if (ownSession) session.startTransaction();

    try {
      // ── Fetch original transaction + its ledger entries ──────────────────
      const original = await Transaction.findById(transactionId).session(session);
      if (!original) {
        throw new Error(`Transaction ${transactionId} not found`);
      }
      if (original.status === "VOIDED") {
        throw new Error(
          `Transaction ${transactionId} is already voided — cannot reverse again`,
        );
      }
      if (original.status !== "POSTED") {
        throw new Error(
          `Transaction ${transactionId} has status "${original.status}" — only POSTED transactions can be reversed`,
        );
      }

      const originalEntries = await LedgerEntry.find({
        transaction: original._id,
      }).session(session).lean();

      if (!originalEntries.length) {
        throw new Error(
          `Transaction ${transactionId} has no ledger entries — cannot build reversal`,
        );
      }

      // ── Build reversal entries (flip debit/credit) ───────────────────────
      const reversalEntryDefs = originalEntries.map((e) => {
        // Fetch the account code from the Account document referenced by e.account
        // We store the accountCode on the entry for this purpose.
        return {
          accountCode: null,          // filled below after account lookup
          _accountId: e.account,      // raw ObjectId — used for lookup
          debitAmountPaisa: e.creditAmountPaisa,  // flipped
          creditAmountPaisa: e.debitAmountPaisa,  // flipped
          description: `REVERSAL: ${e.description} — ${reason}`,
          tenant: e.tenant ?? null,
          property: e.property ?? null,
        };
      });

      // Resolve account codes from Account collection
      const accountIds = [...new Set(reversalEntryDefs.map((e) => e._accountId.toString()))];
      const accounts = await Account.find({ _id: { $in: accountIds } }).session(session).lean();
      const accountCodeById = {};
      for (const acc of accounts) accountCodeById[acc._id.toString()] = acc.code;

      for (const entry of reversalEntryDefs) {
        entry.accountCode = accountCodeById[entry._accountId.toString()];
        if (!entry.accountCode) {
          throw new Error(
            `Cannot find account code for Account ${entry._accountId} while building reversal`,
          );
        }
        delete entry._accountId;
      }

      // ── Determine reversal period ────────────────────────────────────────
      const reversalDate = new Date();
      const reversalNepaliDate = overrideNepaliDate ?? original.nepaliDate;
      const reversalNepaliMonth = overrideMonth ?? original.nepaliMonth;
      const reversalNepaliYear = overrideYear ?? original.nepaliYear;

      // ── Post reversal via postJournalEntry (inherits all guards) ─────────
      const reversalType = `${original.type}_REVERSAL`;

      // Add REVERSAL types to Transaction.type enum dynamically via allowedValues fallback.
      // Because Mongoose validates on save, we disable enum for reversal by setting
      // the type field directly after creation. postJournalEntry passes `transactionType`
      // which is the `type` field — we need to ensure this value is in the enum.
      // We extend the Transaction type enum in the model with _REVERSAL variants.
      const reversalPayload = {
        transactionType: reversalType,
        referenceType: original.referenceType,
        referenceId: original.referenceId,
        transactionDate: reversalDate,
        nepaliDate: reversalNepaliDate,
        nepaliMonth: reversalNepaliMonth,
        nepaliYear: reversalNepaliYear,
        description: `REVERSAL of ${original.type} (${original._id}) — ${reason}`,
        createdBy: reversedBy,
        totalAmountPaisa: original.totalAmountPaisa,
        entries: reversalEntryDefs,
        entityId: original.entityId,
      };

      const { transaction: reversalTransaction, ledgerEntries } =
        await this.postJournalEntry(reversalPayload, session, original.entityId);

      // ── Mark original transaction as VOIDED ──────────────────────────────
      original.status = "VOIDED";
      original.voidedBy = reversedBy;
      original.voidedAt = reversalDate;
      original.voidReason = reason;
      await original.save({ session });

      // ── Audit log ────────────────────────────────────────────────────────
      auditService.log("TRANSACTION_REVERSED", reversedBy, {
        entityId: original.entityId,
        resourceType: "Transaction",
        resourceId: original._id,
        reversalTransactionId: reversalTransaction._id,
        reason,
      }).catch(() => { });

      if (ownSession) {
        await session.commitTransaction();
        session.endSession();
      }

      return {
        reversalTransaction,
        ledgerEntries,
        voidedTransaction: original,
      };
    } catch (err) {
      if (ownSession) {
        await session.abortTransaction();
        session.endSession();
      }
      throw err;
    }
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

      const { resolvedStart, resolvedEnd } = resolveFiscalGregorianRange(filters);

      if (resolvedStart || resolvedEnd) {
        query.transactionDate = {};
        if (resolvedStart) query.transactionDate.$gte = new Date(resolvedStart);
        if (resolvedEnd) {
          const end = new Date(resolvedEnd);
          end.setHours(23, 59, 59, 999);
          query.transactionDate.$lte = end;
        }
      } else {
        if (filters.nepaliYear) query.nepaliYear = Number(filters.nepaliYear);
        if (filters.nepaliMonth) query.nepaliMonth = Number(filters.nepaliMonth);
        if (filters.quarter) {
          const months = getFiscalQuarterMonths(filters.quarter);
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
        .populate("transaction", "type description transactionDate nepaliDate voucherNo voucherType")
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
          voucherNo: entry.transaction?.voucherNo ?? null,
          voucherType: entry.transaction?.voucherType ?? null,
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
        const months = getFiscalQuarterMonths(parseInt(filters.quarter));
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
        const months = getFiscalQuarterMonths(parseInt(filters.quarter));
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

    auditService.log("PERIOD_CLOSED", adminId, {
      entityId,
      resourceType: "ClosedPeriod",
      resourceId: result._id,
      nepaliYear: Number(nepaliYear),
      nepaliMonth: Number(nepaliMonth),
      reason: note,
    }).catch(() => { });

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

    auditService.log("PERIOD_REOPENED", adminId, {
      entityId,
      resourceType: "ClosedPeriod",
      resourceId: result._id,
      nepaliYear: Number(nepaliYear),
      nepaliMonth: Number(nepaliMonth),
      reason: note,
    }).catch(() => { });

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
  // getPropertyPL — P&L filtered by property
  // ─────────────────────────────────────────────────────────────────────────
  async getPropertyPL(propertyId, filters = {}) {
    if (!propertyId) throw new Error("propertyId is required");
    const { startDate, endDate, entityId } = filters;

    const matchStage = { property: new mongoose.Types.ObjectId(String(propertyId)) };
    if (entityId) matchStage.entityId = new mongoose.Types.ObjectId(String(entityId));
    if (startDate || endDate) {
      matchStage.transactionDate = {};
      if (startDate) matchStage.transactionDate.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); matchStage.transactionDate.$lte = e; }
    }

    const rows = await LedgerEntry.aggregate([
      { $match: matchStage },
      { $lookup: { from: "accounts", localField: "account", foreignField: "_id", as: "acct" } },
      { $unwind: "$acct" },
      {
        $group: {
          _id: { accountCode: "$acct.code", accountName: "$acct.name", accountType: "$acct.type" },
          totalDebit: { $sum: "$debitAmountPaisa" },
          totalCredit: { $sum: "$creditAmountPaisa" },
        },
      },
      { $sort: { "_id.accountCode": 1 } },
    ]);

    let revenuePaisa = 0, expensePaisa = 0;
    const revenueLines = [], expenseLines = [];

    for (const r of rows) {
      const { accountCode, accountName, accountType } = r._id;
      const net = accountType === "REVENUE" ? r.totalCredit - r.totalDebit : r.totalDebit - r.totalCredit;
      const line = { accountCode, accountName, paisa: net, formatted: formatMoney(net) };
      if (accountType === "REVENUE") { revenuePaisa += net; revenueLines.push(line); }
      if (accountType === "EXPENSE") { expensePaisa += net; expenseLines.push(line); }
    }

    const netProfitPaisa = revenuePaisa - expensePaisa;
    return {
      propertyId,
      filters,
      revenueLines,
      expenseLines,
      totalRevenue: { paisa: revenuePaisa, formatted: formatMoney(revenuePaisa) },
      totalExpense: { paisa: expensePaisa, formatted: formatMoney(expensePaisa) },
      netProfit: { paisa: netProfitPaisa, formatted: formatMoney(netProfitPaisa) },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getBankReconciliation — compare ledger vs BankAccount.balancePaisa
  // ─────────────────────────────────────────────────────────────────────────
  async getBankReconciliation(entityId) {
    if (!entityId) throw new Error("entityId is required");
    const { BankAccount } = await import("../banks/BankAccountModel.js");

    const banks = await BankAccount.find({ entityId: new mongoose.Types.ObjectId(String(entityId)), isDeleted: { $ne: true } }).lean();
    const results = [];

    for (const bank of banks) {
      const ledgerAccount = await Account.findOne({ code: bank.accountCode, entityId: new mongoose.Types.ObjectId(String(entityId)) }).lean();
      const ledgerBalancePaisa = ledgerAccount?.currentBalancePaisa ?? 0;
      const bankBalancePaisa = bank.balancePaisa ?? 0;
      const differencePaisa = ledgerBalancePaisa - bankBalancePaisa;

      results.push({
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        accountCode: bank.accountCode,
        ledgerBalance: { paisa: ledgerBalancePaisa, formatted: formatMoney(ledgerBalancePaisa) },
        bankBalance: { paisa: bankBalancePaisa, formatted: formatMoney(bankBalancePaisa) },
        difference: { paisa: differencePaisa, formatted: formatMoney(Math.abs(differencePaisa)) },
        isReconciled: differencePaisa === 0,
        note: differencePaisa !== 0
          ? "Ledger and operational bank balance differ. Run rebuild-balance or check for unposted transactions."
          : null,
      });
    }

    const totalLedger = results.reduce((s, r) => s + r.ledgerBalance.paisa, 0);
    const totalBank = results.reduce((s, r) => s + r.bankBalance.paisa, 0);

    return {
      entityId,
      accounts: results,
      totals: {
        ledger: { paisa: totalLedger, formatted: formatMoney(totalLedger) },
        bank: { paisa: totalBank, formatted: formatMoney(totalBank) },
        diff: { paisa: totalLedger - totalBank, formatted: formatMoney(Math.abs(totalLedger - totalBank)) },
      },
      allReconciled: results.every((r) => r.isReconciled),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getTdsFillingSummary — TDS register for government filing
  // ─────────────────────────────────────────────────────────────────────────
  async getTdsFilingSummary(nepaliYear, tenantId = null) {
    if (!nepaliYear) throw new Error("nepaliYear is required");
    const { Rent } = await import("../rents/rent.Model.js");

    const filter = {
      nepaliYear: Number(nepaliYear),
      tdsAmountPaisa: { $gt: 0 },
    };
    if (tenantId) filter.tenant = new mongoose.Types.ObjectId(String(tenantId));

    const rents = await Rent.find(filter)
      .populate("tenant", "name email phone panNumber")
      .populate("property", "name")
      .sort({ nepaliMonth: 1 })
      .lean();

    // Group by tenant
    const tenantMap = {};
    for (const rent of rents) {
      const tid = String(rent.tenant?._id ?? rent.tenant);
      if (!tenantMap[tid]) {
        tenantMap[tid] = {
          tenantId: tid,
          tenantName: rent.tenant?.name ?? "Unknown",
          tenantPan: rent.tenant?.panNumber ?? null,
          propertyName: rent.property?.name ?? null,
          monthlyBreakdown: [],
          totalGrossPaisa: 0,
          totalTdsPaisa: 0,
          tdsPaidToGovt: 0,
          tdsPending: 0,
        };
      }
      const t = tenantMap[tid];
      t.monthlyBreakdown.push({
        nepaliMonth: rent.nepaliMonth,
        grossRentPaisa: rent.grossRentAmountPaisa,
        tdsPaisa: rent.tdsAmountPaisa,
        paidToGovt: rent.tdsPaidToGovernment ?? false,
      });
      t.totalGrossPaisa += rent.grossRentAmountPaisa;
      t.totalTdsPaisa += rent.tdsAmountPaisa;
      if (rent.tdsPaidToGovernment) t.tdsPaidToGovt += rent.tdsAmountPaisa;
      else t.tdsPending += rent.tdsAmountPaisa;
    }

    const tenants = Object.values(tenantMap);
    const grandTotalGross = tenants.reduce((s, t) => s + t.totalGrossPaisa, 0);
    const grandTotalTds = tenants.reduce((s, t) => s + t.totalTdsPaisa, 0);
    const grandPaid = tenants.reduce((s, t) => s + t.tdsPaidToGovt, 0);
    const grandPending = tenants.reduce((s, t) => s + t.tdsPending, 0);

    const fmt = (p) => ({ paisa: p, formatted: formatMoney(p) });
    return {
      nepaliYear,
      tenants: tenants.map((t) => ({
        ...t,
        totalGross: fmt(t.totalGrossPaisa),
        totalTds: fmt(t.totalTdsPaisa),
        paidToGovt: fmt(t.tdsPaidToGovt),
        pending: fmt(t.tdsPending),
      })),
      grandTotal: {
        gross: fmt(grandTotalGross),
        tds: fmt(grandTotalTds),
        paid: fmt(grandPaid),
        pending: fmt(grandPending),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getCamReconciliation — estimated vs actual CAM per tenant per year
  // ─────────────────────────────────────────────────────────────────────────
  async getCamReconciliation(nepaliYear, entityId = null) {
    if (!nepaliYear) throw new Error("nepaliYear is required");
    const { default: CamModel } = await import("../cam/cam.model.js");

    const filter = { nepaliYear: Number(nepaliYear) };

    const cams = await CamModel.find(filter)
      .populate("tenant", "name email")
      .populate("block", "name")
      .lean();

    const tenantMap = {};
    for (const cam of cams) {
      const tid = String(cam.tenant?._id ?? cam.tenant);
      if (!tenantMap[tid]) {
        tenantMap[tid] = {
          tenantId: tid,
          tenantName: cam.tenant?.name ?? "Unknown",
          billedPaisa: 0,
          paidPaisa: 0,
          months: [],
        };
      }
      const t = tenantMap[tid];
      t.billedPaisa += cam.amount ?? 0;
      t.paidPaisa += cam.paidAmount ?? 0;
      t.months.push({ nepaliMonth: cam.nepaliMonth, billed: cam.amount, paid: cam.paidAmount, status: cam.status });
    }

    const tenants = Object.values(tenantMap).map((t) => ({
      ...t,
      outstandingPaisa: t.billedPaisa - t.paidPaisa,
      billed: formatMoney(t.billedPaisa),
      paid: formatMoney(t.paidPaisa),
      outstanding: formatMoney(t.billedPaisa - t.paidPaisa),
    }));

    const totalBilled = tenants.reduce((s, t) => s + t.billedPaisa, 0);
    const totalPaid = tenants.reduce((s, t) => s + t.paidPaisa, 0);
    return {
      nepaliYear,
      tenants,
      grandTotal: {
        billed: formatMoney(totalBilled),
        paid: formatMoney(totalPaid),
        outstanding: formatMoney(totalBilled - totalPaid),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getPettyCashLedger — ledger for petty cash account (1100)
  // ─────────────────────────────────────────────────────────────────────────
  async getPettyCashLedger(entityId, filters = {}) {
    return this.getLedger({ ...filters, entityId, accountCode: "1100" });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getTenantStatement — structured charges/payments per tenant for a period
  // ─────────────────────────────────────────────────────────────────────────
  async getTenantStatement(tenantId, filters = {}) {
    if (!tenantId) throw new Error("tenantId is required");
    const { startDate, endDate, fiscalYear, entityId } = filters;

    const { resolvedStart, resolvedEnd } = resolveFiscalGregorianRange(filters);

    const ledger = await this.getLedger({ tenantId, startDate: resolvedStart, endDate: resolvedEnd, entityId });

    const openingBalancePaisa = 0; // Could be enhanced with prior-period balance
    let runningPaisa = openingBalancePaisa;

    const statement = ledger.entries.map((e) => {
      const net = (e.debitAmountPaisa ?? 0) - (e.creditAmountPaisa ?? 0);
      runningPaisa += net;
      return {
        date: e.transactionDate,
        nepaliDate: e.nepaliDate,
        description: e.description,
        chargesPaisa: e.debitAmountPaisa > 0 ? e.debitAmountPaisa : 0,
        paymentsPaisa: e.creditAmountPaisa > 0 ? e.creditAmountPaisa : 0,
        balancePaisa: runningPaisa,
        charges: formatMoney(e.debitAmountPaisa > 0 ? e.debitAmountPaisa : 0),
        payments: formatMoney(e.creditAmountPaisa > 0 ? e.creditAmountPaisa : 0),
        balance: formatMoney(runningPaisa),
      };
    });

    return {
      tenantId,
      filters,
      openingBalance: formatMoney(openingBalancePaisa),
      closingBalance: formatMoney(runningPaisa),
      closingBalancePaisa: runningPaisa,
      statement,
      totalChargesPaisa: statement.reduce((s, r) => s + r.chargesPaisa, 0),
      totalPaymentsPaisa: statement.reduce((s, r) => s + r.paymentsPaisa, 0),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getAccounts / createAccount / updateAccount — CoA management
  // ─────────────────────────────────────────────────────────────────────────
  async getAccounts(entityId, filters = {}) {
    const filter = { isActive: true };
    if (entityId) filter.entityId = new mongoose.Types.ObjectId(String(entityId));
    if (filters.type) filter.type = filters.type;
    return Account.find(filter).sort({ code: 1 }).lean();
  }

  async createAccount({ entityId, code, name, type, description, parentAccount }) {
    if (!entityId || !code || !name || !type)
      throw new Error("entityId, code, name, and type are required");
    const exists = await Account.findOne({ code, entityId: new mongoose.Types.ObjectId(String(entityId)) });
    if (exists) throw new Error(`Account code "${code}" already exists for this entity`);
    return Account.create({ entityId, code, name, type, description: description ?? null, parentAccount: parentAccount ?? null, currentBalancePaisa: 0, isActive: true });
  }

  async updateAccount(accountId, { name, description, isActive }) {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    const updated = await Account.findByIdAndUpdate(accountId, { $set: updates }, { new: true }).lean();
    if (!updated) throw new Error("Account not found");
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getArAging — Accounts Receivable Aging Report
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Returns outstanding AR balances per tenant bucketed by age.
   *
   * Buckets (by months overdue relative to rent BS month):
   *   current  — 0 months old (current month)
   *   1_month  — 1 month old
   *   2_months — 2 months old
   *   3_months — 3 months old
   *   over_3   — more than 3 months old
   *
   * @param {Object} [filters]
   * @param {string|ObjectId} [filters.propertyId]
   * @returns {Promise<Object>}
   */
  async getArAging(filters = {}) {
    const { Rent } = await import("../rents/rent.Model.js");
    const { Tenant } = await import("../tenant/Tenant.Model.js");

    const now = new NepaliDate();
    const currentBSYear = now.getYear();
    const currentBSMonth = now.getMonth() + 1; // getMonth() is 0-based

    // Total BS months elapsed since a given rent period
    const monthsOld = (rentYear, rentMonth) => {
      return (currentBSYear - rentYear) * 12 + (currentBSMonth - rentMonth);
    };

    const rentFilter = {
      $expr: {
        $gt: [
          {
            $subtract: [
              { $subtract: ["$grossRentAmountPaisa", "$tdsAmountPaisa"] },
              "$paidAmountPaisa",
            ],
          },
          0,
        ],
      },
    };

    if (filters.propertyId) {
      rentFilter.property = new mongoose.Types.ObjectId(String(filters.propertyId));
    }

    const rents = await Rent.find(rentFilter)
      .populate("tenant", "name email phone")
      .populate("property", "name")
      .lean();

    // Accumulate per-tenant
    const tenantMap = {};

    const BUCKETS = ["current", "1_month", "2_months", "3_months", "over_3"];

    const emptyBuckets = () => ({
      current: 0,
      "1_month": 0,
      "2_months": 0,
      "3_months": 0,
      over_3: 0,
    });

    for (const rent of rents) {
      const outstanding =
        (rent.grossRentAmountPaisa ?? 0) -
        (rent.tdsAmountPaisa ?? 0) -
        (rent.paidAmountPaisa ?? 0);

      if (outstanding <= 0) continue;

      const age = monthsOld(rent.nepaliYear, rent.nepaliMonth);
      let bucket;
      if (age <= 0) bucket = "current";
      else if (age === 1) bucket = "1_month";
      else if (age === 2) bucket = "2_months";
      else if (age === 3) bucket = "3_months";
      else bucket = "over_3";

      const tenantId = String(rent.tenant?._id ?? rent.tenant);
      if (!tenantMap[tenantId]) {
        tenantMap[tenantId] = {
          tenantId,
          tenantName: rent.tenant?.name ?? "Unknown",
          tenantEmail: rent.tenant?.email ?? null,
          tenantPhone: rent.tenant?.phone ?? null,
          propertyName: rent.property?.name ?? null,
          totalPaisa: 0,
          buckets: emptyBuckets(),
          rentCount: 0,
        };
      }

      tenantMap[tenantId].buckets[bucket] += outstanding;
      tenantMap[tenantId].totalPaisa += outstanding;
      tenantMap[tenantId].rentCount += 1;
    }

    const tenants = Object.values(tenantMap).sort(
      (a, b) => b.totalPaisa - a.totalPaisa,
    );

    // Grand totals per bucket
    const grandBuckets = emptyBuckets();
    let grandTotalPaisa = 0;
    for (const t of tenants) {
      for (const b of BUCKETS) {
        grandBuckets[b] += t.buckets[b];
      }
      grandTotalPaisa += t.totalPaisa;
    }

    const fmt = (paisa) => ({
      paisa,
      rupees: paisa / 100,
      formatted: formatMoney(paisa),
    });

    return {
      asOf: { bsYear: currentBSYear, bsMonth: currentBSMonth },
      tenants: tenants.map((t) => ({
        ...t,
        total: fmt(t.totalPaisa),
        buckets: Object.fromEntries(
          BUCKETS.map((b) => [b, fmt(t.buckets[b])]),
        ),
      })),
      grandTotal: {
        total: fmt(grandTotalPaisa),
        buckets: Object.fromEntries(
          BUCKETS.map((b) => [b, fmt(grandBuckets[b])]),
        ),
      },
    };
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
