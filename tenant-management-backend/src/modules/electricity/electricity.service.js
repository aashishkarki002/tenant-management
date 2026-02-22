/**
 * electricity.service.js — updated
 *
 * Key changes vs original:
 *   1. createElectricityReading now auto-resolves ratePerUnitPaisa from the
 *      owner's ElectricityRate config. A passed-in ratePerUnit is ignored
 *      (callers no longer need to supply it).
 *   2. Revenue note: recordElectricityCharge posts to an INCOME account
 *      (Electricity Revenue) owned by the property. The journal builder
 *      is responsible for the CR side — see comments below.
 *   3. setPropertyRate / getPropertyRate let the owner manage rates.
 *   4. getPropertyRate now exposes the "unit" per-type override so the
 *      dashboard can display and the rate dialog can pre-populate it.
 */

import mongoose from "mongoose";
import { Electricity } from "./Electricity.Model.js";
import { ElectricityRate } from "./ElectricityRate.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { Unit } from "../units/Unit.Model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildElectricityChargeJournal,
  buildElectricityPaymentJournal,
} from "../ledger/journal-builders/electricity.js";
import { Revenue } from "../revenue/Revenue.Model.js";
import { RevenueSource } from "../revenue/RevenueSource.Model.js";
import { applyPaymentToBank } from "../banks/bank.domain.js";
import {
  rupeesToPaisa,
  paisaToRupees,
  formatMoney,
} from "../../utils/moneyUtil.js";

class ElectricityService {
  // ─────────────────────────────────────────────────────────────────────────
  // RATE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the current rate config for a property.
   * Returns the full document (currentRate + history + per-type overrides).
   *
   * meterTypeRates now includes "unit" so the dashboard can show the
   * tenant-billed unit rate separately from sub-meter rates.
   */
  async getPropertyRate(propertyId) {
    const config = await ElectricityRate.findOne({ property: propertyId })
      .populate("rateHistory.setBy", "name email")
      .lean();

    if (!config) {
      return { configured: false, currentRatePerUnit: null, rateHistory: [] };
    }

    return {
      configured: true,
      currentRatePerUnit: config.currentRatePerUnitPaisa / 100,
      currentRatePerUnitPaisa: config.currentRatePerUnitPaisa,
      // All four meter-type overrides exposed (null = falls back to default)
      meterTypeRates: {
        unit: config.meterTypeRates?.unit
          ? config.meterTypeRates.unit / 100
          : null,
        common_area: config.meterTypeRates?.common_area
          ? config.meterTypeRates.common_area / 100
          : null,
        parking: config.meterTypeRates?.parking
          ? config.meterTypeRates.parking / 100
          : null,
        sub_meter: config.meterTypeRates?.sub_meter
          ? config.meterTypeRates.sub_meter / 100
          : null,
      },
      rateHistory: (config.rateHistory ?? []).map((h) => ({
        ...h,
        ratePerUnit: h.ratePerUnitPaisa / 100,
      })),
    };
  }

