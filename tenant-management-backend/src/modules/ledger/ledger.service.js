import mongoose from "mongoose";
import { Account } from "./accounts/Account.Model.js";
import { Transaction } from "./transactions/Transaction.Model.js";
import { LedgerEntry } from "./ledger.model.js";
import { Rent } from "../rents/rent.Model.js";
import { getMonthsInQuarter } from "../../utils/nepaliMonthQuarter.js";
import { Cam } from "../tenant/cam/cam.model.js";
import { Sd } from "../tenant/securityDeposits/sd.model.js";
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
  async recordRentCharge(rentId, session = null) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7243715a-fe6e-4715-bc75-bad5014fb3ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ledger.service.js:35',message:'recordRentCharge called with parameters',data:{rentIdType:typeof rentId,rentIdIsObject:rentId instanceof Object,rentIdValue:rentId?.toString?.()||(JSON.stringify(rentId) ?? 'undefined').substring(0,200),sessionType:typeof session,sessionIsNull:session===null,sessionIsUndefined:typeof session==='undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    try {
     
      fetch('http://127.0.0.1:7242/ingest/7243715a-fe6e-4715-bc75-bad5014fb3ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ledger.service.js:37',message:'Before Rent.findById call',data:{rentIdType:typeof rentId,rentIdValue:rentId?.toString?.()||(JSON.stringify(rentId) ?? 'undefined').substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const rent = await Rent.findById(rentId).session(session);
      console.log(rent);
      if (!rent) {
        throw new Error("Rent not found");
      }

   
      const accountsReceivableAccount = await Account.findOne({ code: "1200" }).session(session);
      const revenueAccount = await Account.findOne({ code: "4000" }).session(session);

      if (!accountsReceivableAccount) {
        throw new Error("Account with code 1200 (Accounts Receivable) not found");
      }
      if (!revenueAccount) {
        throw new Error("Account with code 4000 (Revenue) not found");
      }

      // Create transaction
      const [transaction] = await Transaction.create(
        [
          {
            type: "RENT_CHARGE",
            transactionDate: rent.createdAt,
            nepaliDate: rent.nepaliDate,
            description: `Rent charge for ${rent.nepaliMonth} ${rent.nepaliYear}`,
            referenceType: "Rent",
            referenceId: rentId,
            totalAmount: rent.rentAmount,
            createdBy: rent.createdBy,
            status: "POSTED",
          },
        ],
        { session }
      );

      // Create ledger entries
      const ledgerEntries = [];

      // Entry 1: Debit Accounts Receivable (1200)
      const arEntry = new LedgerEntry({
        transaction: transaction._id,
        account: accountsReceivableAccount._id,
        debitAmount: rent.rentAmount,
        creditAmount: 0,
        description: `Rent receivable for ${rent.nepaliMonth} ${rent.nepaliYear}`,
        tenant: rent.tenant,
        property: rent.property,
        nepaliMonth: rent.nepaliMonth,
        nepaliYear: rent.nepaliYear,
        transactionDate: rent.createdAt,
        nepaliDate: rent.nepaliDate,
      });
      await arEntry.save({ session });
      ledgerEntries.push(arEntry);

      // Update Accounts Receivable balance (debit increases asset)
      const arBalanceChange = this.calculateBalanceChange(
        accountsReceivableAccount.type,
        rent.rentAmount, // debitAmount
        0 // creditAmount
      );
      accountsReceivableAccount.currentBalance += arBalanceChange;
      await accountsReceivableAccount.save({ session });

      // Entry 2: Credit Revenue Account (4000)
      const revenueEntry = new LedgerEntry({
        transaction: transaction._id,
        account: revenueAccount._id,
        debitAmount: 0,
        creditAmount: rent.rentAmount,
        description: `Rental income for ${rent.nepaliMonth} ${rent.nepaliYear}`,
        tenant: rent.tenant,
        property: rent.property,
        nepaliMonth: rent.nepaliMonth,
        nepaliYear: rent.nepaliYear,
        transactionDate: rent.createdAt,
        nepaliDate: rent.nepaliDate,
      });
      await revenueEntry.save({ session });
      ledgerEntries.push(revenueEntry);

      // Update Revenue balance (credit increases revenue)
      const revenueBalanceChange = this.calculateBalanceChange(
        revenueAccount.type,
        0, // debitAmount
        rent.rentAmount // creditAmount
      );
      revenueAccount.currentBalance += revenueBalanceChange;
      await revenueAccount.save({ session });

      return {
        success: true,
        message: "Rent charge recorded successfully",
        transaction: transaction,
        ledgerEntries: ledgerEntries,
      };
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7243715a-fe6e-4715-bc75-bad5014fb3ca',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ledger.service.js:82',message:'recordRentCharge error caught',data:{errorName:error.name,errorMessage:error.message,errorStack:error.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      console.error("Failed to record rent charge:", error);
      throw error; // Re-throw to let the transaction rollback
    }
  }
   /**
   * Record CAM charge
   * Called by: CAM Service when creating a CAM charge
   * DR: Accounts Receivable (1200)
   * CR: CAM Revenue (4100)
   */ 
  async recordCamCharge(camId, createdBy, session = null) {
try {
  const cam = await Cam.findById(camId).session(session);
  if (!cam) {
    throw new Error("Cam not found");
  }
  const accountsReceivableAccount = await Account.findOne({ code: "1200" }).session(session);
  const camRevenueAccount = await Account.findOne({ code: "4000" }).session(session);
  if (!accountsReceivableAccount) {
    throw new Error("Account with code 1200 (Accounts Receivable) not found");
  }
  if (!camRevenueAccount) {
    throw new Error("Account with code 4000 (CAM Revenue) not found");
  }
const [transaction] = await Transaction.create(
  [
    {
      type: "CAM_CHARGE",
      transactionDate: cam.createdAt,
      nepaliDate: cam.nepaliDate,
      description: `CAM charge for ${cam.nepaliMonth} ${cam.nepaliYear}`,
      referenceType: "Cam",
      referenceId: camId,
      totalAmount: cam.amount,
      createdBy: createdBy,
      status: "POSTED",
    },
  ],
  { session }
);
const ledgerEntries = [];
const arEntry = new LedgerEntry({
  transaction: transaction._id,
  account: accountsReceivableAccount._id,
  debitAmount: cam.amount,
  creditAmount: 0,
  description: `CAM receivable for ${cam.nepaliMonth} ${cam.nepaliYear}`,
  tenant: cam.tenant,
  property: cam.property,
  nepaliMonth: cam.nepaliMonth,
  nepaliYear: cam.nepaliYear,
  transactionDate: cam.createdAt || new Date(),
});
await arEntry.save({ session });
ledgerEntries.push(arEntry);

const arBalanceChange = this.calculateBalanceChange(
  accountsReceivableAccount.type,
  cam.amount,
  0
);
accountsReceivableAccount.currentBalance += arBalanceChange;
await accountsReceivableAccount.save({ session });

const camRevenueEntry = new LedgerEntry({
  transaction: transaction._id,
  account: camRevenueAccount._id,
  debitAmount: 0,
  creditAmount: cam.amount,
  description: `CAM income for ${cam.nepaliMonth} ${cam.nepaliYear}`,
  tenant: cam.tenant,
  property: cam.property,
  nepaliMonth: cam.nepaliMonth,
  nepaliYear: cam.nepaliYear,
  transactionDate: cam.createdAt || new Date(),
});
await camRevenueEntry.save({ session });
ledgerEntries.push(camRevenueEntry);

const camRevenueBalanceChange = this.calculateBalanceChange(
  camRevenueAccount.type,
  0,
  cam.amount
);
camRevenueAccount.currentBalance += camRevenueBalanceChange;
await camRevenueAccount.save({ session });
return {
  success: true,
  message: "CAM charge recorded successfully",
  transaction: transaction,
  ledgerEntries: ledgerEntries,
};
} catch (error) {
  console.error("Failed to record CAM charge:", error);
  throw error;
}
  }

  /**
   * Record Security Deposit receipt
   * Called by: Security Deposit Service when receiving a deposit
   * DR: Cash/Bank (1000)
   * CR: Security Deposit Liability (2100)
   */
  async recordSecurityDeposit(sdId, createdBy, session = null) {
    try {
      const sd = await Sd.findById(sdId).session(session);
      if (!sd) {
        throw new Error("Security Deposit record not found");
      }

      const cashBankAccount = await Account.findOne({ 
        code: "1000" 
      }).session(session);
      const securityDepositLiabilityAccount = await Account.findOne({ 
        code: "2100" 
      }).session(session);

      if (!cashBankAccount) {
        throw new Error("Account with code 1000 (Cash/Bank) not found");
      }
      if (!securityDepositLiabilityAccount) {
        throw new Error("Account with code 2100 (Security Deposit Liability) not found");
      }

      const [transaction] = await Transaction.create(
        [
          {
            type: "SECURITY_DEPOSIT",
            transactionDate: sd.paidDate || sd.createdAt || new Date(),
            nepaliDate: sd.nepaliDate,
            description: `Security deposit received from tenant`,
            referenceType: "SecurityDeposit",
            referenceId: sdId,
            totalAmount: sd.amount,
            createdBy: createdBy,
            status: "POSTED",
          },
        ],
        { session }
      );

      const ledgerEntries = [];

      const cashEntry = new LedgerEntry({
        transaction: transaction._id,
        account: cashBankAccount._id,
        debitAmount: sd.amount,
        creditAmount: 0,
        description: `Security deposit received`,
        tenant: sd.tenant,
        property: sd.property,
        nepaliMonth: sd.nepaliMonth,
        nepaliYear: sd.nepaliYear,
        transactionDate: sd.paidDate || sd.createdAt || new Date(),
      });
      await cashEntry.save({ session });
      ledgerEntries.push(cashEntry);

      const cashBalanceChange = this.calculateBalanceChange(
        cashBankAccount.type,
        sd.amount,
        0
      );
      cashBankAccount.currentBalance += cashBalanceChange;
      await cashBankAccount.save({ session });

      const sdLiabilityEntry = new LedgerEntry({
        transaction: transaction._id,
        account: securityDepositLiabilityAccount._id,
        debitAmount: 0,
        creditAmount: sd.amount,
        description: `Security deposit liability`,
        tenant: sd.tenant,
        property: sd.property,
        nepaliMonth: sd.nepaliMonth,
        nepaliYear: sd.nepaliYear,
        transactionDate: sd.paidDate || sd.createdAt || new Date(),
      });
      await sdLiabilityEntry.save({ session });
      ledgerEntries.push(sdLiabilityEntry);

      const sdLiabilityBalanceChange = this.calculateBalanceChange(
        securityDepositLiabilityAccount.type,
        0,
        sd.amount
      );
      securityDepositLiabilityAccount.currentBalance += sdLiabilityBalanceChange;
      await securityDepositLiabilityAccount.save({ session });

      return {
        success: true,
        message: "Security deposit recorded successfully",
        transaction: transaction,
        ledgerEntries: ledgerEntries,
      };
    } catch (error) {
      console.error("Failed to record security deposit:", error);
      throw error;
    }
  }

  async recordPayment(payment, rent, session = null) {
    try {
      // Determine the cash/bank account code based on payment method
      // Currently using bank account (1000) for all payment methods
      // TODO: Add a separate cash account (1100) in seedAccount.js if you want to track cash separately
      let cashBankAccountCode = "1000"; // Use bank account for all payment methods

      // Future: If you add a cash account (1100), uncomment this:
      // if (payment.paymentMethod === "cash") {
      //   cashBankAccountCode = "1100"; // Cash account code
      // }

      // Find accounts
      const cashBankAccount = await Account.findOne({
        code: cashBankAccountCode,
      }).session(session);
      const revenueAccount = await Account.findOne({ code: "4000" }).session(
        session
      );

      if (!cashBankAccount) {
        throw new Error(`Account with code ${cashBankAccountCode} not found`);
      }
      if (!revenueAccount) {
        throw new Error("Account with code 4000 (Revenue) not found");
      }

      // Create transaction
      const [transaction] = await Transaction.create(
        [
          {
            type: "PAYMENT_RECEIVED",
            transactionDate: payment.paymentDate,
            nepaliDate: payment.nepaliDate,
            description: `Payment received for ${rent.nepaliMonth} ${rent.nepaliYear}`,
            referenceType: "Payment",
            referenceId: payment._id,
            totalAmount: payment.amount,
            createdBy: payment.createdBy,
            status: "POSTED",
          },
        ],
        { session }
      );

      // Create ledger entries
      const ledgerEntries = [];

      // Entry 1: Debit Cash/Bank Account
      const cashBankEntry = new LedgerEntry({
        transaction: transaction._id,
        account: cashBankAccount._id,
        debitAmount: payment.amount,
        creditAmount: 0,
        description: `Payment received for ${rent.nepaliMonth} ${rent.nepaliYear}`,
        tenant: rent.tenant,
        property: rent.property,
        nepaliMonth: payment.nepaliMonth || rent.nepaliMonth,
        nepaliYear: payment.nepaliYear || rent.nepaliYear,
        transactionDate: payment.paymentDate,
      });
      await cashBankEntry.save({ session });
      ledgerEntries.push(cashBankEntry);

      // Entry 2: Credit Revenue Account (or Accounts Receivable if reducing receivable)
      // For payment, we should credit Accounts Receivable (1200) to reduce the receivable
      // and debit Cash/Bank. But if you want to record it as revenue, use 4000.
      // Let's check if there's an accounts receivable entry first
      const accountsReceivableAccount = await Account.findOne({
        code: "1200",
      }).session(session);

      if (accountsReceivableAccount) {
        // Credit Accounts Receivable to reduce the receivable
        const arEntry = new LedgerEntry({
          transaction: transaction._id,
          account: accountsReceivableAccount._id,
          debitAmount: 0,
          creditAmount: payment.amount,
          description: `Payment received for ${rent.nepaliMonth} ${rent.nepaliYear}`,
          tenant: rent.tenant,
          property: rent.property,
          nepaliMonth: payment.nepaliMonth || rent.nepaliMonth,
          nepaliYear: payment.nepaliYear || rent.nepaliYear,
          transactionDate: payment.paymentDate,
        });
        await arEntry.save({ session });
        ledgerEntries.push(arEntry);

        // Update Accounts Receivable balance (credit decreases asset)
        const arBalanceChange = this.calculateBalanceChange(
          accountsReceivableAccount.type,
          0, // debitAmount
          payment.amount // creditAmount
        );
        accountsReceivableAccount.currentBalance += arBalanceChange;
        await accountsReceivableAccount.save({ session });
      } else {
        // Fallback: Credit Revenue if AR account doesn't exist
        const revenueEntry = new LedgerEntry({
          transaction: transaction._id,
          account: revenueAccount._id,
          debitAmount: 0,
          creditAmount: payment.amount,
          description: `Payment received for ${rent.nepaliMonth} ${rent.nepaliYear}`,
          tenant: rent.tenant,
          property: rent.property,
          nepaliMonth: payment.nepaliMonth || rent.nepaliMonth,
          nepaliYear: payment.nepaliYear || rent.nepaliYear,
          transactionDate: payment.paymentDate,
        });
        await revenueEntry.save({ session });
        ledgerEntries.push(revenueEntry);

        // Update Revenue balance (credit increases revenue)
        const revenueBalanceChange = this.calculateBalanceChange(
          revenueAccount.type,
          0, // debitAmount
          payment.amount // creditAmount
        );
        revenueAccount.currentBalance += revenueBalanceChange;
        await revenueAccount.save({ session });
      }

      // Update Cash/Bank account balance (debit increases asset)
      const cashBankBalanceChange = this.calculateBalanceChange(
        cashBankAccount.type,
        payment.amount, // debitAmount
        0 // creditAmount
      );
      cashBankAccount.currentBalance += cashBankBalanceChange;
      await cashBankAccount.save({ session });

      return {
        success: true,
        message: "Payment recorded successfully",
        transaction: transaction,
        ledgerEntries: ledgerEntries,
      };
    } catch (error) {
      console.error("Failed to record payment:", error);
      throw error; // Re-throw to let the transaction rollback
    }
  }
  /**
   * Record CAM payment
   * Called by: CAM Service when receiving a CAM payment
   * DR: Cash/Bank (1000)
   * CR: Accounts Receivable (1200)
   */
  async recordCamPayment(payment, cam, session = null) {
    try {
      const cashBankAccount = await Account.findOne({
        code: "1000",
      }).session(session);
      const accountsReceivableAccount = await Account.findOne({
        code: "1200",
      }).session(session);

      if (!cashBankAccount) {
        throw new Error("Account with code 1000 (Cash/Bank) not found");
      }
      if (!accountsReceivableAccount) {
        throw new Error("Account with code 1200 (Accounts Receivable) not found");
      }

      const [transaction] = await Transaction.create(
        [
          {
            type: "CAM_PAYMENT_RECEIVED",
            transactionDate: payment.paymentDate || new Date(),
            nepaliDate: payment.nepaliDate || cam.nepaliDate,
            description: `CAM payment received for ${cam.nepaliMonth} ${cam.nepaliYear}`,
            referenceType: "CamPayment",
            referenceId: payment._id,
            totalAmount: payment.amount,
            createdBy: payment.createdBy,
            status: "POSTED",
          },
        ],
        { session }
      );

      const ledgerEntries = [];

      const cashEntry = new LedgerEntry({
        transaction: transaction._id,
        account: cashBankAccount._id,
        debitAmount: payment.amount,
        creditAmount: 0,
        description: `CAM payment received for ${cam.nepaliMonth} ${cam.nepaliYear}`,
        tenant: cam.tenant,
        property: cam.property,
        nepaliMonth: cam.nepaliMonth,
        nepaliYear: cam.nepaliYear,
        transactionDate: payment.paymentDate || new Date(),
      });
      await cashEntry.save({ session });
      ledgerEntries.push(cashEntry);

      const cashBalanceChange = this.calculateBalanceChange(
        cashBankAccount.type,
        payment.amount,
        0
      );
      cashBankAccount.currentBalance += cashBalanceChange;
      await cashBankAccount.save({ session });

      const arEntry = new LedgerEntry({
        transaction: transaction._id,
        account: accountsReceivableAccount._id,
        debitAmount: 0,
        creditAmount: payment.amount,
        description: `CAM payment received for ${cam.nepaliMonth} ${cam.nepaliYear}`,
        tenant: cam.tenant,
        property: cam.property,
        nepaliMonth: cam.nepaliMonth,
        nepaliYear: cam.nepaliYear,
        transactionDate: payment.paymentDate || new Date(),
      });
      await arEntry.save({ session });
      ledgerEntries.push(arEntry);

      const arBalanceChange = this.calculateBalanceChange(
        accountsReceivableAccount.type,
        0,
        payment.amount
      );
      accountsReceivableAccount.currentBalance += arBalanceChange;
      await accountsReceivableAccount.save({ session });

      return {
        success: true,
        message: "CAM payment recorded successfully",
        transaction: transaction,
        ledgerEntries: ledgerEntries,
      };
    } catch (error) {
      console.error("Failed to record CAM payment:", error);
      throw error;
    }
  }

  async recordRevenue(revenueData) {
    try {
      const revenue = await Revenue.create(revenueData);
      return revenue;
    } catch (error) {
      console.error("Failed to record revenue:", error);
      throw error;
    }
  }
  async createTransaction(transactionData) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const totalDebit = transactionData.entries.reduce(
        (sum, e) => sum + e.debit,
        0
      );
      const totalCredit = transactionData.entries.reduce(
        (sum, e) => sum + e.credit,
        0
      );
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(
          `Transaction doesnt balance:${totalDebit - totalCredit}`
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
        { session }
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
          { session }
        );

        ledgerEntries.push(ledgerEntry[0]);

        // Update account balance
        const balanceChange = this.calculateBalanceChange(
          account.type,
          entry.debit || 0,
          entry.credit || 0
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
        if (Array.isArray(monthsInQuarter) && monthsInQuarter.length) {
          query.nepaliMonth = { $in: monthsInQuarter };
        }
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
        runningBalance += entry.debitAmount - entry.creditAmount;
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
          createdAt: entry.createdAt
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
          netBalance: totalDebit - totalCredit
        },
        filters
      };
  }
 catch (error) {
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
      if (Array.isArray(monthsInQuarter) && monthsInQuarter.length) {
        query.nepaliMonth = { $in: monthsInQuarter };
      }
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
          entryCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "accounts",
          localField: "_id",
          foreignField: "_id",
          as: "accountDetails"
        }
      },
      {
        $unwind: "$accountDetails"
      },
      {
        $project: {
          accountCode: "$accountDetails.code",
          accountName: "$accountDetails.name",
          accountType: "$accountDetails.type",
          totalDebit: 1,
          totalCredit: 1,
          netBalance: { $subtract: ["$totalDebit", "$totalCredit"] },
          entryCount: 1
        }
      },
      {
        $sort: { accountCode: 1 }
      }
    ]);

    const grandTotal = {
      totalDebit: summary.reduce((sum, acc) => sum + acc.totalDebit, 0),
      totalCredit: summary.reduce((sum, acc) => sum + acc.totalCredit, 0),
      totalEntries: summary.reduce((sum, acc) => sum + acc.entryCount, 0)
    };

    return {
      accounts: summary,
      grandTotal,
      filters
    };
  } catch (error) {
    console.error("Failed to get ledger summary:", error);
    throw error;
  }
}




}
export const ledgerService = new LedgerService();
