import { Tenant } from "../Tenant.Model.js";
import { Unit } from "../../units/unit.model.js";
import { parseUnitIds, filterOccupiedUnits } from "../helpers/unit.helper.js";
import {
  getNepaliMonthDates,
  getRentCycleDates,
} from "../../../utils/nepaliDateHelper.js";
import { createNewRent } from "../../rents/rent.service.js";
import { ledgerService } from "../../ledger/ledger.service.js";
import { buildRentChargeJournal } from "../../ledger/journal-builders/index.js";
import { buildSecurityDepositJournal } from "../../ledger/journal-builders/securityDeposit.js";
import { applyPaymentToBank } from "../../banks/bank.domain.js";
import { createSd } from "../../securityDeposits/sd.service.js";
import { calculateQuarterlyRentCycle } from "../../../utils/quarterlyRentHelper.js";
import { buildCamChargeJournal } from "../../ledger/journal-builders/camCharge.js";
import buildDocumentsFromFiles from "../helpers/fileUploadHelper.js";
import {
  rupeesToPaisa,
  paisaToRupees,
  formatMoney,
  divideMoney,
} from "../../../utils/moneyUtil.js";
import { createCam } from "../../cam/cam.service.js";
import {
  calculateMultiUnitLease,
  buildUnitBreakdown,
} from "../domain/rent.calculator.service.js";
import { resolveEntityFromBlock } from "../../../helper/resolveEntity.js"; // ← NEW

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function normalizeUnitIdsArray(input) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  const result = [];
  for (const item of arr) {
    if (item && typeof item === "object" && Array.isArray(item.$in)) {
      result.push(...item.$in);
    } else if (item != null && item !== "") {
      result.push(item);
    }
  }
  return result;
}

function calculateMultiUnitLeaseInPaisa(unitLeaseConfigs, tdsPercentage) {
  const calculation = calculateMultiUnitLease(unitLeaseConfigs, tdsPercentage);

  const calculatedUnits = calculation.units.map((unit) => ({
    unitId: unit.unitId,
    sqft: unit.sqft,
    pricePerSqft: unit.pricePerSqft,
    camRatePerSqft: unit.camRatePerSqft,
    securityDeposit: unit.securityDeposit,
    grossMonthlyPaisa: rupeesToPaisa(unit.grossMonthly),
    totalTdsPaisa: rupeesToPaisa(unit.totalTds),
    rentMonthlyPaisa: rupeesToPaisa(unit.rentMonthly),
    camMonthlyPaisa: rupeesToPaisa(unit.camMonthly),
    netMonthlyPaisa: rupeesToPaisa(unit.netMonthly),
    securityDepositPaisa: rupeesToPaisa(unit.securityDeposit),
    pricePerSqftPaisa: rupeesToPaisa(unit.pricePerSqft),
    camRatePerSqftPaisa: rupeesToPaisa(unit.camRatePerSqft),
    grossMonthly: unit.grossMonthly,
    totalTds: unit.totalTds,
    rentMonthly: unit.rentMonthly,
    camMonthly: unit.camMonthly,
    netMonthly: unit.netMonthly,
  }));

  const totals = {
    sqft: calculation.totals.sqft,
    grossMonthlyPaisa: rupeesToPaisa(calculation.totals.grossMonthly),
    totalTdsPaisa: rupeesToPaisa(calculation.totals.totalTds),
    rentMonthlyPaisa: rupeesToPaisa(calculation.totals.rentMonthly),
    camMonthlyPaisa: rupeesToPaisa(calculation.totals.camMonthly),
    netMonthlyPaisa: rupeesToPaisa(calculation.totals.netMonthly),
    securityDepositPaisa: rupeesToPaisa(calculation.totals.securityDeposit),
    weightedPricePerSqft: calculation.totals.weightedPricePerSqft,
    weightedCamRate: calculation.totals.weightedCamRate,
    grossMonthly: calculation.totals.grossMonthly,
    totalTds: calculation.totals.totalTds,
    rentMonthly: calculation.totals.rentMonthly,
    camMonthly: calculation.totals.camMonthly,
    netMonthly: calculation.totals.netMonthly,
    securityDeposit: calculation.totals.securityDeposit,
  };

  return { units: calculatedUnits, totals };
}

