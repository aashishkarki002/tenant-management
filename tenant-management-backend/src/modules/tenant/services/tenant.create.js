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

// ✅ NEW: Import money utilities
import {
  rupeesToPaisa,
  paisaToRupees,
  formatMoney,
  divideMoney,
} from "../../../utils/moneyUtil.js";

// ✅ NEW: Import rent calculator service
import {
  calculateMultiUnitLease,
  calculateRentByFrequency,
  buildUnitBreakdown,
} from "../domain/rent.calculator.service.js";

/**
 * ✅ REFACTORED: Calculate multi-unit lease financials using rent.calculator.service
 * Converts results to PAISA for storage
 */
function calculateMultiUnitLeaseInPaisa(unitLeaseConfigs, tdsPercentage) {
  // Use the calculator service (works in rupees)
  const calculation = calculateMultiUnitLease(unitLeaseConfigs, tdsPercentage);

  // Convert all amounts to paisa and add paisa fields
  const calculatedUnits = calculation.units.map((unit) => ({
    unitId: unit.unitId,
    sqft: unit.sqft,
    pricePerSqft: unit.pricePerSqft,
    camRatePerSqft: unit.camRatePerSqft,
    securityDeposit: unit.securityDeposit,

    // ✅ Store as PAISA (integers - source of truth)
    grossMonthlyPaisa: rupeesToPaisa(unit.grossMonthly),
    totalTdsPaisa: rupeesToPaisa(unit.totalTds),
    rentMonthlyPaisa: rupeesToPaisa(unit.rentMonthly),
    camMonthlyPaisa: rupeesToPaisa(unit.camMonthly),
    netMonthlyPaisa: rupeesToPaisa(unit.netMonthly),
    securityDepositPaisa: rupeesToPaisa(unit.securityDeposit),
    pricePerSqftPaisa: rupeesToPaisa(unit.pricePerSqft),
    camRatePerSqftPaisa: rupeesToPaisa(unit.camRatePerSqft),

    // For logging only (from calculator service)
    grossMonthly: unit.grossMonthly,
    totalTds: unit.totalTds,
    rentMonthly: unit.rentMonthly,
    camMonthly: unit.camMonthly,
    netMonthly: unit.netMonthly,
  }));

  // Convert totals to paisa
  const totals = {
    sqft: calculation.totals.sqft,

    // Integer sums in paisa (no accumulation errors)
    grossMonthlyPaisa: rupeesToPaisa(calculation.totals.grossMonthly),
    totalTdsPaisa: rupeesToPaisa(calculation.totals.totalTds),
    rentMonthlyPaisa: rupeesToPaisa(calculation.totals.rentMonthly),
    camMonthlyPaisa: rupeesToPaisa(calculation.totals.camMonthly),
    netMonthlyPaisa: rupeesToPaisa(calculation.totals.netMonthly),
    securityDepositPaisa: rupeesToPaisa(calculation.totals.securityDeposit),

    // Weighted averages (from calculator service)
    weightedPricePerSqft: calculation.totals.weightedPricePerSqft,
    weightedCamRate: calculation.totals.weightedCamRate,

    // Rupee values for logging/backward compatibility
    grossMonthly: calculation.totals.grossMonthly,
    totalTds: calculation.totals.totalTds,
    rentMonthly: calculation.totals.rentMonthly,
    camMonthly: calculation.totals.camMonthly,
    netMonthly: calculation.totals.netMonthly,
    securityDeposit: calculation.totals.securityDeposit,
  };

  return { units: calculatedUnits, totals };
}

/**
 * ✅ REFACTORED: Calculate rent by frequency using rent.calculator.service
 * Converts results to PAISA for storage
 */
function calculateRentByFrequencyInPaisa(
  monthlyRentPaisa,
  frequency,
  frequencyMonths = 3,
) {
  // Convert paisa to rupees for calculator service
  const monthlyRentRupees = paisaToRupees(monthlyRentPaisa);

  // Use the calculator service
  const result = calculateRentByFrequency(
    monthlyRentRupees,
    frequency,
    frequencyMonths,
  );

  // Convert back to paisa
  return {
    chargeAmountPaisa: rupeesToPaisa(result.chargeAmount), // Store as paisa
    chargeAmount: result.chargeAmount, // For display
    periodMonths: result.periodMonths,
  };
}

/**
 * ✅ UPDATED: Create tenant with precise paisa calculations
 */
