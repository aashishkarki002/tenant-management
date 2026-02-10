import { Electricity } from "./Electricity.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { Unit } from "../units/Unit.Model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildElectricityChargeJournal,
  buildElectricityPaymentJournal,
} from "../ledger/journal-builders/electricity.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";

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
        session
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
          `Current reading (${data.currentReading}) cannot be less than previous reading (${previousReading})`
        );
      }

      // Calculate consumption
      const consumption = data.currentReading - previousReading;
      
      // ✅ Convert ratePerUnit to paisa if needed
      const ratePerUnitPaisa = data.ratePerUnitPaisa !== undefined
        ? data.ratePerUnitPaisa
        : (data.ratePerUnit ? rupeesToPaisa(data.ratePerUnit) : 0);
      
      // Calculate total amount in paisa: consumption * ratePerUnitPaisa
      const totalAmountPaisa = Math.round(consumption * ratePerUnitPaisa);
      const totalAmount = totalAmountPaisa / 100; // Backward compatibility

      // Create electricity record
      const electricityData = {
        tenant: data.tenantId,
        property: tenant.property,
        unit: data.unitId,
        previousReading,
        currentReading: data.currentReading,
        consumption,
        
        // ✅ Store as PAISA (integers)
        ratePerUnitPaisa: ratePerUnitPaisa,
        totalAmountPaisa: totalAmountPaisa,
        paidAmountPaisa: data.paidAmountPaisa || (data.paidAmount ? rupeesToPaisa(data.paidAmount) : 0),
        
        // Backward compatibility
        ratePerUnit: ratePerUnitPaisa / 100,
        totalAmount: totalAmount,
        paidAmount: (data.paidAmountPaisa || (data.paidAmount ? rupeesToPaisa(data.paidAmount) : 0)) / 100,
        
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
      session
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
      paymentData.electricityId
    ).session(session);

    if (!electricity) {
      throw new Error("Electricity record not found");
    }

    // Update electricity record
    // ✅ Convert payment amount to paisa if needed
    const paymentAmountPaisa = paymentData.amountPaisa !== undefined
      ? paymentData.amountPaisa
      : (paymentData.amount ? rupeesToPaisa(paymentData.amount) : 0);
    
    electricity.paidAmountPaisa += paymentAmountPaisa;
    electricity.paidAmount = electricity.paidAmountPaisa / 100; // Backward compatibility

    // ✅ Compare using paisa (integer comparison - precise!)
    if (electricity.paidAmountPaisa >= electricity.totalAmountPaisa) {
      electricity.status = "paid";
    } else if (electricity.paidAmountPaisa > 0) {
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
      session
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

      // Filter by block and/or inner block via unit lookup
      if (filters.blockId || filters.innerBlockId) {
        const unitQuery = {};
        if (filters.blockId) unitQuery.block = filters.blockId;
        if (filters.innerBlockId) unitQuery.innerBlock = filters.innerBlockId;
        const units = await Unit.find(unitQuery).select("_id").lean();
        const unitIds = units.map((u) => u._id);
        if (unitIds.length === 0) {
          query.unit = { $in: [] };
        } else {
          query.unit = { $in: unitIds };
        }
      }

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

      // ✅ Calculate totals in paisa (precise integer arithmetic)
      const totalAmountPaisa = readings.reduce(
        (sum, r) => sum + (r.totalAmountPaisa || (r.totalAmount ? rupeesToPaisa(r.totalAmount) : 0)),
        0
      );
      const totalPaidPaisa = readings.reduce(
        (sum, r) => sum + (r.paidAmountPaisa || (r.paidAmount ? rupeesToPaisa(r.paidAmount) : 0)),
        0
      );
      const totalPendingPaisa = totalAmountPaisa - totalPaidPaisa;
      
      // Convert to rupees for display (backward compatibility)
      const totalAmount = totalAmountPaisa / 100;
      const totalPaid = totalPaidPaisa / 100;
      const totalPending = totalPendingPaisa / 100;
      const totalConsumption = readings.reduce(
        (sum, r) => sum + r.consumption,
        0
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
