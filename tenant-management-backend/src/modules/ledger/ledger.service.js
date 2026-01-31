import mongoose from "mongoose";
import { Account } from "./accounts/Account.Model.js";
import { Transaction } from "./transactions/Transaction.Model.js";
import { LedgerEntry } from "./Ledger.Model.js";
import { getMonthsInQuarter } from "../../utils/nepaliMonthQuarter.js";

/**
 * @typedef {Object} JournalEntryLine
 * @property {string} accountCode
 * @property {number} debitAmount
 * @property {number} creditAmount
 * @property {string} description
 * @property {mongoose.Types.ObjectId} [tenant]
 * @property {mongoose.Types.ObjectId} [property]
 */

/**
 * @typedef {Object} JournalPayload
 * @property {string} transactionType
 * @property {string} referenceType
 * @property {mongoose.Types.ObjectId} referenceId
 * @property {Date} transactionDate
 * @property {Date} nepaliDate
 * @property {number} nepaliMonth
 * @property {number} nepaliYear
 * @property {string} description
 * @property {mongoose.Types.ObjectId} createdBy
 * @property {number} totalAmount
 * @property {JournalEntryLine[]} entries
 * @property {mongoose.Types.ObjectId} [tenant]
 * @property {mongoose.Types.ObjectId} [property]
 */

class LedgerService {
  /**
   * Calculate balance change based on account type and debit/credit amounts
   * @param {string} accountType - Account type (ASSET, LIABILITY, REVENUE, EXPENSE, EQUITY)
   * @param {number} debitAmount - Debit amount
   * @param {number} creditAmount - Credit amount
   * @returns {number} Balance change (positive or negative)
   */
  calculateBalanceChange(accountType, debitAmount, creditAmount) {
    const netAmount = debitAmount - creditAmount;

    // For ASSET and EXPENSE accounts: Debit increases, Credit decreases
    if (accountType === "ASSET" || accountType === "EXPENSE") {
      return netAmount; // Debit - Credit
    }

    // For LIABILITY, REVENUE, and EQUITY accounts: Debit decreases, Credit increases
    if (
      accountType === "LIABILITY" ||
      accountType === "REVENUE" ||
      accountType === "EQUITY"
    ) {
      return -netAmount; // Credit - Debit
    }

    // Default fallback
    return netAmount;
  }

