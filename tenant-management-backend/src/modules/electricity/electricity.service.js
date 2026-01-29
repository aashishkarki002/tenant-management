import mongoose from "mongoose";
import { Electricity } from "./Electricity.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { Unit } from "../tenant/units/unit.model.js";
import { Account } from "../ledger/accounts/Account.Model.js";
import { Transaction } from "../ledger/transactions/Transaction.Model.js";
import { LedgerEntry } from "../ledger/Ledger.Model.js";

class ElectricityService {
  /**
   * Get the last electricity reading for a specific unit
   * This helps determine the previous reading for the next entry
   */
  async getLastReadingForUnit(unitId, session = null) {
    const query = Electricity.findOne({ unit: unitId }).sort({
      readingDate: -1,
      createdAt: -1,
    });

    if (session) {
      query.session(session);
    }

    return await query.lean();
  }

  /**
   * Create a new electricity reading
   * Handles both regular readings and tenant transitions
   */
  async createElectricityReading(data, session = null) {
    try {
      // Validate tenant and unit
      const tenant = await Tenant.findById(data.tenantId).session(session);

      if (!tenant) {
        throw new Error("Tenant not found");
      }

      const unit = await Unit.findById(data.unitId).session(session);

      if (!unit) {
        throw new Error("Unit not found");
      }

      // Check if unit belongs to tenant
      if (!tenant.units.some((u) => u.toString() === data.unitId.toString())) {
        throw new Error("Unit does not belong to this tenant");
      }

      // Get last reading for this unit
      const lastReading = await this.getLastReadingForUnit(
        data.unitId,
        session,
      );

      let previousReading = 0;
      let isInitialReading = false;
      let isTenantTransition = false;
      let previousTenant = null;
      let previousRecord = null;

      if (lastReading) {
        // Check if the last reading was for a different tenant
        if (lastReading.tenant.toString() !== data.tenantId.toString()) {
          isTenantTransition = true;
          previousTenant = lastReading.tenant;
          previousRecord = lastReading._id;
        }

        // Use the last current reading as this previous reading
        previousReading = lastReading.currentReading;
      } else {
        // This is the very first reading for this unit
        isInitialReading = true;
        previousReading = data.previousReading || 0;
      }

      // If previousReading is provided in data, use it (for manual override)
      if (data.previousReading !== undefined && data.previousReading !== null) {
        previousReading = data.previousReading;
      }

      // Validate current reading
      if (data.currentReading < previousReading) {
        throw new Error(
          `Current reading (${data.currentReading}) cannot be less than previous reading (${previousReading})`,
        );
      }

      // Calculate consumption
      const consumption = data.currentReading - previousReading;
      const totalAmount = consumption * data.ratePerUnit;

      // Create electricity record
      const electricityData = {
        tenant: data.tenantId,
        property: tenant.property,
        unit: data.unitId,
        previousReading,
        currentReading: data.currentReading,
        consumption,
        ratePerUnit: data.ratePerUnit,
        totalAmount,
        nepaliMonth: data.nepaliMonth,
        nepaliYear: data.nepaliYear,
        nepaliDate: data.nepaliDate,
        englishMonth: data.englishMonth,
        englishYear: data.englishYear,
        readingDate: data.readingDate || new Date(),
        status: data.status || "pending",
        notes: data.notes || "",
        isInitialReading,
        isTenantTransition,
        previousTenant,
        previousRecord,
        createdBy: data.createdBy,
      };

      const [electricity] = await Electricity.create([electricityData], {
        session,
      });

      return {
        success: true,
        message: isTenantTransition
          ? "Electricity reading created with tenant transition"
          : "Electricity reading created successfully",
        data: electricity,
      };
    } catch (error) {
      console.error("Failed to create electricity reading:", error);
      throw error;
    }
  }

