import mongoose from "mongoose";
import { Electricity } from "./Electricity.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { Unit } from "../tenant/units/unit.model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildElectricityChargeJournal,
  buildElectricityPaymentJournal,
} from "../ledger/journal-builders/electricity.js";

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
    const electricity = await Electricity.findById(electricityId)
      .populate("tenant")
      .populate("unit")
      .session(session);

    if (!electricity) {
      throw new Error("Electricity record not found");
    }

    const payload = buildElectricityChargeJournal(electricity);
    const { transaction, ledgerEntries } = await ledgerService.postJournalEntry(
      payload,
      session,
    );

    return {
      success: true,
      message: "Electricity charge recorded in ledger",
      transaction,
      ledgerEntries,
    };
  }

  /**
   * Record electricity payment
   */
  async recordElectricityPayment(paymentData, session = null) {
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

    const payload = buildElectricityPaymentJournal(paymentData, electricity);
    const { transaction, ledgerEntries } = await ledgerService.postJournalEntry(
      payload,
      session,
    );

    return {
      success: true,
      message: "Electricity payment recorded successfully",
      electricity,
      transaction,
      ledgerEntries,
    };
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
