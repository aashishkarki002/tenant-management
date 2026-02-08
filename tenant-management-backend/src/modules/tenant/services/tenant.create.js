import mongoose from "mongoose";
import { Tenant } from "../Tenant.Model.js";
import { Unit } from "../../units/Unit.Model.js";
import { parseUnitIds, filterOccupiedUnits } from "../helpers/unit.helper.js";
import {
  getNepaliMonthDates,
  getRentCycleDates,
} from "../../../utils/nepaliDateHelper.js";
import { createNewRent } from "../../rents/rent.service.js";
import { ledgerService } from "../../ledger/ledger.service.js";
import { buildRentChargeJournal } from "../../ledger/journal-builders/index.js";
import { createCam } from "../../cam/cam.service.js";
import { createSd } from "../../securityDeposits/sd.service.js";
import { calculateQuarterlyRentCycle } from "../../../utils/quarterlyRentHelper.js";
import { buildCamChargeJournal } from "../../ledger/journal-builders/camCharge.js";
import buildDocumentsFromFiles from "../helpers/fileUploadHelper.js";

// 🎯 IMPORT THE CALCULATOR SERVICE
import {
  calculateMultiUnitLease,
  calculateRentByFrequency,
  buildUnitBreakdown,
  validateUnitLeaseConfig,
} from "../domain/rent.calculator.service.js";

/**
 * REFACTORED: Create tenant with proper separation of concerns
 *
 * Philosophy:
 * 1. Parse and validate input
 * 2. Calculate all financials (pure functions)
 * 3. Persist to database
 * 4. Create related records (rent, CAM, SD)
 */