  /**
   * Record electricity charge in ledger
   * Creates accounting entries for electricity charges
   */
  async recordElectricityCharge(electricityId, session = null) {
    try {
      const electricity = await Electricity.findById(electricityId)
        .populate("tenant")
        .populate("unit")
        .session(session);

      if (!electricity) {
        throw new Error("Electricity record not found");
      }

      // Find accounts
      // Account 1200: Accounts Receivable (Debit)
      // Account 4100: Utility Revenue (Credit) - You may need to create this account
      const accountsReceivableAccount = await Account.findOne({
        code: "1200",
      }).session(session);

      const utilityRevenueAccount = await Account.findOne({
        code: "4100",
      }).session(session);

      if (!accountsReceivableAccount) {
        throw new Error("Accounts Receivable account (1200) not found");
      }

      if (!utilityRevenueAccount) {
        throw new Error(
          "Utility Revenue account (4100) not found. Please create it first.",
        );
      }

      // Create transaction
      const [transaction] = await Transaction.create(
        [
          {
            type: "ELECTRICITY_CHARGE",
            transactionDate: electricity.readingDate,
            nepaliDate: electricity.nepaliDate,
            description: `Electricity charge for ${electricity.nepaliMonth}/${electricity.nepaliYear} - ${electricity.consumption} units`,
            referenceType: "Electricity",
            referenceId: electricityId,
            totalAmount: electricity.totalAmount,
            createdBy: electricity.createdBy,
            status: "POSTED",
          },
        ],
        { session },
      );

      const ledgerEntries = [];

      // Entry 1: Debit Accounts Receivable
      const arEntry = new LedgerEntry({
        transaction: transaction._id,
        account: accountsReceivableAccount._id,
        debitAmount: electricity.totalAmount,
        creditAmount: 0,
        description: `Electricity receivable - ${electricity.consumption} units @ Rs.${electricity.ratePerUnit}`,
        tenant: electricity.tenant._id,
        property: electricity.property,
        nepaliMonth: electricity.nepaliMonth,
        nepaliYear: electricity.nepaliYear,
        transactionDate: electricity.readingDate,
      });
      await arEntry.save({ session });
      ledgerEntries.push(arEntry);

      // Update Accounts Receivable balance
      accountsReceivableAccount.currentBalance += electricity.totalAmount;
      await accountsReceivableAccount.save({ session });

      // Entry 2: Credit Utility Revenue
      const revenueEntry = new LedgerEntry({
        transaction: transaction._id,
        account: utilityRevenueAccount._id,
        debitAmount: 0,
        creditAmount: electricity.totalAmount,
        description: `Electricity revenue - ${electricity.consumption} units @ Rs.${electricity.ratePerUnit}`,
        tenant: electricity.tenant._id,
        property: electricity.property,
        nepaliMonth: electricity.nepaliMonth,
        nepaliYear: electricity.nepaliYear,
        transactionDate: electricity.readingDate,
      });
      await revenueEntry.save({ session });
      ledgerEntries.push(revenueEntry);

      // Update Utility Revenue balance
      utilityRevenueAccount.currentBalance += electricity.totalAmount;
      await utilityRevenueAccount.save({ session });

      return {
        success: true,
        message: "Electricity charge recorded in ledger",
        transaction,
        ledgerEntries,
      };
    } catch (error) {
      console.error("Failed to record electricity charge:", error);
      throw error;
    }
  }

