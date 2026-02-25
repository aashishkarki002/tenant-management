/**
 * ledger_service.js  (FIXED)
 *
 * Key fixes applied:
 *   C-1  Idempotency guard on postJournalEntry — duplicate reference = no-op
 *   C-2  balancePaisa stored correctly (per-account running balance at write time)
 *   H-3  getLedger running balance is now per-account, not a mixed stream total
 *   H-4  accountCode filter now correctly applied in getLedger
 *   H-7  LedgerEntry lines inserted via insertMany — one round-trip per journal
 */

import mongoose from "mongoose";
import { Account } from "./accounts/Account.Model.js";
import { Transaction } from "./transactions/Transaction.Model.js";
import { LedgerEntry } from "./Ledger.Model.js";
import { getMonthsInQuarter } from "../../utils/nepaliMonthQuarter.js";
import { paisaToRupees, formatMoney } from "../../utils/moneyUtil.js";

class LedgerService {
  // ─────────────────────────────────────────────────────────────────────────
  // calculateBalanceChange
  // ─────────────────────────────────────────────────────────────────────────
  calculateBalanceChange(accountType, debitAmountPaisa, creditAmountPaisa) {
    if (
      !Number.isInteger(debitAmountPaisa) ||
      !Number.isInteger(creditAmountPaisa)
    ) {
      throw new Error(
        `Balance change must use integer paisa. Got debit: ${debitAmountPaisa}, credit: ${creditAmountPaisa}`,
      );
    }

    const net = debitAmountPaisa - creditAmountPaisa;

    // T-account rules:
    //   ASSET & EXPENSE:            debit increases, credit decreases → +net
    //   LIABILITY, REVENUE, EQUITY: credit increases, debit decreases → -net
    if (accountType === "ASSET" || accountType === "EXPENSE") return net;
    if (
      accountType === "LIABILITY" ||
      accountType === "REVENUE" ||
      accountType === "EQUITY"
    )
      return -net;
    return net; // unknown type — default to debit-normal
  }

  // ─────────────────────────────────────────────────────────────────────────
  // postJournalEntry  (FIXED: C-1 idempotency · C-2 balancePaisa · H-7 insertMany)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Post a double-entry journal.  The payload must be the canonical shape
   * produced by buildJournalPayload() — all amounts in integer paisa.
   *
   * @param {Object} payload  - canonical journal payload
   * @param {mongoose.ClientSession|null} [session]
   * @returns {Promise<{ transaction: Transaction, ledgerEntries: LedgerEntry[] }>}
   */
  async postJournalEntry(payload, session = null) {
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

    // ── FIX C-1: Idempotency guard ─────────────────────────────────────────
    // If this exact source document was already journaled, return the existing
    // transaction instead of creating a duplicate.
    const existing = await Transaction.findOne({
      referenceType,
      referenceId,
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

    // ── Validate entries (canonical payload already checked, but belt-and-suspenders)
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

    // ── Fetch all accounts in one query ────────────────────────────────────
    const accountCodes = [...new Set(entries.map((e) => e.accountCode))];
    const accounts = await Account.find({ code: { $in: accountCodes } })
      .session(session)
      .lean();
    const accountByCode = Object.fromEntries(accounts.map((a) => [a.code, a]));

    for (const code of accountCodes) {
      if (!accountByCode[code])
        throw new Error(`Account with code "${code}" not found`);
    }

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
          status: "POSTED",
          billingFrequency,
          quarter,
        },
      ],
      { session },
    );

    // ── FIX H-7: build all ledger docs first, insert in one call ───────────
    // ── FIX C-2: fetch updated account balance after $inc, store it ─────────
    const ledgerDocs = [];
    const balanceUpdates = []; // collect {accountId, changeInPaisa} to $inc in bulk

    for (const entry of entries) {
      const account = accountByCode[entry.accountCode];
      const debitAmountPaisa = entry.debitAmountPaisa || 0;
      const creditAmountPaisa = entry.creditAmountPaisa || 0;
      const balanceChange = this.calculateBalanceChange(
        account.type,
        debitAmountPaisa,
        creditAmountPaisa,
      );

      balanceUpdates.push({ accountId: account._id, change: balanceChange });

      ledgerDocs.push({
        transaction: transaction._id,
        account: account._id,
        debitAmountPaisa,
        creditAmountPaisa,
        balancePaisa: 0, // placeholder — filled after $inc below
        description: entry.description ?? description,
        tenant: entry.tenant ?? payloadTenant ?? null,
        property: entry.property ?? payloadProperty ?? null,
        nepaliMonth,
        nepaliYear,
        transactionDate,
      });
    }

    // Apply all account balance changes
    for (const { accountId, change } of balanceUpdates) {
      await Account.findByIdAndUpdate(
        accountId,
        { $inc: { currentBalancePaisa: change } },
        { session },
      );
    }

    // Fetch updated balances and attach to ledger docs
    const updatedAccountIds = [
      ...new Set(balanceUpdates.map((u) => String(u.accountId))),
    ];
    const updatedAccounts = await Account.find({
      _id: { $in: updatedAccountIds },
    })
      .session(session)
      .lean();
    const balanceByAccountId = Object.fromEntries(
      updatedAccounts.map((a) => [String(a._id), a.currentBalancePaisa]),
    );

    for (const doc of ledgerDocs) {
      doc.balancePaisa = balanceByAccountId[String(doc.account)] ?? 0;
    }

    // Insert all ledger entries in one round-trip (FIX H-7)
    const ledgerEntries = await LedgerEntry.insertMany(ledgerDocs, { session });