export async function createTenantTransaction(body, files, adminId, session) {
  // ============================================
  // 1-2. PARSE INPUT & VALIDATE (unchanged)
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

  if (body.unitNumber && !body.units) {
    body.units = [body.unitNumber];
  }

  const usePerUnitConfig = !!body.unitLeases;
  let unitLeaseConfigs = [];
  let unitIds;

  if (usePerUnitConfig) {
    unitLeaseConfigs = body.unitLeases;
    unitIds = parseUnitIds(unitLeaseConfigs.map((ul) => ul.unitId));
  } else {
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
  // 3. ✅ CALCULATE ALL FINANCIALS IN PAISA
  // ============================================
  const tdsPercentage = body.tdsPercentage || 10;

  // ✅ Use calculator service, then convert to paisa
  const originalCalculation = calculateMultiUnitLease(unitLeaseConfigs, tdsPercentage);
  const leaseCalculation = calculateMultiUnitLeaseInPaisa(
    unitLeaseConfigs,
    tdsPercentage,
  );
  const { units: calculatedUnits, totals } = leaseCalculation;

  // ✅ Logging now shows both paisa and formatted rupees
  console.log("📊 Lease Calculation Summary:");
  console.log("├─ Total Units:", unitIds.length);
  console.log("├─ Total Sqft:", totals.sqft);
  console.log("├─ Gross Monthly:", formatMoney(totals.grossMonthlyPaisa));
  console.log("├─ Total TDS:", formatMoney(totals.totalTdsPaisa));
  console.log("├─ Net Rent:", formatMoney(totals.rentMonthlyPaisa));
  console.log("├─ Monthly CAM:", formatMoney(totals.camMonthlyPaisa));
  console.log("├─ Net Monthly:", formatMoney(totals.netMonthlyPaisa));
  console.log("└─ Security Deposit:", formatMoney(totals.securityDepositPaisa));

  // ============================================
  // 4. CALCULATE RENT CYCLE DATES (unchanged)
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
  // 5. PROCESS FILE UPLOADS (unchanged)
  // ============================================
  const documents = await buildDocumentsFromFiles(files);

  // ============================================
  // 6. ✅ CREATE TENANT WITH PAISA VALUES
  // ============================================
  const tenant = await Tenant.create(
    [
      {
        ...body,
        units: unitIds,
        documents,

        // ✅ CRITICAL: Store as PAISA (integers)
        leasedSquareFeet: totals.sqft,
        totalRentPaisa: totals.rentMonthlyPaisa, // ← Integer!
        camChargesPaisa: totals.camMonthlyPaisa, // ← Integer!
        netAmountPaisa: totals.netMonthlyPaisa, // ← Integer!
        securityDepositPaisa: totals.securityDepositPaisa, // ← Integer!
        grossAmountPaisa: totals.grossMonthlyPaisa, // ← Integer!
        tdsPaisa: divideMoney(totals.totalTdsPaisa, totals.sqft), // ← TDS per sqft in paisa (integer)
        rentalRatePaisa: divideMoney(totals.rentMonthlyPaisa, totals.sqft), // ← Rate in paisa (integer)
        pricePerSqftPaisa: rupeesToPaisa(totals.weightedPricePerSqft),
        camRatePerSqftPaisa: rupeesToPaisa(totals.weightedCamRate),

        // ✅ BACKWARD COMPATIBILITY: Keep old rupee fields (optional)
        // These can be removed after migration is complete
        totalRent: totals.rentMonthly,
        camCharges: totals.camMonthly,
        netAmount: totals.netMonthly,
        securityDeposit: totals.securityDeposit,
        grossAmount: totals.grossMonthly,
        tds: totals.totalTds / totals.sqft,
        rentalRate: totals.rentMonthly / totals.sqft,
        pricePerSqft: totals.weightedPricePerSqft,
        camRatePerSqft: totals.weightedCamRate,

        tdsPercentage,
        cam: { ratePerSqft: totals.weightedCamRate },
        isDeleted: false,
        isActive: true,
        status: "active",
        useUnitBreakdown: true,

        // ✅ Quarterly in paisa
        ...(isQuarterly && {
          quarterlyRentAmountPaisa: totals.rentMonthlyPaisa * frequencyMonths,
          quarterlyRentAmount: totals.rentMonthly * frequencyMonths, // Backward compat
          nextRentDueDate: rentCycleData.dueDate.english,
          lastRentChargedDate: rentCycleData.chargeDate.english,
        }),
      },
    ],
    { session },
  );

  // ============================================
  // 7. OCCUPY UNITS (unchanged)
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
  }

  await Promise.all(units.map((u) => u.save({ session })));

  // ============================================
  // 8. ✅ CALCULATE RENT CHARGE IN PAISA
  // ============================================
  const rentFrequencyCalc = calculateRentByFrequencyInPaisa(
    totals.rentMonthlyPaisa, // ← Pass paisa, not rupees!
    body.rentPaymentFrequency,
    frequencyMonths,
  );

  console.log(
    `💰 Rent Charge: ${formatMoney(rentFrequencyCalc.chargeAmountPaisa)}`,
  );
  console.log(`   Stored as: ${rentFrequencyCalc.chargeAmountPaisa} paisa`);

  // ============================================
  // 9. ✅ CREATE RENT RECORD WITH PAISA
  // ============================================
  const rentPayload = {
    tenant: tenant[0]._id,
    innerBlock: tenant[0].innerBlock,
    block: tenant[0].block,
    property: tenant[0].property,

    // ✅ Store as PAISA (integer)
    rentAmountPaisa: rentFrequencyCalc.chargeAmountPaisa,
    tdsAmountPaisa: totals.totalTdsPaisa * rentFrequencyCalc.periodMonths,
    paidAmountPaisa: 0,

    // Backward compatibility (can remove later)
    rentAmount: rentFrequencyCalc.chargeAmount,
    tdsAmount: totals.totalTds * rentFrequencyCalc.periodMonths,
    paidAmount: 0,

    rentFrequency: body.rentPaymentFrequency,
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
    lateFee: 0,
    useUnitBreakdown: true,
    // ✅ Use buildUnitBreakdown from calculator service, then add paisa fields
    unitBreakdown: buildUnitBreakdown(
      units,
      originalCalculation.units, // Use the units from calculator service (has unitId)
      body.rentPaymentFrequency,
      frequencyMonths,
    ).map((ub) => ({
      ...ub,
      // Add paisa fields
      rentAmountPaisa: rupeesToPaisa(ub.rentAmount),
      tdsAmountPaisa: ub.tdsAmount ? rupeesToPaisa(ub.tdsAmount) : 0,
      paidAmountPaisa: 0,
    })),
  };

  const rentResult = await createNewRent(rentPayload, session);
  if (!rentResult.success) {
    throw new Error(rentResult.message);
  }

  // ============================================
  // 10-12. LEDGER, CAM, SD (use paisa values)
  // ============================================
  const rentChargePayload = buildRentChargeJournal(rentResult.data);
  await ledgerService.postJournalEntry(rentChargePayload, session);

  const camResult = await createCam(
    {
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate,

      // ✅ Store CAM in paisa
      amountPaisa: totals.camMonthlyPaisa,
      amount: totals.camMonthly, // Backward compat

      status: "pending",
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

  if (body.securityDepositMode !== "bank_guarantee") {
    const sdPayload = {
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,

      // ✅ Store SD in paisa
      amountPaisa: totals.securityDepositPaisa,
      amount: totals.securityDeposit, // Backward compat

      status: "paid",
      paidDate: new Date(),
      year: englishYear,
      month: englishMonth,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate: nepaliDate,
      createdBy: adminId,
      mode: body.securityDepositMode,
    };

    if (["cash", "bank_transfer"].includes(body.securityDepositMode)) {
      const overrideAmount =
        body.securityDepositAmount || totals.securityDeposit;
      sdPayload.amountPaisa = rupeesToPaisa(overrideAmount);
      sdPayload.amount = overrideAmount;
    }

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
  // 13. ✅ FINAL LOGGING WITH FORMATTED VALUES
  // ============================================
  console.log("✅ Tenant creation completed!");
  console.log("📊 Summary:");
  console.log("├─ Tenant ID:", tenant[0]._id);
  console.log("├─ Units:", unitIds.length);
  console.log("├─ Total Sqft:", totals.sqft);
  console.log("├─ Monthly Rent:", formatMoney(totals.rentMonthlyPaisa));
  console.log("├─ Monthly CAM:", formatMoney(totals.camMonthlyPaisa));
  console.log("├─ Security Deposit:", formatMoney(totals.securityDepositPaisa));
  console.log("└─ Rent Frequency:", body.rentPaymentFrequency);
  console.log("\n💾 Stored values (paisa):");
  console.log("├─ rentMonthlyPaisa:", totals.rentMonthlyPaisa);
  console.log("├─ camMonthlyPaisa:", totals.camMonthlyPaisa);
  console.log("└─ securityDepositPaisa:", totals.securityDepositPaisa);

  return tenant[0];
}
