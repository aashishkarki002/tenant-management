/**
 * electricity.service.js — updated
 *
 * Key changes:
 *   1. createElectricityReading resolves BOTH customRate and neaRate from
 *      ElectricityRate.resolveRates(). Both are snapshotted on the reading doc.
 *   2. recordElectricityCharge posts TWO journal entries:
 *        DR  Accounts Receivable  |  CR  Electricity Revenue   (tenant charge)
 *        DR  NEA Payable Expense  |  CR  NEA Payable            (owner's NEA cost)
 *      Margin (Rs 500 on a Rs 2000/Rs 1500 example) shows cleanly in P&L.
 *   3. setPropertyRate now accepts neaRatePerUnit in addition to customRatePerUnit.
 *   4. getPropertyRate exposes both rates + margin.
 *   5. Fixed: updateElectricityReading must use ratePerUnitPaisa not ratePerUnit
 *      (ratePerUnit is a read-only virtual — setting it has no effect).
 *   6. recordElectricityCharge checks totalAmountPaisa (not totalAmount virtual)
 *      for the > 0 guard, which is safe whether doc is lean or not.
 */

import mongoose from "mongoose";
import { Electricity } from "./Electricity.Model.js";
import { ElectricityRate } from "./ElectricityRate.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { Unit } from "../units/unit.model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildElectricityChargeJournal,
  buildElectricityPaymentJournal,
  buildElectricityNeaCostJournal,
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
   * Exposes both customRate, neaRate, and computed margin.
   */
  async getPropertyRate(propertyId) {
    const config = await ElectricityRate.findOne({ property: propertyId })
      .populate("rateHistory.setBy", "name email")
      .lean();

    if (!config) {
      return {
        configured: false,
        currentCustomRatePerUnit: null,
        rateHistory: [],
      };
    }

    const neaRate = config.currentNeaRatePerUnitPaisa;
    const customRate = config.currentCustomRatePerUnitPaisa;
    const marginPaisa = neaRate != null ? customRate - neaRate : null;

    return {
      configured: true,
      // Custom rate (what tenants pay)
      currentCustomRatePerUnit: customRate / 100,
      currentCustomRatePerUnitPaisa: customRate,
      // NEA rate (what owner pays NEA)
      currentNeaRatePerUnit: neaRate != null ? neaRate / 100 : null,
      currentNeaRatePerUnitPaisa: neaRate ?? null,
      // Margin per unit
      currentMarginPerUnit: marginPaisa != null ? marginPaisa / 100 : null,
      currentMarginPerUnitPaisa: marginPaisa,
      // Per-type overrides (custom rate only, all in rupees)
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
        customRatePerUnit: h.customRatePerUnitPaisa / 100,
        neaRatePerUnit:
          h.neaRatePerUnitPaisa != null ? h.neaRatePerUnitPaisa / 100 : null,
        marginPerUnit:
          h.neaRatePerUnitPaisa != null
            ? (h.customRatePerUnitPaisa - h.neaRatePerUnitPaisa) / 100
            : null,
      })),
    };
  }

  /**
   * Set (or update) rates for a property.
   * Appends to rateHistory — existing entries are never modified.
   *
   * @param {string}  propertyId
   * @param {number}  customRatePerUnit   - rupees (what you charge tenants, e.g. 20)
   * @param {number|null} neaRatePerUnit  - rupees (what NEA charges you, e.g. 15), null = disable margin tracking
   * @param {string}  setBy              - admin id
   * @param {string}  [note]
   * @param {Object}  [meterTypeRates]   - { unit, common_area, parking, sub_meter } in rupees (custom rate overrides only)
   */
  async setPropertyRate(
    propertyId,
    customRatePerUnit,
    neaRatePerUnit = null,
    setBy,
    note = "",
    meterTypeRates = {},
  ) {
    const customRatePerUnitPaisa = rupeesToPaisa(customRatePerUnit);
    if (
      !Number.isInteger(customRatePerUnitPaisa) ||
      customRatePerUnitPaisa < 1
    ) {
      throw new Error(
        "Custom rate must be a positive value (e.g. 20 rupees per kWh).",
      );
    }

    let neaRatePerUnitPaisa = null;
    if (neaRatePerUnit != null) {
      neaRatePerUnitPaisa = rupeesToPaisa(neaRatePerUnit);
      if (!Number.isInteger(neaRatePerUnitPaisa) || neaRatePerUnitPaisa < 1) {
        throw new Error(
          "NEA rate must be a positive value (e.g. 15 rupees per kWh).",
        );
      }
    }

    const newEntry = {
      customRatePerUnitPaisa,
      neaRatePerUnitPaisa,
      effectiveFrom: new Date(),
      effectiveTo: null,
      note,
      setBy,
    };

    // Convert per-type custom rate overrides to paisa
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
        meterTypeRatesPaisa[type] = null; // explicitly cleared
      }
    }

    const config = await ElectricityRate.findOne({ property: propertyId });

    if (config) {
      const prev = config.rateHistory.find((h) => h.effectiveTo === null);
      if (prev) prev.effectiveTo = new Date();

      config.currentCustomRatePerUnitPaisa = customRatePerUnitPaisa;
      config.currentNeaRatePerUnitPaisa = neaRatePerUnitPaisa;

      const existing = config.meterTypeRates.toObject?.() ?? {
        ...config.meterTypeRates,
      };
      config.meterTypeRates = { ...existing, ...meterTypeRatesPaisa };

      config.rateHistory.push(newEntry);
      await config.save();
    } else {
      await ElectricityRate.create({
        property: propertyId,
        currentCustomRatePerUnitPaisa: customRatePerUnitPaisa,
        currentNeaRatePerUnitPaisa: neaRatePerUnitPaisa,
        meterTypeRates: meterTypeRatesPaisa,
        rateHistory: [newEntry],
      });
    }

    return {
      success: true,
      customRatePerUnit,
      customRatePerUnitPaisa,
      neaRatePerUnit,
      neaRatePerUnitPaisa,
      marginPerUnit:
        neaRatePerUnit != null ? customRatePerUnit - neaRatePerUnit : null,
    };
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
   * Both customRate and neaRate are resolved from ElectricityRate and
   * snapshotted onto the reading document. This ensures historical readings
   * are never affected by future rate changes.
   */
  async createElectricityReading(data, session = null) {
    const isUnitMeter = data.meterType === "unit";

    // ── Branch 1: Unit (tenant-billed) ────────────────────────────────────────
    if (isUnitMeter) {
      const unit = await Unit.findById(data.unitId).session(session);
      if (!unit) throw new Error("Unit not found");

      const tenantIdResolved =
        data.tenantId ??
        unit.currentLease?.tenant?.toString?.() ??
        unit.currentLease?.tenant ??
        null;

      let isTenantTransition = false;
      let previousTenant = null;
      let tenant = null;

      if (tenantIdResolved) {
        tenant = await Tenant.findById(tenantIdResolved).session(session);

        if (!tenant) {
          console.warn(
            `Tenant _id="${tenantIdResolved}" not found — likely moved out. ` +
              `Looking up current occupant of unit ${data.unitId}.`,
          );
          const currentOccupant = await Tenant.findOne({
            units: data.unitId,
            isActive: true,
          }).session(session);

          if (currentOccupant) {
            isTenantTransition = true;
            previousTenant = tenantIdResolved;
            tenant = currentOccupant;
          } else {
            tenant = null;
          }
        }
      }

      const effectiveTenantId = tenant?._id ?? null;

      const lastReading = await this.getLastReadingForUnit(
        data.unitId,
        session,
      );
      let previousReading = 0;
      let isInitialReading = false;
      let previousRecord = null;

      if (lastReading) {
        const lastTenantId = lastReading.tenant?.toString?.() ?? null;
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

      // Resolve BOTH rates — snapshot them on the document
      const { customRatePerUnitPaisa, neaRatePerUnitPaisa } =
        await ElectricityRate.resolveRates(
          tenant?.property ?? unit.property,
          "unit",
        );

      const consumption = data.currentReading - previousReading;
      const totalAmountPaisa = Math.round(consumption * customRatePerUnitPaisa);
      const neaCostPaisa =
        neaRatePerUnitPaisa != null
          ? Math.round(consumption * neaRatePerUnitPaisa)
          : null;

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
            consumption,
            ratePerUnitPaisa: customRatePerUnitPaisa, // what tenant pays
            neaRatePerUnitPaisa: neaRatePerUnitPaisa, // what NEA charges (snapshot)
            totalAmountPaisa,
            neaCostPaisa,
            marginPaisa:
              neaCostPaisa != null ? totalAmountPaisa - neaCostPaisa : null,
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

      return {
        success: true,
        message: isTenantTransition
          ? "Electricity reading created with tenant transition"
          : "Electricity reading created successfully",
        data: electricity,
      };
    }

    // ── Branch 2: Sub-meter (property-billed) ─────────────────────────────────
    const { SubMeter } = await import("./SubMeter.Model.js");

    const subMeter = await SubMeter.findById(data.subMeterId).session(session);
    if (!subMeter) throw new Error("Sub-meter not found");
    if (!subMeter.isActive) throw new Error("Sub-meter is deactivated");

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

    // For sub-meters (common_area, parking, etc.) resolve the custom rate override
    // NEA rate is property-wide — no per-type override for it.
    const { customRatePerUnitPaisa, neaRatePerUnitPaisa } =
      await ElectricityRate.resolveRates(data.propertyId, data.meterType);

    const consumption = data.currentReading - previousReading;
    const totalAmountPaisa = Math.round(consumption * customRatePerUnitPaisa);
    const neaCostPaisa =
      neaRatePerUnitPaisa != null
        ? Math.round(consumption * neaRatePerUnitPaisa)
        : null;

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
          consumption,
          ratePerUnitPaisa: customRatePerUnitPaisa,
          neaRatePerUnitPaisa: neaRatePerUnitPaisa,
          totalAmountPaisa,
          neaCostPaisa,
          marginPaisa:
            neaCostPaisa != null ? totalAmountPaisa - neaCostPaisa : null,
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
   * For unit readings (tenant-billed), posts TWO journal entries:
   *
   *   Entry 1 — Tenant charge (revenue):
   *     DR  Accounts Receivable       totalAmountPaisa   (tenant owes you)
   *     CR  Electricity Revenue       totalAmountPaisa   (your income)
   *
   *   Entry 2 — NEA cost (expense, only when neaCostPaisa is set):
   *     DR  Electricity Expense (NEA) neaCostPaisa       (your cost from NEA)
   *     CR  NEA Payable               neaCostPaisa       (you owe NEA)
   *
   * The margin (totalAmountPaisa - neaCostPaisa) flows through naturally in P&L:
   *   Electricity Revenue Rs 2000 - Electricity Expense Rs 1500 = Net Rs 500
   *
   * For sub-meter readings (property-billed):
   *   DR  Property Electricity Expense  totalAmountPaisa
   *   CR  NEA Payable / Electricity Payable
   */
  async recordElectricityCharge(electricityId, session = null) {
    const electricity = await Electricity.findById(electricityId)
      .populate("tenant")
      .populate("property")
      .populate({
        path: "unit",
        populate: {
          path: "block",
          select: "name ownershipEntityId",
          populate: { path: "ownershipEntityId", select: "_id type" },
        },
      })
      .session(session);

    if (!electricity) throw new Error("Electricity record not found");

    // Guard: skip journal if zero consumption
    if (electricity.totalAmountPaisa <= 0)
      return { success: true, skipped: true };

    // Entry 1: Tenant charge → Revenue
    const chargePayload = buildElectricityChargeJournal(electricity);
    const { transaction, ledgerEntries } = await ledgerService.postJournalEntry(
      chargePayload,
      session,
    );

    // Entry 2: NEA cost → Expense (only when NEA rate was configured at read time)
    if (electricity.neaCostPaisa != null && electricity.neaCostPaisa > 0) {
      const neaExpensePayload = buildElectricityNeaCostJournal(electricity);
      await ledgerService.postJournalEntry(neaExpensePayload, session);
    }

    return { success: true, transaction, ledgerEntries };
  }

  /**
   * Record electricity payment.
   *
   * Flow:
   *   1. Update Electricity document (paidAmountPaisa, status, paidDate)
   *   2. Post double-entry journal  →  DR Cash/Bank  |  CR Accounts Receivable
   *   3. Create Revenue record (unit meter, tenant-billed only)
   *   4. Increment BankAccount.balance for bank_transfer / cheque payments
   */
  async recordElectricityPayment(paymentData, session = null) {
    const electricity = await Electricity.findById(paymentData.electricityId)
      .populate("tenant", "name")
      .populate("property", "name")
      .session(session);

    if (!electricity) throw new Error("Electricity record not found");

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

    // 1. Update electricity record
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

    // 2. Post journal: DR Cash/Bank | CR AR
    const journalPayload = buildElectricityPaymentJournal(
      paymentData,
      electricity,
    );
    const { transaction, ledgerEntries } = await ledgerService.postJournalEntry(
      journalPayload,
      session,
    );

    // 3. Create Revenue record for tenant-billed payments only
    if (electricity.meterType === "unit" && rawTenantId) {
      try {
        let utilitySource = await RevenueSource.findOne({
          code: "UTILITY",
        }).session(session);
        if (!utilitySource) {
          [utilitySource] = await RevenueSource.create(
            [{ code: "UTILITY", name: "Electricity / Utility" }],
            { session },
          );
        }

        const tenantObjectId =
          rawTenantId instanceof mongoose.Types.ObjectId
            ? rawTenantId
            : new mongoose.Types.ObjectId(rawTenantId);

        await Revenue.create(
          [
            {
              source: utilitySource._id,
              amountPaisa: paymentAmountPaisa,
              date: paymentData.paymentDate ?? new Date(),
              payerType: "TENANT",
              tenant: tenantObjectId,
              referenceType: "ELECTRICITY",
              referenceId: electricity._id,
              createdBy: paymentData.createdBy,
              notes: `Electricity payment – ${electricity.nepaliMonth}/${electricity.nepaliYear}`,
            },
          ],
          { session },
        );
      } catch (error) {
        console.error(
          "Failed to create revenue record for electricity payment:",
          error.message,
        );
        throw error; // abort transaction
      }
    }

    // 4. Update bank balance
    const bankAccountId = paymentData.bankAccountId ?? paymentData.bankAccount;
    const paymentMethod =
      paymentData.paymentMethod || (bankAccountId ? "bank_transfer" : "cash");

    await applyPaymentToBank({
      paymentMethod,
      bankAccountId,
      amountPaisa: paymentAmountPaisa,
      session,
    });

    return { success: true, electricity, transaction, ledgerEntries };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────────────────────────────────

  async getElectricityReadings(filters = {}) {
    const query = {};

    if (filters.tenantId) query.tenant = filters.tenantId;
    if (filters.unitId) query.unit = filters.unitId;
    if (filters.propertyId) query.property = filters.propertyId;
    if (filters.nepaliYear) query.nepaliYear = filters.nepaliYear;
    if (filters.nepaliMonth) query.nepaliMonth = filters.nepaliMonth;
    if (filters.status && filters.status !== "all")
      query.status = filters.status;
    if (filters.meterType) query.meterType = filters.meterType;

    if (
      (filters.blockId && filters.blockId !== "all") ||
      filters.innerBlockId
    ) {
      const unitQuery = {};
      if (filters.blockId && filters.blockId !== "all")
        unitQuery.block = filters.blockId;
      if (filters.innerBlockId) unitQuery.innerBlock = filters.innerBlockId;

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

    // Server-side text search using regex (avoids full collection load)
    if (filters.searchQuery) {
      const re = new RegExp(filters.searchQuery.trim(), "i");
      // Add to query — match against notes field; tenant/unit names need lookup
      // Keep client-side fallback below for populated fields
      query.$or = [...(query.$or ?? []), { notes: re }];
    }

    if (filters.startDate || filters.endDate) {
      query.readingDate = {};
      if (filters.startDate)
        query.readingDate.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        query.readingDate.$lte = end;
      }
    }

    let readings = await Electricity.find(query)
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

    // Client-side refinement for populated fields (tenant name, block name, etc.)
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      readings = readings.filter((reading) => {
        const unitName = (
          reading.unit?.name ??
          reading.unit?.unitName ??
          ""
        ).toLowerCase();
        const meterType = (reading.meterType ?? "").toLowerCase();
        const status = (reading.status ?? "").toLowerCase();
        const blockName = (reading.unit?.block?.name ?? "").toLowerCase();
        const tenantName = (reading.tenant?.name ?? "").toLowerCase();
        return (
          unitName.includes(searchLower) ||
          meterType.includes(searchLower) ||
          status.includes(searchLower) ||
          blockName.includes(searchLower) ||
          tenantName.includes(searchLower)
        );
      });
    }

    const readingsForResponse = readings.map((r) =>
      r.toObject({ virtuals: true }),
    );

    const METER_TYPES_LIST = ["unit", "common_area", "parking", "sub_meter"];

    const grouped = Object.fromEntries(
      METER_TYPES_LIST.map((type) => {
        const bucket = readingsForResponse.filter((r) => r.meterType === type);
        const totalAmountPaisa = bucket.reduce(
          (s, r) => s + (r.totalAmountPaisa ?? 0),
          0,
        );
        const totalNeaCostPaisa = bucket.reduce(
          (s, r) => s + (r.neaCostPaisa ?? 0),
          0,
        );
        const totalMarginPaisa = bucket.reduce(
          (s, r) => s + (r.marginPaisa ?? 0),
          0,
        );
        const totalUnits = bucket.reduce((s, r) => s + (r.consumption ?? 0), 0);
        return [
          type,
          {
            readings: bucket,
            totalAmount: paisaToRupees(totalAmountPaisa),
            totalNeaCost: paisaToRupees(totalNeaCostPaisa),
            totalMargin: paisaToRupees(totalMarginPaisa),
            totalUnits,
            count: bucket.length,
          },
        ];
      }),
    );

    const totalAmountPaisa = readingsForResponse.reduce(
      (s, r) => s + (r.totalAmountPaisa ?? 0),
      0,
    );
    const totalPaidPaisa = readingsForResponse.reduce(
      (s, r) => s + (r.paidAmountPaisa ?? 0),
      0,
    );
    const totalNeaCostPaisa = readingsForResponse.reduce(
      (s, r) => s + (r.neaCostPaisa ?? 0),
      0,
    );
    const totalMarginPaisa = readingsForResponse.reduce(
      (s, r) => s + (r.marginPaisa ?? 0),
      0,
    );
    const grandTotalUnits = readingsForResponse.reduce(
      (s, r) => s + (r.consumption ?? 0),
      0,
    );

    return {
      success: true,
      data: {
        grouped,
        readings: readingsForResponse,
        summary: {
          totalReadings: readings.length,
          grandTotalUnits,
          grandTotalAmount: paisaToRupees(totalAmountPaisa),
          grandTotalNeaCost: paisaToRupees(totalNeaCostPaisa),
          grandTotalMargin: paisaToRupees(totalMarginPaisa),
          totalConsumption: grandTotalUnits,
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
            totalNeaCost: formatMoney(totalNeaCostPaisa),
            totalMargin: formatMoney(totalMarginPaisa),
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

    return {
      success: true,
      data: history.map((doc) => doc.toObject({ virtuals: true })),
    };
  }
}

export const electricityService = new ElectricityService();