  /**
   * Set (or update) the rate for a property.
   * Appends to rateHistory — existing entries are never modified.
   *
   * @param {string}  propertyId
   * @param {number}  ratePerUnit        - in rupees (e.g. 12.50)
   * @param {string}  setBy              - admin id
   * @param {string}  [note]             - reason / reference (e.g. "NEA tariff Q1 2082")
   * @param {Object}  [meterTypeRates]   - { unit, common_area, parking, sub_meter } in rupees
   *                                       Pass null/undefined for a type to clear its override.
   */
  async setPropertyRate(
    propertyId,
    ratePerUnit,
    setBy,
    note = "",
    meterTypeRates = {},
  ) {
    const ratePerUnitPaisa = rupeesToPaisa(ratePerUnit);

    if (!Number.isInteger(ratePerUnitPaisa) || ratePerUnitPaisa < 1) {
      throw new Error(
        "Rate must be a positive value (e.g. 12.50 rupees per kWh).",
      );
    }

    const newEntry = {
      ratePerUnitPaisa,
      effectiveFrom: new Date(),
      effectiveTo: null,
      note,
      setBy,
    };

    // Convert supplied rupee overrides to paisa. Supported types include "unit".
    const SUPPORTED_TYPES = ["unit", "common_area", "parking", "sub_meter"];
    const meterTypeRatesPaisa = {};

    for (const type of SUPPORTED_TYPES) {
      const val = meterTypeRates[type];
      if (val != null && val !== "" && parseFloat(val) > 0) {
        const paisa = rupeesToPaisa(parseFloat(val));
        if (!Number.isInteger(paisa))
          throw new Error(`Invalid rate for meter type "${type}"`);
        meterTypeRatesPaisa[type] = paisa;
      } else if (type in meterTypeRates) {
        // Explicitly passed null / empty string → clear the override
        meterTypeRatesPaisa[type] = null;
      }
    }

    const config = await ElectricityRate.findOne({ property: propertyId });

    if (config) {
      // Close out the previous active entry
      const prev = config.rateHistory.find((h) => h.effectiveTo === null);
      if (prev) prev.effectiveTo = new Date();

      config.currentRatePerUnitPaisa = ratePerUnitPaisa;

      // Merge overrides — only update keys that were explicitly supplied
      const existing = config.meterTypeRates.toObject?.() ?? {
        ...config.meterTypeRates,
      };
      config.meterTypeRates = { ...existing, ...meterTypeRatesPaisa };

      config.rateHistory.push(newEntry);
      await config.save();
    } else {
      await ElectricityRate.create({
        property: propertyId,
        currentRatePerUnitPaisa: ratePerUnitPaisa,
        meterTypeRates: meterTypeRatesPaisa,
        rateHistory: [newEntry],
      });
    }

    return { success: true, ratePerUnit, ratePerUnitPaisa };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READINGS
  // ─────────────────────────────────────────────────────────────────────────

  async getLastReadingForUnit(unitId, session = null) {
    const query = Electricity.findOne({ unit: unitId }).sort({
      readingDate: -1,
      createdAt: -1,
    });
    if (session) query.session(session);
    return await query.lean();
  }

  /**
   * Create a new electricity reading.
   *
   * Rate is resolved automatically from the owner's ElectricityRate config.
   * For unit (tenant) readings, the "unit" per-type override is checked first,
   * then falls back to the property default.
   *
   * Revenue accounting (handled by buildElectricityChargeJournal):
   *   DR  Tenant Receivable (asset ↑)
   *   CR  Electricity Revenue – [Property]  (income ↑ → owner's revenue)
   */
  async createElectricityReading(data, session = null) {
    const isUnitMeter = data.meterType === "unit";

    // ── Branch 1: Unit (tenant-billed or vacant) ───────────────────────────────
    if (isUnitMeter) {
      const unit = await Unit.findById(data.unitId).session(session);
      if (!unit) throw new Error("Unit not found");

      // Resolve tenantId from request or from unit's current lease
      const tenantIdResolved =
        data.tenantId ??
        unit.currentLease?.tenant?.toString?.() ??
        unit.currentLease?.tenant ??
        null;

      // Pre-declare transition flags — they may be set during tenant resolution
      // (stale-ref path) OR during last-reading comparison below.
      let isTenantTransition = false;
      let previousTenant = null;

      // ── Tenant resolution with transition support ─────────────────────────────
      // A tenantId may be supplied but point to a tenant who has already moved
      // out (their doc was deleted or reassigned). In that case we look up the
      // unit's CURRENT active tenant and mark this reading as a transition.
      let tenant = null;
      if (tenantIdResolved) {
        tenant = await Tenant.findById(tenantIdResolved).session(session);

        if (!tenant) {
          // Supplied tenantId not found — stale reference (tenant moved out).
          // Try to find whoever is currently occupying this unit instead.
          console.warn(
            `Tenant _id="${tenantIdResolved}" not found — likely moved out. ` +
              `Looking up current occupant of unit ${data.unitId}.`,
          );
          const currentOccupant = await Tenant.findOne({
            units: data.unitId,
            isActive: true,
          }).session(session);

          if (currentOccupant) {
            console.log(
              `Found current occupant: ${currentOccupant._id} — ` +
                `flagging as tenant transition.`,
            );
            // Keep the stale id as previousTenant; new tenant is currentOccupant
            isTenantTransition = true;
            previousTenant = tenantIdResolved; // the moved-out tenant's id
            tenant = currentOccupant;
          } else {
            // Unit is vacant — no active tenant found.
            console.warn(
              `No active tenant found for unit ${data.unitId}. ` +
                `Recording as vacant-unit reading.`,
            );
            tenant = null;
          }
        }
        // NOTE: We intentionally skip the strict tenant.units ownership check.
        // The Unit↔Tenant relationship is authoritative on the Tenant.units array,
        // but during a transition the old tenant has already been removed and the
        // new tenant may not yet have this unit in their array.
      }
      const effectiveTenantId = tenant?._id ?? null;

      // Resolve previous reading from the unit's history
      const lastReading = await this.getLastReadingForUnit(
        data.unitId,
        session,
      );
      let previousReading = 0;
      let isInitialReading = false;
      // isTenantTransition / previousTenant may already be set above (stale-ref path).
      // Only reset them here if they haven't been set yet.
      let previousRecord = null;

      if (lastReading) {
        const lastTenantId = lastReading.tenant?.toString?.() ?? null;
        // Detect transition from last reading: different tenant, or moving from
        // a tenanted reading to a vacant one and vice-versa.
        if (!isTenantTransition) {
          if (
            effectiveTenantId &&
            lastTenantId &&
            lastTenantId !== effectiveTenantId.toString()
          ) {
            isTenantTransition = true;
            previousTenant = lastReading.tenant;
          } else if (!effectiveTenantId && lastTenantId) {
            isTenantTransition = true;
            previousTenant = lastReading.tenant;
          }
        }
        previousRecord = lastReading._id;
        previousReading = lastReading.currentReading;
      } else {
        isInitialReading = true;
        previousReading = data.previousReading ?? 0;
      }

      if (data.previousReading != null) previousReading = data.previousReading;

      if (data.currentReading < previousReading) {
        throw new Error(
          `Current reading (${data.currentReading}) cannot be less than previous reading (${previousReading})`,
        );
      }

      // Resolve rate (use unit's property when no tenant)
      const ratePerUnitPaisa = await ElectricityRate.resolveRate(
        tenant?.property ?? unit.property,
        "unit",
      );

      const [electricity] = await Electricity.create(
        [
          {
            meterType: "unit",
            tenant: effectiveTenantId,
            unit: data.unitId,
            property: data.propertyId ?? unit.property,
            subMeter: null,
            previousReading,
            currentReading: data.currentReading,
            consumption: data.currentReading - previousReading, // pre-save also recalculates
            ratePerUnitPaisa,
            totalAmountPaisa: Math.round(
              (data.currentReading - previousReading) * ratePerUnitPaisa,
            ),
            paidAmountPaisa: 0,
            nepaliMonth: data.nepaliMonth,
            nepaliYear: data.nepaliYear,
            nepaliDate: data.nepaliDate,
            englishMonth: data.englishMonth,
            englishYear: data.englishYear,
            readingDate: data.readingDate,
            isInitialReading,
            isTenantTransition,
            previousTenant,
            previousRecord,
            notes: data.notes ?? "",
            createdBy: data.createdBy,
          },
        ],
        { session },
      );

      // NOTE: Revenue is intentionally NOT recorded here.
      // Revenue and payment records are created only when the user
      // explicitly records a payment via recordElectricityPayment().
      // Creating a reading merely establishes the charge (accounts receivable);
      // it does not represent cash received.

      return {
        success: true,
        message: isTenantTransition
          ? "Electricity reading created with tenant transition"
          : "Electricity reading created successfully",
        data: electricity,
      };
    }

    // ── Branch 2: Sub-meter (property-billed) ─────────────────────────────────
    // No tenant or unit involved. Rate resolved from meterType-specific override.
    const { SubMeter } = await import("./SubMeter.Model.js");

    const subMeter = await SubMeter.findById(data.subMeterId).session(session);
    if (!subMeter) throw new Error("Sub-meter not found");
    if (!subMeter.isActive) throw new Error("Sub-meter is deactivated");

    // Resolve previous reading from sub-meter history
    const lastReading = await Electricity.getLastReading(
      "subMeter",
      data.subMeterId,
      session,
    );
    let previousReading = lastReading
      ? lastReading.currentReading
      : (data.previousReading ?? 0);
    if (data.previousReading != null) previousReading = data.previousReading;

    if (data.currentReading < previousReading) {
      throw new Error(
        `Current reading (${data.currentReading}) cannot be less than previous reading (${previousReading})`,
      );
    }

    // Rate is resolved from the meter-type override (e.g. common_area, parking, sub_meter)
    const ratePerUnitPaisa = await ElectricityRate.resolveRate(
      data.propertyId,
      data.meterType,
    );

    const [electricity] = await Electricity.create(
      [
        {
          meterType: data.meterType,
          billTo: "property",
          tenant: null,
          unit: null,
          subMeter: data.subMeterId,
          property: data.propertyId,
          previousReading,
          currentReading: data.currentReading,
          consumption: data.currentReading - previousReading,
          ratePerUnitPaisa,
          totalAmountPaisa: Math.round(
            (data.currentReading - previousReading) * ratePerUnitPaisa,
          ),
          paidAmountPaisa: 0,
          nepaliMonth: data.nepaliMonth,
          nepaliYear: data.nepaliYear,
          nepaliDate: data.nepaliDate,
          englishMonth: data.englishMonth,
          englishYear: data.englishYear,
          readingDate: data.readingDate,
          notes: data.notes ?? "",
          createdBy: data.createdBy,
        },
      ],
      { session },
    );

    // Optionally sync lastReading on the SubMeter document for dashboard display
    await SubMeter.findByIdAndUpdate(data.subMeterId, {
      "lastReading.value": data.currentReading,
      "lastReading.readingDate": data.readingDate,
      "lastReading.recordId": electricity._id,
    }).session(session);

    return {
      success: true,
      message: "Sub-meter electricity reading created successfully",
      data: electricity,
    };
  }

  /**
   * Record electricity charge in ledger.
   *
   * This posts electricity as REVENUE for the property owner.
   * The journal builder (buildElectricityChargeJournal) must produce:
   *   DR  accounts_receivable   (tenant owes money)
   *   CR  electricity_revenue   (income account — owner earns revenue)
   *
   * This is the correct treatment: electricity is a utility income stream,
   * not a contra-expense. The owner buys bulk from NEA and resells per-unit.
   */
  async recordElectricityCharge(electricityId, session = null) {
    const electricity = await Electricity.findById(electricityId)
      .populate("tenant")
      .populate("unit")
      .session(session);

    if (!electricity) throw new Error("Electricity record not found");

    const payload = buildElectricityChargeJournal(electricity);
    const { transaction, ledgerEntries } = await ledgerService.postJournalEntry(
      payload,
      session,
    );

    return { success: true, transaction, ledgerEntries };
  }

  /**
   * Record electricity payment.
   *
   * Mirrors the rent payment flow:
   *   1. Update Electricity document (paidAmountPaisa, status, paidDate)
   *   2. Post double-entry journal  →  DR Cash/Bank  |  CR Accounts Receivable
   *   3. Create a Revenue record so the accounting dashboard includes it
   *   4. Increment BankAccount.balance for bank_transfer / cheque payments
   *
   * @param {Object} paymentData - { electricityId, amountPaisa|amount, paymentDate,
   *   nepaliDate, createdBy, paymentMethod, bankAccountId, receipt?, publicId? }
   * @param {Object|null} session - Mongoose session for transactions
   */
  async recordElectricityPayment(paymentData, session = null) {
    // ── 1. Load electricity record ───────────────────────────────────────────
    // Load with populate for display, but also get raw tenant ID for revenue creation
    const electricity = await Electricity.findById(paymentData.electricityId)
      .populate("tenant", "name")
      .populate("property", "name")
      .session(session);

    if (!electricity) throw new Error("Electricity record not found");

    // Get raw tenant ID from document (works whether populated or not)
    // Use get() with getters: false to get the raw ObjectId value
    const rawTenantId = electricity.get("tenant", null, { getters: false });

    const paymentAmountPaisa =
      paymentData.amountPaisa ?? rupeesToPaisa(paymentData.amount);

    const newPaidPaisa = electricity.paidAmountPaisa + paymentAmountPaisa;
    if (newPaidPaisa > electricity.totalAmountPaisa) {
      throw new Error(
        `Payment of Rs ${paymentAmountPaisa / 100} exceeds remaining due ` +
          `Rs ${(electricity.totalAmountPaisa - electricity.paidAmountPaisa) / 100}`,
      );
    }

    // ── 2. Update electricity record ─────────────────────────────────────────
    electricity.paidAmountPaisa = newPaidPaisa;
    electricity.status =
      electricity.paidAmountPaisa >= electricity.totalAmountPaisa
        ? "paid"
        : "partially_paid";
    electricity.paidDate = paymentData.paymentDate ?? new Date();

    if (paymentData.receipt) {
      electricity.receipt = {
        url: paymentData.receipt,
        publicId: paymentData.publicId,
        generatedAt: new Date(),
      };
    }

    await electricity.save({ session });

    // ── 3. Post double-entry journal  (DR Cash/Bank | CR AR) ─────────────────
    // Use buildElectricityPaymentJournal — NOT the rent-specific builder.
    const journalPayload = buildElectricityPaymentJournal(
      paymentData,
      electricity,
    );

    const { transaction, ledgerEntries } = await ledgerService.postJournalEntry(
      journalPayload,
      session,
    );

    // ── 4. Create Revenue record (only for tenant-billed charges) ─────────────
    // Property-billed charges (common_area, parking, sub_meter) are expenses,
    // not revenue, so we only create Revenue records for tenant payments.
    // Use rawTenantId extracted earlier (works whether tenant is populated or not)
    const tenantId = rawTenantId;

    // Only create revenue for unit meter types (tenant-billed)
    if (electricity.meterType === "unit" && tenantId) {
      try {
        // Mirrors how rent payments write to Revenue so accounting_service.js
        // aggregates electricity income alongside rent/CAM revenue.
        // Resolve (or lazily create) the UTILITY revenue source.
        let utilitySource = await RevenueSource.findOne({
          code: "UTILITY",
        }).session(session);
        if (!utilitySource) {
          // Auto-create so the system is self-healing on first run
          [utilitySource] = await RevenueSource.create(
            [{ code: "UTILITY", name: "Electricity / Utility" }],
            { session },
          );
        }

        // Ensure tenantId is an ObjectId instance (handle string IDs)
        const tenantObjectId =
          tenantId instanceof mongoose.Types.ObjectId
            ? tenantId
            : new mongoose.Types.ObjectId(tenantId);

        const revenueData = {
          source: utilitySource._id,
          amountPaisa: paymentAmountPaisa,
          date: paymentData.paymentDate ?? new Date(),
          payerType: "TENANT",
          tenant: tenantObjectId,
          referenceType: "ELECTRICITY",
          referenceId: electricity._id,
          createdBy: paymentData.createdBy,
          notes: `Electricity payment – ${electricity.nepaliMonth}/${electricity.nepaliYear}`,
        };

        const [revenue] = await Revenue.create([revenueData], { session });

        // Log for debugging
        console.log("✅ Revenue created for electricity payment:", {
          revenueId: revenue._id,
          amountPaisa: paymentAmountPaisa,
          tenantId: tenantObjectId.toString(),
          electricityId: electricity._id.toString(),
        });
      } catch (error) {
        // Log error but don't fail the transaction - revenue creation is important but shouldn't block payment
        console.error(
          "❌ Failed to create revenue record for electricity payment:",
          {
            error: error.message,
            electricityId: electricity._id.toString(),
            tenantId: tenantId?.toString(),
            stack: error.stack,
          },
        );
        // Re-throw to abort transaction if revenue creation fails
        throw error;
      }
    } else if (electricity.meterType === "unit" && !tenantId) {
      // Log warning if unit meter type but no tenant found
      console.warn(
        "⚠️ Warning: Unit meter type electricity payment but no tenant found:",
        {
          electricityId: electricity._id.toString(),
          meterType: electricity.meterType,
          tenant: electricity.tenant,
        },
      );
    }

    // ── 5. Update bank account balance ───────────────────────────────────────
    // Only for bank_transfer and cheque — cash doesn't track a BankAccount doc.
    // Delegates to bank.domain — handles method validation, account lookup,
    // and balancePaisa increment. Returns null for cash (no-op).
    // Default to "bank_transfer" if payment method not provided, but only if bankAccountId exists
    // Otherwise default to "cash" to avoid requiring bank account
    const bankAccountId = paymentData.bankAccountId ?? paymentData.bankAccount;
    const paymentMethod =
      paymentData.paymentMethod || (bankAccountId ? "bank_transfer" : "cash");

    await applyPaymentToBank({
      paymentMethod,
      bankAccountId,
      amountPaisa: paymentAmountPaisa,
      session,
    });

    return {
      success: true,
      electricity,
      transaction,
      ledgerEntries,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUERIES (unchanged from original, kept for completeness)
  // ─────────────────────────────────────────────────────────────────────────

  async getElectricityReadings(filters = {}) {
    const query = {};

    // Basic filters
    if (filters.tenantId) query.tenant = filters.tenantId;
    if (filters.unitId) query.unit = filters.unitId;
    if (filters.propertyId) query.property = filters.propertyId;
    if (filters.nepaliYear) query.nepaliYear = filters.nepaliYear;
    if (filters.nepaliMonth) query.nepaliMonth = filters.nepaliMonth;
    if (filters.status && filters.status !== "all") {
      query.status = filters.status;
    }

    /**
     * BLOCK / INNER BLOCK FILTER
     * Ignore when blockId === "all"
     */
    if (
      (filters.blockId && filters.blockId !== "all") ||
      filters.innerBlockId
    ) {
      const unitQuery = {};

      if (filters.blockId && filters.blockId !== "all") {
        unitQuery.block = filters.blockId;
      }

      if (filters.innerBlockId) {
        unitQuery.innerBlock = filters.innerBlockId;
      }

      const units = await Unit.find(unitQuery).select("_id").lean();
      const unitIds = units.map((u) => u._id);

      query.$or = [
        {
          meterType: "unit",
          unit: unitIds.length ? { $in: unitIds } : { $in: [] },
        },
        { meterType: { $in: ["common_area", "parking", "sub_meter"] } },
      ];
    }

    /**
     * DATE RANGE FILTER
     */
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
      .populate({
        path: "unit",
        select: "name unitName type",
        populate: [
          { path: "block", select: "name" },
          { path: "innerBlock", select: "name" },
        ],
      })
      .populate("property", "name address")
      .populate("previousTenant", "name")
      .sort({ readingDate: -1, createdAt: -1 });

    const readingsForResponse = readings.map((r) =>
      r.toObject({ virtuals: true }),
    );

    // ── Group by meterType ────────────────────────────────────────────────────
    const METER_TYPES = ["unit", "common_area", "parking", "sub_meter"];

    const grouped = Object.fromEntries(
      METER_TYPES.map((type) => {
        const bucket = readingsForResponse.filter((r) => r.meterType === type);
        const totalAmountPaisa = bucket.reduce(
          (s, r) => s + (r.totalAmountPaisa ?? 0),
          0,
        );
        const totalUnits = bucket.reduce((s, r) => s + (r.consumption ?? 0), 0); // ← key fix
        return [
          type,
          {
            readings: bucket,
            totalAmount: paisaToRupees(totalAmountPaisa),
            totalUnits, // consumption in kWh
            count: bucket.length,
          },
        ];
      }),
    );

    // ✅ Use readingsForResponse — plain objects with virtuals already resolved
    const totalAmountPaisa = readingsForResponse.reduce(
      (s, r) => s + (r.totalAmountPaisa ?? 0),
      0,
    );
    const totalPaidPaisa = readingsForResponse.reduce(
      (s, r) => s + (r.paidAmountPaisa ?? 0),
      0,
    );
    const grandTotalUnits = readingsForResponse.reduce(
      (s, r) => s + (r.consumption ?? 0),
      0,
    );

    return {
      success: true,
      data: {
        grouped, // ← new: what ElectricitySummaryCards needs
        readings: readingsForResponse, // keep for any table views
        summary: {
          totalReadings: readings.length,
          grandTotalUnits,
          grandTotalAmount: paisaToRupees(totalAmountPaisa),
          totalConsumption: grandTotalUnits, // alias for backward compat
          totalAmount: paisaToRupees(totalAmountPaisa),
          totalPaid: paisaToRupees(totalPaidPaisa),
          totalPending: paisaToRupees(
            Math.max(0, totalAmountPaisa - totalPaidPaisa),
          ),
          averageConsumption: readings.length
            ? grandTotalUnits / readings.length
            : 0,
          formatted: {
            totalAmount: formatMoney(totalAmountPaisa),
            totalPaid: formatMoney(totalPaidPaisa),
            totalPending: formatMoney(
              Math.max(0, totalAmountPaisa - totalPaidPaisa),
            ),
          },
        },
      },
    };
  }

  async getUnitConsumptionHistory(unitId, limit = 12) {
    const history = await Electricity.find({ unit: unitId })
      .populate("tenant", "name")
      .sort({ readingDate: -1 })
      .limit(limit);

    const historyForResponse = history.map((doc) =>
      doc.toObject({ virtuals: true }),
    );
    return { success: true, data: historyForResponse };
  }
}

export const electricityService = new ElectricityService();