function calculateRentByFrequencyInPaisa(
  monthlyRentPaisa,
  frequency,
  frequencyMonths = 3,
) {
  console.log(`\n🔢 Calculate Rent by Frequency:`);
  console.log(`├─ Monthly Rent (paisa): ${monthlyRentPaisa}`);
  console.log(`├─ Frequency: ${frequency}`);
  console.log(`└─ Frequency Months: ${frequencyMonths}`);

  if (frequency === "quarterly") {
    const chargeAmountPaisa = monthlyRentPaisa * frequencyMonths;
    console.log(`\n✅ Quarterly Calculation:`);
    console.log(
      `├─ ${monthlyRentPaisa} × ${frequencyMonths} = ${chargeAmountPaisa} paisa`,
    );
    console.log(`└─ Display: ${formatMoney(chargeAmountPaisa)}`);
    return {
      chargeAmountPaisa,
      chargeAmount: paisaToRupees(chargeAmountPaisa),
      periodMonths: frequencyMonths,
    };
  }

  console.log(`\n✅ Monthly Calculation:`);
  console.log(`└─ Charge Amount: ${formatMoney(monthlyRentPaisa)}`);
  return {
    chargeAmountPaisa: monthlyRentPaisa,
    chargeAmount: paisaToRupees(monthlyRentPaisa),
    periodMonths: 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TRANSACTION
// ─────────────────────────────────────────────────────────────────────────────

export async function createTenantTransaction(body, files, adminId, session) {
  const {
    npMonth,
    npYear,
    firstDayNepali,
    lastDayNepali,
    englishMonth,
    englishYear,
  } = getNepaliMonthDates();

  if (body.unitNumber && !body.units) {
    body.units = Array.isArray(body.unitNumber)
      ? body.unitNumber
      : [body.unitNumber];
  }

  let unitIds = [];
  if (Array.isArray(body.unitLeases)) {
    const idsFromLeases = body.unitLeases.map((ul) => ul.unitId);
    unitIds = parseUnitIds(normalizeUnitIdsArray(idsFromLeases));
  } else {
    const rawUnits = body.unitIds ?? body.units ?? body.unitNumber;
    const flatIds = normalizeUnitIdsArray(
      Array.isArray(rawUnits) ? rawUnits : rawUnits ? [rawUnits] : [],
    );
    unitIds = parseUnitIds(flatIds);
  }

  if (unitIds.length === 0)
    throw new Error("At least one unit must be selected");

  const usePerUnitConfig = Array.isArray(body.unitLeases);
  const unitLeaseConfigs = usePerUnitConfig
    ? body.unitLeases
    : unitIds.map((unitId) => ({
        unitId,
        leasedSquareFeet: body.leasedSquareFeet,
        pricePerSqft: body.pricePerSqft,
        camRatePerSqft: body.camRatePerSqft,
      }));

  const units = await Unit.find({ _id: { $in: unitIds } }).session(session);
  if (units.length !== unitIds.length)
    throw new Error("One or more units not found");

  const occupied = filterOccupiedUnits(units);
  if (occupied.length) {
    throw new Error(
      `Units already occupied: ${occupied.map((u) => u.name).join(", ")}`,
    );
  }

  // ── Resolve entity once — all three journal posts below use this value ─────
  const entityId = await resolveEntityFromBlock(body.block, session);
  console.log(
    `[createTenantTransaction] entityId=${entityId ?? "null"} ← block=${body.block}`,
  );

  const tdsPercentage = 10;
  const originalCalculation = calculateMultiUnitLease(
    unitLeaseConfigs,
    tdsPercentage,
  );
  const leaseCalculation = calculateMultiUnitLeaseInPaisa(
    unitLeaseConfigs,
    tdsPercentage,
  );
  const { units: calculatedUnits, totals } = leaseCalculation;

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
    const monthlyDueDates = getRentCycleDates({
      startYear: npYear,
      startMonth: npMonth,
      frequencyMonths: 1,
    });
    rentCycleData = {
      chargeDate: {
        nepali: `${npYear}-${String(npMonth).padStart(2, "0")}-01`,
        english: new Date(),
        year: npYear,
        month: npMonth,
      },
      dueDate: {
        nepali: monthlyDueDates.rentDueNp,
        english: monthlyDueDates.rentDueDate,
        year: monthlyDueDates.nepaliDueYear,
        month: monthlyDueDates.nepaliDueMonth,
      },
    };
  }

  const documents = await buildDocumentsFromFiles(files);

  const tenant = await Tenant.create(
    [
      {
        ...body,
        units: unitIds,
        documents,
        leasedSquareFeet: totals.sqft,
        totalRentPaisa: totals.rentMonthlyPaisa,
        camChargesPaisa: totals.camMonthlyPaisa,
        netAmountPaisa: totals.netMonthlyPaisa,
        securityDepositPaisa: totals.securityDepositPaisa,
        grossAmountPaisa: totals.grossMonthlyPaisa,
        tdsPaisa: divideMoney(totals.totalTdsPaisa, totals.sqft),
        rentalRatePaisa: divideMoney(totals.rentMonthlyPaisa, totals.sqft),
        pricePerSqftPaisa: rupeesToPaisa(totals.weightedPricePerSqft),
        camRatePerSqftPaisa: rupeesToPaisa(totals.weightedCamRate),
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
        ...(isQuarterly && {
          quarterlyRentAmountPaisa: totals.rentMonthlyPaisa * frequencyMonths,
          quarterlyRentAmount: totals.rentMonthly * frequencyMonths,
          nextRentDueDate: rentCycleData.dueDate.english,
          lastRentChargedDate: rentCycleData.chargeDate.english,
        }),
      },
    ],
    { session },
  );

  for (let i = 0; i < units.length; i++) {
    await units[i].occupy({
      tenant: tenant[0]._id,
      leaseSquareFeet: calculatedUnits[i].sqft,
      pricePerSqft: calculatedUnits[i].pricePerSqft,
      camRatePerSqft: calculatedUnits[i].camRatePerSqft,
      securityDeposit: calculatedUnits[i].securityDeposit,
      leaseStartDate: body.leaseStartDate,
      leaseEndDate: body.leaseEndDate,
      dateOfAgreementSigned: body.dateOfAgreementSigned,
      keyHandoverDate: body.keyHandoverDate,
      spaceHandoverDate: body.spaceHandoverDate,
      notes: body.notes || "",
    });
  }
  await Promise.all(units.map((u) => u.save({ session })));

  const rentFrequencyCalc = calculateRentByFrequencyInPaisa(
    totals.rentMonthlyPaisa,
    body.rentPaymentFrequency,
    frequencyMonths,
  );
  const periodTdsPaisa = totals.totalTdsPaisa * rentFrequencyCalc.periodMonths;

  console.log("\n📊 Rent Record Payload:");
  console.log(`├─ rentAmountPaisa: ${rentFrequencyCalc.chargeAmountPaisa}`);
  console.log(`├─ tdsAmountPaisa: ${periodTdsPaisa}`);
  console.log(`└─ paidAmountPaisa: 0`);

  const rentResult = await createNewRent(
    {
      tenant: tenant[0]._id,
      innerBlock: tenant[0].innerBlock,
      block: tenant[0].block,
      property: tenant[0].property,
      rentAmountPaisa: rentFrequencyCalc.chargeAmountPaisa,
      tdsAmountPaisa: periodTdsPaisa,
      paidAmountPaisa: 0,
      rentFrequency: body.rentPaymentFrequency,
      status: "pending",
      createdBy: adminId,
      units: unitIds,
      nepaliMonth: rentCycleData.chargeDate.month,
      nepaliYear: rentCycleData.chargeDate.year,
      nepaliDate: rentCycleData.chargeDate.nepali,
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
      unitBreakdown: calculatedUnits.map((u) => ({
        unit: u.unitId,
        rentAmountPaisa: u.rentMonthlyPaisa * rentFrequencyCalc.periodMonths,
        tdsAmountPaisa: u.totalTdsPaisa * rentFrequencyCalc.periodMonths,
        paidAmountPaisa: 0,
      })),
    },
    session,
  );
  if (!rentResult.success) throw new Error(rentResult.message);

  // ── Journal 1: Rent charge ─────────────────────────────────────────────────
  await ledgerService.postJournalEntry(
    buildRentChargeJournal(rentResult.data),
    session,
    entityId,
  );

  const camResult = await createCam(
    {
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate: firstDayNepali,
      amountPaisa: totals.camMonthlyPaisa,
      amount: totals.camMonthly,
      status: "pending",
      year: englishYear,
      month: englishMonth,
      nepaliDueDate: rentCycleData.dueDate.english,
      englishDueDate: rentCycleData.dueDate.english,
    },
    adminId,
    session,
  );
  if (!camResult.success) throw new Error(camResult.message);

  // ── Journal 2: CAM charge ──────────────────────────────────────────────────
  await ledgerService.postJournalEntry(
    buildCamChargeJournal(camResult.data, { createdBy: adminId }),
    session,
    entityId,
  );

  const hasSecurityDepositAmount =
    body.securityDepositAmount != null &&
    body.securityDepositAmount !== "" &&
    !Number.isNaN(Number(body.securityDepositAmount));

  const baseSecurityDeposit =
    hasSecurityDepositAmount && Number(body.securityDepositAmount) > 0
      ? Number(body.securityDepositAmount)
      : totals.securityDeposit || 0;

  const sdPaymentMethod = body.securityDepositPaymentMethod;
  const hasSecurityDeposit =
    sdPaymentMethod &&
    sdPaymentMethod !== "none" &&
    sdPaymentMethod !== "disabled" &&
    baseSecurityDeposit > 0;

  if (hasSecurityDeposit) {
    const mode = sdPaymentMethod;

    const sdPayload = {
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,
      amountPaisa: rupeesToPaisa(baseSecurityDeposit),
      amount: baseSecurityDeposit,
      status: mode === "bank_guarantee" ? "held_as_bg" : "paid",
      paidDate: new Date(),
      year: englishYear,
      month: englishMonth,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate: firstDayNepali,
      createdBy: adminId,
      // Keep backward compat with older SD records that stored method as "mode",
      // but also set the canonical field used by journal builders/services.
      mode,
      paymentMethod: mode,
      bankAccountCode: body.securityDepositBankAccountCode ?? null,
    };

    if (
      ["cash", "bank_transfer", "cheque"].includes(mode) &&
      hasSecurityDepositAmount
    ) {
      sdPayload.amountPaisa = rupeesToPaisa(Number(body.securityDepositAmount));
      sdPayload.amount = Number(body.securityDepositAmount);
    }
    if (mode === "cheque") {
      sdPayload.chequeDetails = {
        chequeNumber: body.chequeNumber,
        chequeDate: body.chequeDate,
        bankName: body.bankName,
      };
    }
    if (mode === "bank_guarantee") {
      sdPayload.bankGuaranteeDetails = {
        bgNumber: body.bgNumber,
        bankName: body.bankName,
        issueDate: body.bgIssueDate,
        expiryDate: body.bgExpiryDate,
      };
    }

    const sd = await createSd(sdPayload, adminId, session, entityId);
    if (!sd.success) throw new Error(sd.message);
    const sdDoc = sd.data;

    if (mode !== "bank_guarantee") {
      const { ACCOUNT_CODES } = await import("../../ledger/config/accounts.js");
      const drAccountCode =
        mode === "cash" ? ACCOUNT_CODES.CASH : ACCOUNT_CODES.CASH_BANK;

      // ── Journal 3: Security deposit ────────────────────────────────────────
      console.log("[SD Journal] context:", {
        mode,
        paymentMethod: mode,
        drAccountCode,
        bankAccountId: body.securityDepositBankAccountId ?? null,
        bankAccountCode: body.securityDepositBankAccountCode ?? null,
      });
      await ledgerService.postJournalEntry(
        buildSecurityDepositJournal(
          sdDoc,
          {
            createdBy: adminId,
            nepaliMonth: npMonth,
            nepaliYear: npYear,
            tenantName: tenant[0].name,
            paymentMethod: mode,
            bankAccountCode: body.securityDepositBankAccountCode ?? null,
          },
          drAccountCode,
        ),
        session,
        entityId,
      );

      await applyPaymentToBank({
        paymentMethod: mode,
        bankAccountId: body.securityDepositBankAccountId ?? null,
        amountPaisa: sdDoc.amountPaisa,
        session,
        entityId,
      });
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ TENANT CREATION COMPLETED SUCCESSFULLY");
  console.log("=".repeat(60));
  console.log("📊 Summary:");
  console.log("├─ Tenant ID:", tenant[0]._id);
  console.log("├─ Units:", unitIds.length);
  console.log("├─ Total Sqft:", totals.sqft);
  console.log("├─ Frequency:", body.rentPaymentFrequency);
  console.log(
    "├─ Entity ID:",
    entityId?.toString() ?? "null (implicit private)",
  );
  console.log("│");
  console.log("├─ 💰 TENANT (Monthly Values):");
  console.log("│  ├─ Monthly Rent:", formatMoney(totals.rentMonthlyPaisa));
  console.log("│  ├─ Monthly CAM:", formatMoney(totals.camMonthlyPaisa));
  console.log(
    "│  └─ Security Deposit:",
    formatMoney(totals.securityDepositPaisa),
  );
  console.log("│");
  console.log("├─ 📝 RENT RECORD (Period Values):");
  console.log(
    "│  ├─ Rent Charge:",
    formatMoney(rentFrequencyCalc.chargeAmountPaisa),
  );
  console.log("│  ├─ Period:", `${rentFrequencyCalc.periodMonths} month(s)`);
  console.log("│  └─ TDS:", formatMoney(periodTdsPaisa));
  console.log("│");
  console.log("└─ 💾 Stored Paisa Values:");
  console.log(
    "   ├─ Tenant.totalRentPaisa:",
    totals.rentMonthlyPaisa,
    "(monthly)",
  );
  console.log(
    "   ├─ Rent.rentAmountPaisa:",
    rentFrequencyCalc.chargeAmountPaisa,
    `(${rentFrequencyCalc.periodMonths} months)`,
  );
  console.log(
    "   └─ Calculation:",
    `${totals.rentMonthlyPaisa} × ${rentFrequencyCalc.periodMonths} = ${rentFrequencyCalc.chargeAmountPaisa}`,
  );
  console.log("=".repeat(60) + "\n");

  return tenant[0];
}