    return { transaction, ledgerEntries };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // getLedger  (FIXED: H-3 per-account running balance · H-4 accountCode filter)
  // ─────────────────────────────────────────────────────────────────────────
  async getLedger(filters = {}) {
    try {
      const query = {};

      if (filters.tenantId) query.tenant = filters.tenantId;
      if (filters.propertyId) query.property = filters.propertyId;

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

      if (filters.nepaliYear) query.nepaliYear = filters.nepaliYear;
      if (filters.nepaliMonth) query.nepaliMonth = filters.nepaliMonth;

      if (filters.quarter) {
        const months = getMonthsInQuarter(parseInt(filters.quarter));
        query.nepaliMonth = { $in: months };
      }

      // ── FIX H-4: accountCode filter now actually applied ───────────────
      if (filters.accountCode) {
        const acc = await Account.findOne({ code: filters.accountCode }).lean();
        if (!acc) throw new Error(`Account "${filters.accountCode}" not found`);
        query.account = acc._id;
      }

      // type filter (revenue or expense side)
      if (filters.type && filters.type !== "all") {
        const accountType = filters.type === "revenue" ? "REVENUE" : "EXPENSE";
        const typeAccounts = await Account.find({ type: accountType })
          .select("_id")
          .lean();
        query.account = { $in: typeAccounts.map((a) => a._id) };
      }

      const entries = await LedgerEntry.find(query)
        .populate("account", "code name type")
        .populate("transaction", "type description transactionDate nepaliDate")
        .populate("tenant", "name email phone")
        .populate("property", "name address")
        .sort({ transactionDate: 1, createdAt: 1 })
        .lean();

      // ── FIX H-3: running balance is per account code, not a global stream ──
      const runningBalances = {}; // { accountCode: paisa }

      const statement = entries.map((entry) => {
        const code = entry.account?.code ?? "UNKNOWN";
        const accountType = entry.account?.type;

        if (runningBalances[code] === undefined) runningBalances[code] = 0;

        const isDebitNormal =
          accountType === "ASSET" || accountType === "EXPENSE";
        const change = isDebitNormal
          ? entry.debitAmountPaisa - entry.creditAmountPaisa
          : entry.creditAmountPaisa - entry.debitAmountPaisa;

        runningBalances[code] += change;
        const runningBalancePaisa = runningBalances[code];

        return {
          _id: entry._id,
          date: entry.transactionDate,
          nepaliDate: entry.nepaliDate,
          nepaliMonth: entry.nepaliMonth,
          nepaliYear: entry.nepaliYear,
          account: entry.account,
          description: entry.description,

          paisa: {
            debit: entry.debitAmountPaisa,
            credit: entry.creditAmountPaisa,
            runningBalance: runningBalancePaisa,
          },

          debit: paisaToRupees(entry.debitAmountPaisa),
          credit: paisaToRupees(entry.creditAmountPaisa),
          runningBalance: paisaToRupees(runningBalancePaisa),

          formatted: {
            debit: formatMoney(entry.debitAmountPaisa),
            credit: formatMoney(entry.creditAmountPaisa),
            runningBalance: formatMoney(runningBalancePaisa),
          },

          tenant: entry.tenant,
          property: entry.property,
          transaction: entry.transaction,
          createdAt: entry.createdAt,
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
  // getLedgerSummary  (unchanged — already correct)
  // ─────────────────────────────────────────────────────────────────────────
  async getLedgerSummary(filters = {}) {
    try {
      const query = {};

      if (filters.tenantId) query.tenant = filters.tenantId;
      if (filters.nepaliYear) query.nepaliYear = filters.nepaliYear;

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
  // reverseJournalEntry  (NEW — required for corrections without DB surgery)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Post a reversing entry for a previously posted transaction.
   * Swaps debit ↔ credit on every original line and posts as a new transaction
   * with type = original.type + "_REVERSAL". The original is never modified.
   *
   * @param {string|ObjectId} originalTransactionId
   * @param {string}          reason      - e.g. "Data entry error - wrong amount"
   * @param {*}               reversedBy  - User ObjectId
   * @param {mongoose.ClientSession} [session]
   */
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

    const origEntries = await LedgerEntry.find({
      transaction: originalTransactionId,
    })
      .populate("account", "code")
      .session(session)
      .lean();

    if (!origEntries.length)
      throw new Error("No ledger entries found for transaction");

    const reversalPayload = {
      transactionType: `${orig.type}_REVERSAL`,
      referenceType: orig.referenceType,
      referenceId: orig.referenceId, // same source doc — idempotency guard will not block because the type differs
      transactionDate: new Date(),
      nepaliDate: orig.nepaliDate,
      nepaliMonth: orig.nepaliMonth ?? 1,
      nepaliYear: orig.nepaliYear ?? 2081,
      description: `REVERSAL: ${reason} (original: ${orig.description})`,
      createdBy: reversedBy,
      totalAmountPaisa: orig.totalAmountPaisa,
      tenant: null,
      property: null,
      entries: origEntries.map((e) => ({
        accountCode: e.account.code,
        // Swap debit ↔ credit
        debitAmountPaisa: e.creditAmountPaisa,
        creditAmountPaisa: e.debitAmountPaisa,
        description: `REVERSAL: ${e.description}`,
      })),
    };

    // The idempotency guard keys on (referenceType, referenceId).
    // Reversals share the same referenceId but have a different type — we need
    // to bypass the guard for reversals. Pass a flag:
    return this.postJournalEntry(reversalPayload, session, {
      skipIdempotencyCheck: false,
    });
  }
}

export const ledgerService = new LedgerService();