  /**
   * Record electricity payment
   */
  async recordElectricityPayment(paymentData, session = null) {
    try {
      const electricity = await Electricity.findById(
        paymentData.electricityId,
      ).session(session);

      if (!electricity) {
        throw new Error("Electricity record not found");
      }

      // Update electricity record
      electricity.paidAmount += paymentData.amount;

      if (electricity.paidAmount >= electricity.totalAmount) {
        electricity.status = "paid";
      } else if (electricity.paidAmount > 0) {
        electricity.status = "partially_paid";
      }

      electricity.paidDate = paymentData.paymentDate || new Date();

      // Add receipt image if provided
      if (paymentData.receipt) {
        electricity.receipt = {
          url: paymentData.receipt,
          publicId: paymentData.publicId,
          generatedAt: new Date(),
        };
      }

      await electricity.save({ session });

      // Record in ledger (similar to rent payment)
      const cashBankAccount = await Account.findOne({ code: "1000" }).session(
        session,
      );

      const accountsReceivableAccount = await Account.findOne({
        code: "1200",
      }).session(session);

      if (!cashBankAccount || !accountsReceivableAccount) {
        throw new Error("Required accounts not found");
      }

      // Create transaction
      const [transaction] = await Transaction.create(
        [
          {
            type: "ELECTRICITY_PAYMENT",
            transactionDate: paymentData.paymentDate || new Date(),
            nepaliDate: paymentData.nepaliDate,
            description: `Electricity payment - ${electricity.nepaliMonth}/${electricity.nepaliYear}`,
            referenceType: "Electricity",
            referenceId: paymentData.electricityId,
            totalAmount: paymentData.amount,
            createdBy: paymentData.createdBy,
            status: "POSTED",
          },
        ],
        { session },
      );

      const ledgerEntries = [];

      // Debit Cash/Bank
      const cashEntry = new LedgerEntry({
        transaction: transaction._id,
        account: cashBankAccount._id,
        debitAmount: paymentData.amount,
        creditAmount: 0,
        description: `Electricity payment received`,
        tenant: electricity.tenant,
        property: electricity.property,
        nepaliMonth: electricity.nepaliMonth,
        nepaliYear: electricity.nepaliYear,
        transactionDate: paymentData.paymentDate || new Date(),
      });
      await cashEntry.save({ session });
      ledgerEntries.push(cashEntry);

      cashBankAccount.currentBalance += paymentData.amount;
      await cashBankAccount.save({ session });

      // Credit Accounts Receivable
      const arEntry = new LedgerEntry({
        transaction: transaction._id,
        account: accountsReceivableAccount._id,
        debitAmount: 0,
        creditAmount: paymentData.amount,
        description: `Electricity payment received`,
        tenant: electricity.tenant,
        property: electricity.property,
        nepaliMonth: electricity.nepaliMonth,
        nepaliYear: electricity.nepaliYear,
        transactionDate: paymentData.paymentDate || new Date(),
      });
      await arEntry.save({ session });
      ledgerEntries.push(arEntry);

      accountsReceivableAccount.currentBalance -= paymentData.amount;
      await accountsReceivableAccount.save({ session });

      return {
        success: true,
        message: "Electricity payment recorded successfully",
        electricity,
        transaction,
        ledgerEntries,
      };
    } catch (error) {
      console.error("Failed to record electricity payment:", error);
      throw error;
    }
  }

  /**
   * Get electricity readings with filters
   */
  async getElectricityReadings(filters = {}) {
    try {
      const query = {};

      if (filters.tenantId) query.tenant = filters.tenantId;
      if (filters.unitId) query.unit = filters.unitId;
      if (filters.propertyId) query.property = filters.propertyId;
      if (filters.nepaliYear) query.nepaliYear = filters.nepaliYear;
      if (filters.nepaliMonth) query.nepaliMonth = filters.nepaliMonth;
      if (filters.status) query.status = filters.status;

      if (filters.startDate || filters.endDate) {
        query.readingDate = {};
        if (filters.startDate) {
          query.readingDate.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          query.readingDate.$lte = end;
        }
      }

      const readings = await Electricity.find(query)
        .populate("tenant", "name email phone")
        .populate("unit", "name")
        .populate("property", "name address")
        .populate("previousTenant", "name")
        .sort({ readingDate: -1, createdAt: -1 })
        .lean();

      const totalAmount = readings.reduce((sum, r) => sum + r.totalAmount, 0);
      const totalPaid = readings.reduce((sum, r) => sum + r.paidAmount, 0);
      const totalPending = totalAmount - totalPaid;
      const totalConsumption = readings.reduce(
        (sum, r) => sum + r.consumption,
        0,
      );

      const averageConsumption =
        readings.length > 0 ? totalConsumption / readings.length : 0;

      return {
        success: true,
        data: {
          readings,
          summary: {
            totalReadings: readings.length,
            totalConsumption,
            totalAmount,
            totalPaid,
            totalPending,
            averageConsumption,
          },
        },
      };
    } catch (error) {
      console.error("Failed to get electricity readings:", error);
      throw error;
    }
  }

  /**
   * Get consumption history for a unit (useful for tracking across tenant changes)
   */
  async getUnitConsumptionHistory(unitId, limit = 12) {
    try {
      const history = await Electricity.find({ unit: unitId })
        .populate("tenant", "name")
        .sort({ readingDate: -1 })
        .limit(limit)
        .lean();

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      console.error("Failed to get unit consumption history:", error);
      throw error;
    }
  }
}

export const electricityService = new ElectricityService();