  /**
   * Post a journal entry: create one Transaction, LedgerEntries, and update Account balances.
   * Caller must pass a valid session if running inside a transaction.
   * @param {JournalPayload} payload
   * @param {mongoose.ClientSession | null} [session=null]
   * @returns {Promise<{ transaction: import("./transactions/Transaction.Model.js").Transaction, ledgerEntries: import("./Ledger.Model.js").LedgerEntry[] }>}
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
      totalAmount,
      entries,
      tenant: payloadTenant,
      property: payloadProperty,
    } = payload;

    if (!entries?.length) {
      throw new Error("Journal payload must have at least one entry");
    }

    const totalDebit = entries.reduce((sum, e) => sum + (e.debitAmount || 0), 0);
    const totalCredit = entries.reduce(
      (sum, e) => sum + (e.creditAmount || 0),
      0,
    );
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Journal entries do not balance: debits ${totalDebit} vs credits ${totalCredit}`,
      );
    }

    const accountCodes = [...new Set(entries.map((e) => e.accountCode))];
    const accounts = await Account.find({ code: { $in: accountCodes } })
      .session(session)
      .lean();
    const accountByCode = Object.fromEntries(
      accounts.map((a) => [a.code, a]),
    );
    for (const code of accountCodes) {
      if (!accountByCode[code]) {
        throw new Error(`Account with code ${code} not found`);
      }
    }

    const [transaction] = await Transaction.create(
      [
        {
          type: transactionType,
          transactionDate,
          nepaliDate,
          description,
          referenceType,
          referenceId,
          totalAmount,
          createdBy,
          status: "POSTED",
        },
      ],
      { session },
    );

    const ledgerEntries = [];
    for (const entry of entries) {
      const account = accountByCode[entry.accountCode];
      const debitAmount = entry.debitAmount || 0;
      const creditAmount = entry.creditAmount || 0;

      const [ledgerEntry] = await LedgerEntry.create(
        [
          {
            transaction: transaction._id,
            account: account._id,
            debitAmount,
            creditAmount,
            description: entry.description,
            tenant: entry.tenant ?? payloadTenant,
            property: entry.property ?? payloadProperty,
            nepaliMonth,
            nepaliYear,
            transactionDate,
          },
        ],
        { session },
      );
      ledgerEntries.push(ledgerEntry);

      const balanceChange = this.calculateBalanceChange(
        account.type,
        debitAmount,
        creditAmount,
      );
      await Account.findByIdAndUpdate(
        account._id,
        { $inc: { currentBalance: balanceChange } },
        { session },
      ).exec();
    }

    return { transaction, ledgerEntries };
  }

  async createTransaction(transactionData) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const totalDebit = transactionData.entries.reduce(
        (sum, e) => sum + e.debit,
        0,
      );
      const totalCredit = transactionData.entries.reduce(
        (sum, e) => sum + e.credit,
        0,
      );
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(
          `Transaction doesnt balance:${totalDebit - totalCredit}`,
        );
      }
      const [transaction] = await Transaction.create(
        [
          {
            transactionDate: transactionData.transactionDate,
            nepaliDate: transactionData.nepaliDate,
            type: transactionData.type,
            description: transactionData.description,
            status: "POSTED",
            referenceType: transactionData.referenceType,
            referenceId: transactionData.referenceId,
            totalAmount: transactionData.totalAmount,
            createdBy: transactionData.createdBy,
          },
        ],
        { session },
      );
      const ledgerEntries = [];
      for (const entry of transactionData.entries) {
        const account = await Account.findOne({
          code: entry.account.code,
        }).session(session);

        if (!account) {
          throw new Error(`Account with code ${entry.account.code} not found`);
        }

        const ledgerEntry = await LedgerEntry.create(
          [
            {
              transaction: transaction._id,
              account: account._id,
              debitAmount: entry.debit,
              creditAmount: entry.credit,
              description: entry.description,
              tenant: transactionData.tenant,
              property: transactionData.property,
              nepaliMonth: transactionData.nepaliMonth,
              nepaliYear: transactionData.nepaliYear,
              transactionDate: transactionData.transactionDate,
            },
          ],
          { session },
        );

        ledgerEntries.push(ledgerEntry[0]);

        // Update account balance
        const balanceChange = this.calculateBalanceChange(
          account.type,
          entry.debit || 0,
          entry.credit || 0,
        );
        account.currentBalance += balanceChange;
        await account.save({ session });
      }

      await session.commitTransaction();

      return transactionData;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
  async getLedger(filters = {}) {
    try {
      const query = {};
      // Filter by tenant
      if (filters.tenantId) {
        query.tenant = filters.tenantId;
      }

      // Filter by property
      if (filters.propertyId) {
        query.property = filters.propertyId;
      }

      // Filter by English date range
      if (filters.startDate || filters.endDate) {
        query.transactionDate = {};
        if (filters.startDate) {
          query.transactionDate.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          query.transactionDate.$lte = end;
        }
      }

      // Filter by Nepali year
      if (filters.nepaliYear) {
        query.nepaliYear = filters.nepaliYear;
      }

      // Filter by Nepali month
      if (filters.nepaliMonth) {
        query.nepaliMonth = filters.nepaliMonth;
      }

      // Filter by quarter (needs to match any of the quarter's months)
      if (filters.quarter) {
        const monthsInQuarter = getMonthsInQuarter(parseInt(filters.quarter));
        query.nepaliMonth = { $in: monthsInQuarter };
      }
      const entries = await LedgerEntry.find(query)
        .populate("account", "code name type")
        .populate("transaction", "type description transactionDate nepaliDate")
        .populate("tenant", "name email phone")
        .populate("property", "name address")
        .sort({ transactionDate: 1, createdAt: 1 })
        .lean();
      let runningBalance = 0;
      const statement = entries.map((entry) => {
        // Calculate balance change based on account type
        // For ASSET and EXPENSE: Debit increases, Credit decreases (Debit - Credit)
        // For LIABILITY, REVENUE, EQUITY: Credit increases, Debit decreases (Credit - Debit)
        const accountType = entry.account?.type;
        let balanceChange;

        if (accountType === "ASSET" || accountType === "EXPENSE") {
          balanceChange = entry.debitAmount - entry.creditAmount;
        } else if (
          accountType === "LIABILITY" ||
          accountType === "REVENUE" ||
          accountType === "EQUITY"
        ) {
          balanceChange = entry.creditAmount - entry.debitAmount;
        } else {
          // Fallback for unknown account types
          balanceChange = entry.debitAmount - entry.creditAmount;
        }

        runningBalance += balanceChange;

        return {
          _id: entry._id,
          date: entry.transactionDate,
          nepaliDate: entry.nepaliDate,
          nepaliMonth: entry.nepaliMonth,
          nepaliYear: entry.nepaliYear,
          account: entry.account,
          description: entry.description,
          debit: entry.debitAmount,
          credit: entry.creditAmount,
          balance: entry.balance,
          runningBalance,
          tenant: entry.tenant,
          property: entry.property,
          transaction: entry.transaction,
          createdAt: entry.createdAt,
        };
      });
      const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
      const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);
      return {
        entries: statement,
        summary: {
          totalEntries: statement.length,
          totalDebit,
          totalCredit,
          netBalance: totalDebit - totalCredit,
        },
        filters,
      };
    } catch (error) {
      console.error("Failed to get ledger:", error);
      throw error;
    }
  }
  async getLedgerSummary(filters = {}) {
    try {
      const query = {};

      // Apply filters
      if (filters.tenantId) query.tenant = filters.tenantId;
      if (filters.nepaliYear) query.nepaliYear = filters.nepaliYear;

      if (filters.quarter) {
        const monthsInQuarter = getMonthsInQuarter(parseInt(filters.quarter));
        query.nepaliMonth = { $in: monthsInQuarter };
      }

      if (filters.startDate || filters.endDate) {
        query.transactionDate = {};
        if (filters.startDate) {
          query.transactionDate.$gte = new Date(filters.startDate);
        }
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
            totalDebit: { $sum: "$debitAmount" },
            totalCredit: { $sum: "$creditAmount" },
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
        {
          $unwind: "$accountDetails",
        },
        {
          $project: {
            accountCode: "$accountDetails.code",
            accountName: "$accountDetails.name",
            accountType: "$accountDetails.type",
            totalDebit: 1,
            totalCredit: 1,
            netBalance: { $subtract: ["$totalDebit", "$totalCredit"] },
            entryCount: 1,
          },
        },
        {
          $sort: { accountCode: 1 },
        },
      ]);

      const grandTotal = {
        totalDebit: summary.reduce((sum, acc) => sum + acc.totalDebit, 0),
        totalCredit: summary.reduce((sum, acc) => sum + acc.totalCredit, 0),
        totalEntries: summary.reduce((sum, acc) => sum + acc.entryCount, 0),
      };

      return {
        accounts: summary,
        grandTotal,
        filters,
      };
    } catch (error) {
      console.error("Failed to get ledger summary:", error);
      throw error;
    }
  }
}
export const ledgerService = new LedgerService();