export async function createTenantTransaction(body, files, adminId, session) {
  // ============================================
  // 1. PARSE INPUT & GET DATE CONTEXT
  // ============================================
  const {
    npMonth,
    npYear,
    nepaliDate,
    englishMonth,
    englishYear,
    lastDay,
    nepaliDueDate,
  } = getNepaliMonthDates();

  // Normalize unit input
  if (body.unitNumber && !body.units) {
    body.units = [body.unitNumber];
  }

  // Determine configuration mode
  const usePerUnitConfig = !!body.unitLeases;
  let unitLeaseConfigs = [];
  let unitIds;

  if (usePerUnitConfig) {
    // NEW FORMAT: Per-unit configurations
    unitLeaseConfigs = body.unitLeases;

    // Validate each config
    unitLeaseConfigs.forEach((config, idx) => {
      try {
        validateUnitLeaseConfig(config);
      } catch (error) {
        throw new Error(`Invalid config for unit ${idx + 1}: ${error.message}`);
      }
    });

    unitIds = parseUnitIds(unitLeaseConfigs.map((ul) => ul.unitId));
  } else {
    // LEGACY FORMAT: Uniform configuration
    unitIds = parseUnitIds(body.units);

    const sqftPerUnit = body.leasedSquareFeet / unitIds.length;
    const securityDepositPerUnit = body.securityDeposit / unitIds.length;

    unitLeaseConfigs = unitIds.map((unitId) => ({
      unitId: unitId.toString(),
      leasedSquareFeet: sqftPerUnit,
      pricePerSqft: body.pricePerSqft,
      camRatePerSqft: body.camRatePerSqft,
      securityDeposit: securityDepositPerUnit,
    }));
  }

  // ============================================
  // 2. VALIDATE UNITS IN DATABASE
  // ============================================
  const units = await Unit.find({ _id: { $in: unitIds } }).session(session);

  if (units.length !== unitIds.length) {
    throw new Error("One or more units not found");
  }

  const occupied = filterOccupiedUnits(units);
  if (occupied.length) {
    throw new Error(
      `Units already occupied: ${occupied.map((u) => u.name).join(", ")}`,
    );
  }

  // ============================================
  // 3. CALCULATE ALL FINANCIALS (Pure Function)
  // ============================================
  const tdsPercentage = body.tdsPercentage || 10;

  const leaseCalculation = calculateMultiUnitLease(
    unitLeaseConfigs,
    tdsPercentage,
  );

  const { units: calculatedUnits, totals } = leaseCalculation;

  console.log("📊 Lease Calculation Summary:");
  console.log("├─ Total Units:", unitIds.length);
  console.log("├─ Total Sqft:", totals.sqft);
  console.log("├─ Gross Monthly:", totals.grossMonthly.toFixed(2));
  console.log("├─ Total TDS:", totals.totalTds.toFixed(2));
  console.log("├─ Net Rent (after TDS):", totals.rentMonthly.toFixed(2));
  console.log("├─ Monthly CAM:", totals.camMonthly.toFixed(2));
  console.log("├─ Net Monthly (Rent + CAM):", totals.netMonthly.toFixed(2));
  console.log("└─ Security Deposit:", totals.securityDeposit);

  calculatedUnits.forEach((unit, idx) => {
    console.log(`   Unit ${idx + 1} (${unit.sqft} sqft):`);
    console.log(`   ├─ Gross: Rs.${unit.grossMonthly.toFixed(2)}`);
    console.log(`   ├─ TDS: Rs.${unit.totalTds.toFixed(2)}`);
    console.log(`   ├─ Rent: Rs.${unit.rentMonthly.toFixed(2)}`);
    console.log(`   └─ CAM: Rs.${unit.camMonthly.toFixed(2)}`);
  });

  // ============================================
  // 4. CALCULATE RENT CYCLE DATES
  // ============================================
  const isQuarterly = body.rentPaymentFrequency === "quarterly";
  const frequencyMonths =
    isQuarterly && Number.isFinite(Number(body.frequencyMonths))
      ? Number(body.frequencyMonths)
      : 3;

  let rentCycleData;

  if (isQuarterly) {
    rentCycleData = calculateQuarterlyRentCycle({
      startYear: npYear,
      startMonth: npMonth,
      startDay: 1,
    });

    const quarterlyDueDates = getRentCycleDates({
      startYear: npYear,
      startMonth: npMonth,
      frequencyMonths,
    });

    rentCycleData = {
      ...rentCycleData,
      dueDate: {
        ...rentCycleData.dueDate,
        nepali: quarterlyDueDates.rentDueNp,
        english: quarterlyDueDates.rentDueDate,
        year: quarterlyDueDates.nepaliDueYear,
        month: quarterlyDueDates.nepaliDueMonth,
      },
    };

    console.log("[Quarterly] Rent cycle:");
    console.log("├─ Coverage:", rentCycleData.coverageMonths.join(", "));
    console.log("├─ Charge Date:", rentCycleData.chargeDate.nepali);
    console.log("└─ Due Date:", rentCycleData.dueDate.nepali);
  } else {
    rentCycleData = {
      chargeDate: {
        nepali: `${npYear}-${String(npMonth).padStart(2, "0")}-01`,
        english: new Date(),
        year: npYear,
        month: npMonth,
      },
      dueDate: {
        nepali: nepaliDueDate,
        english: lastDay.getDateObject(),
        year: npYear,
        month: npMonth,
      },
    };
  }

  // ============================================
  // 5. PROCESS FILE UPLOADS
  // ============================================
  const documents = await buildDocumentsFromFiles(files);

  // ============================================
  // 6. CREATE TENANT DOCUMENT
  // ============================================
  const tenant = await Tenant.create(
    [
      {
        ...body,
        units: unitIds,
        documents,

        // Use calculated totals (from pure function)
        leasedSquareFeet: totals.sqft,
        totalRent: totals.rentMonthly,
        camCharges: totals.camMonthly,
        netAmount: totals.netMonthly,
        securityDeposit: totals.securityDeposit,
        grossAmount: totals.grossMonthly,
        tds: totals.totalTds / totals.sqft, // TDS per sqft
        rentalRate: totals.rentMonthly / totals.sqft, // Net rate per sqft

        // Weighted averages for multi-unit
        pricePerSqft: totals.weightedPricePerSqft,
        camRatePerSqft: totals.weightedCamRate,
        tdsPercentage,

        // Preserve for backward compatibility
        cam: {
          ratePerSqft: totals.weightedCamRate,
        },

        // Status flags
        isDeleted: false,
        isActive: true,
        status: "active",
        useUnitBreakdown: true,

        // Quarterly tracking
        ...(isQuarterly && {
          quarterlyRentAmount: totals.rentMonthly * frequencyMonths,
          nextRentDueDate: rentCycleData.dueDate.english,
          lastRentChargedDate: rentCycleData.chargeDate.english,
        }),
      },
    ],
    { session },
  );

  // ============================================
  // 7. OCCUPY UNITS WITH INDIVIDUAL LEASE DATA
  // ============================================
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const unitCalc = calculatedUnits[i];

    await unit.occupy({
      tenant: tenant[0]._id,
      leaseSquareFeet: unitCalc.sqft,
      pricePerSqft: unitCalc.pricePerSqft,
      camRatePerSqft: unitCalc.camRatePerSqft,
      securityDeposit: unitCalc.securityDeposit,
      leaseStartDate: body.leaseStartDate,
      leaseEndDate: body.leaseEndDate,
      dateOfAgreementSigned: body.dateOfAgreementSigned,
      keyHandoverDate: body.keyHandoverDate,
      spaceHandoverDate: body.spaceHandoverDate,
      notes: body.notes || "",
    });

    console.log(`✅ Unit ${unit.name} occupied:`);
    console.log(`   Rent: Rs.${unitCalc.rentMonthly.toFixed(2)}/mo`);
    console.log(`   CAM: Rs.${unitCalc.camMonthly.toFixed(2)}/mo`);
  }

  // Save units to trigger their pre-save hooks if needed
  await Promise.all(units.map((u) => u.save({ session })));

  // ============================================
  // 8. CALCULATE RENT CHARGE AMOUNT
  // ============================================
  const rentFrequencyCalc = calculateRentByFrequency(
    totals.rentMonthly,
    body.rentPaymentFrequency,
    frequencyMonths,
  );

  console.log(
    `💰 Rent Charge: Rs.${rentFrequencyCalc.chargeAmount.toFixed(2)}`,
  );
  console.log(`   (${rentFrequencyCalc.periodMonths} months)`);

  // ============================================
  // 9. CREATE RENT RECORD
  // ============================================
  const unitBreakdown = buildUnitBreakdown(
    units,
    calculatedUnits,
    body.rentPaymentFrequency,
    frequencyMonths,
  );

  const rentPayload = {
    tenant: tenant[0]._id,
    innerBlock: tenant[0].innerBlock,
    block: tenant[0].block,
    property: tenant[0].property,
    rentAmount: rentFrequencyCalc.chargeAmount,
    rentFrequency: body.rentPaymentFrequency,
    paidAmount: 0,
    tdsAmount: totals.totalTds * rentFrequencyCalc.periodMonths,
    status: "pending",
    createdBy: adminId,
    units: unitIds,
    nepaliMonth: rentCycleData.chargeDate.month,
    nepaliYear: rentCycleData.chargeDate.year,
    nepaliDate: nepaliDate,
    englishMonth: isQuarterly
      ? rentCycleData.chargeDate.english.getMonth() + 1
      : englishMonth,
    englishYear: isQuarterly
      ? rentCycleData.chargeDate.english.getFullYear()
      : englishYear,
    nepaliDueDate: rentCycleData.dueDate.nepali,
    englishDueDate: rentCycleData.dueDate.english,
    lastPaidDate: null,
    lastPaidBy: null,
    lateFee: 0,
    lateFeeDate: null,
    lateFeeApplied: false,
    lateFeeStatus: "pending",
    useUnitBreakdown: true,
    unitBreakdown,
  };

  console.log("📄 Rent Payload:");
  console.log("├─ Amount:", rentPayload.rentAmount);
  console.log("├─ TDS:", rentPayload.tdsAmount);
  console.log("└─ Breakdown:");
  unitBreakdown.forEach((ub, idx) => {
    console.log(`   Unit ${idx + 1}: Rs.${ub.rentAmount.toFixed(2)}`);
  });

  const rentResult = await createNewRent(rentPayload, session);
  if (!rentResult.success) {
    throw new Error(rentResult.message);
  }

  // ============================================
  // 10. LEDGER ENTRY FOR RENT
  // ============================================
  const rentChargePayload = buildRentChargeJournal(rentResult.data);
  await ledgerService.postJournalEntry(rentChargePayload, session);

  // ============================================
  // 11. CREATE CAM RECORD
  // ============================================
  const camResult = await createCam(
    {
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate,
      amount: totals.camMonthly, // Always monthly CAM
      status: "pending",
      paidDate: null,
      notes: "",
      year: englishYear,
      month: englishMonth,
      nepaliDueDate: rentCycleData.dueDate.nepali,
    },
    adminId,
    session,
  );

  if (!camResult.success) {
    throw new Error(camResult.message);
  }

  const camChargePayload = buildCamChargeJournal(camResult.data, {
    createdBy: adminId,
  });
  await ledgerService.postJournalEntry(camChargePayload, session);

  // ============================================
  // 12. CREATE SECURITY DEPOSIT
  // ============================================
  if (body.securityDepositMode !== "bank_guarantee") {
    const sdPayload = {
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,
      amount: totals.securityDeposit,
      status: "paid",
      paidDate: new Date(),
      notes: "",
      year: englishYear,
      month: englishMonth,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate: nepaliDate,
      createdBy: adminId,
      mode: body.securityDepositMode,
    };

    // Override amount for cash/bank_transfer if provided
    if (["cash", "bank_transfer"].includes(body.securityDepositMode)) {
      sdPayload.amount = body.securityDepositAmount || totals.securityDeposit;
    }

    // Add cheque details if applicable
    if (body.securityDepositMode === "cheque") {
      sdPayload.chequeDetails = {
        chequeNumber: body.chequeNumber,
        chequeDate: body.chequeDate,
        bankName: body.bankName,
      };
    }

    const sd = await createSd(sdPayload, adminId, session);

    if (!sd.success) {
      throw new Error(sd.message);
    }
  }

  // ============================================
  // 13. FINAL LOGGING
  // ============================================
  console.log("✅ Tenant creation completed!");
  console.log("📊 Summary:");
  console.log("├─ Tenant ID:", tenant[0]._id);
  console.log("├─ Units:", unitIds.length);
  console.log("├─ Total Sqft:", totals.sqft);
  console.log("├─ Monthly Rent:", totals.rentMonthly.toFixed(2));
  console.log("├─ Monthly CAM:", totals.camMonthly.toFixed(2));
  console.log("├─ Security Deposit:", totals.securityDeposit);
  console.log("└─ Rent Frequency:", body.rentPaymentFrequency);

  return tenant[0];
}
