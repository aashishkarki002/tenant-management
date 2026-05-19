import { Tenant } from "../Tenant.Model.js";
import { Unit } from "../../units/unit.model.js";
import {
  parseUnitIds,
  filterOccupiedUnits,
  normalizeUnitIdsArray,
} from "../helpers/unit.helper.js";
import {
  getNepaliMonthDates,
  getRentCycleDates,
} from "../../../utils/nepaliDateHelper.js";
import { createNewRent, recordTdsLedgerEntry } from "../../rents/rent.service.js";
import { ledgerService } from "../../ledger/ledger.service.js";
import { buildRentChargeJournal } from "../../ledger/journal-builders/index.js";
import { applyPaymentToBank } from "../../banks/bank.domain.js";
import { createSd } from "../../securityDeposits/sd.service.js";
import { calculateQuarterlyRentCycle } from "../../../utils/quarterlyRentHelper.js";
import { buildCamChargeJournal } from "../../ledger/journal-builders/camCharge.js";
import {
  rupeesToPaisa,
  divideMoney,
} from "../../../utils/moneyUtil.js";
import { createCam } from "../../cam/cam.service.js";
import {
  calculateMultiUnitLease,
  calculateMultiUnitLeaseInPaisa,
  calculateRentByFrequencyInPaisa,
  buildUnitBreakdown,
} from "../domain/rent.calculator.service.js";
import { resolveEntityFromBlock } from "../../../helper/resolveEntity.js";
import NepaliDate from "nepali-datetime";

/**
 * Prorate a paisa amount for the first billing period when a tenant joins mid-period.
 *
 * @param {number}  fullPeriodPaisa   - Full period charge in paisa (integer)
 * @param {number}  joinDay           - BS day the tenant joins (1 = no proration)
 * @param {number}  periodStartMonth1 - 1-based BS month the billing period starts
 * @param {number}  periodStartYear   - BS year the billing period starts
 * @param {number}  periodMonths      - Number of months in the billing period (1 or 3)
 * @returns {number} Prorated integer paisa (or fullPeriodPaisa if joinDay ≤ 1)
 */
function prorateFirstPeriod(fullPeriodPaisa, joinDay, periodStartMonth1, periodStartYear, periodMonths) {
  if (!joinDay || joinDay <= 1) return fullPeriodPaisa;

  // Sum actual BS days across all months in the billing period
  let totalPeriodDays = 0;
  for (let i = 0; i < periodMonths; i++) {
    const month0 = (periodStartMonth1 - 1 + i) % 12;         // 0-based month index
    const year = periodStartYear + Math.floor((periodStartMonth1 - 1 + i) / 12);
    totalPeriodDays += NepaliDate.getDaysOfMonth(year, month0);
  }

  // Days the tenant missed at the start (days 1 … joinDay-1)
  const daysElapsed = joinDay - 1;
  const remainingDays = totalPeriodDays - daysElapsed;

  if (remainingDays <= 0) return 0;
  return Math.round(fullPeriodPaisa * remainingDays / totalPeriodDays);
}

export async function createTenantTransaction(body, documents, adminId, session) {
  // Allow caller to specify which Nepali month/year rent should start from.
  // Body fields: rentStartNepaliYear (number), rentStartNepaliMonth (1-based number).
  // If omitted, defaults to current Nepali month/year.
  const rentStartYear = body.rentStartNepaliYear
    ? Number(body.rentStartNepaliYear)
    : undefined;
  const rentStartMonth1 = body.rentStartNepaliMonth
    ? Number(body.rentStartNepaliMonth)
    : undefined;
  const rentStartMonth0 = rentStartMonth1 != null ? rentStartMonth1 - 1 : undefined;

  const {
    npMonth,
    npYear,
    firstDayNepali,
    lastDayNepali,
    englishMonth,
    englishYear,
  } = getNepaliMonthDates(rentStartYear, rentStartMonth0);

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
  const entityId = await resolveEntityFromBlock(body.block, session);
  const tdsPercentage = 10;

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

  // documents already uploaded + processed by tenant.service.js before the session opened

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
          camQuarterStartMonth: npMonth, // cron uses this to know which month to charge CAM
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
  const grossRentPeriodPaisa = totals.grossMonthlyPaisa * rentFrequencyCalc.periodMonths;

  // ── Pro-rate first period when tenant joins mid-period ─────────────────────
  // rentStartNepaliDay is the BS day of the billing month the tenant joins on.
  // Sent from the billing-start dialog in addTenants.jsx.
  // Day 1 = no proration (full period charge). Day > 1 = prorated.
  const joinDay = body.rentStartNepaliDay ? Math.max(1, Number(body.rentStartNepaliDay)) : 1;

  const firstPeriodGrossPaisa = prorateFirstPeriod(
    grossRentPeriodPaisa,
    joinDay,
    npMonth,          // 1-based billing period start month (same as join month)
    npYear,
    rentFrequencyCalc.periodMonths,
  );
  const firstPeriodTdsPaisa = prorateFirstPeriod(
    periodTdsPaisa,
    joinDay,
    npMonth,
    npYear,
    rentFrequencyCalc.periodMonths,
  );

  // Proration ratio for unit-level breakdown (avoid floating point: use paisa ratio)
  const prorateRatio = grossRentPeriodPaisa > 0
    ? firstPeriodGrossPaisa / grossRentPeriodPaisa
    : 1;

  const rentResult = await createNewRent(
    {
      tenant: tenant[0]._id,
      innerBlock: tenant[0].innerBlock,
      block: tenant[0].block,
      property: tenant[0].property,
      grossRentAmountPaisa: firstPeriodGrossPaisa,
      tdsAmountPaisa: firstPeriodTdsPaisa,
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
        grossRentAmountPaisa: Math.round(u.grossMonthlyPaisa * rentFrequencyCalc.periodMonths * prorateRatio),
        tdsAmountPaisa: Math.round(u.totalTdsPaisa * rentFrequencyCalc.periodMonths * prorateRatio),
        paidAmountPaisa: 0,
      })),
    },
    session,
  );
  if (!rentResult.success) throw new Error(rentResult.message);

  // ── Journal 1: Rent charge — DR AR (GROSS) / CR Revenue (GROSS) ─────────────
  await ledgerService.postJournalEntry(
    buildRentChargeJournal({
      ...rentResult.data.toObject ? rentResult.data.toObject() : rentResult.data,
      tenantName: tenant[0].name,
    }),
    session,
    entityId,
  );

  await recordTdsLedgerEntry(rentResult.data, session, entityId);

  // CAM for the first period:
  // - Quarterly tenants: multiply monthly CAM by period months (3), then prorate
  // - Monthly tenants: just prorate the monthly amount
  const camPeriodMonths = rentFrequencyCalc.periodMonths; // 1 or 3
  const fullPeriodCamPaisa = totals.camMonthlyPaisa * camPeriodMonths;
  const firstPeriodCamPaisa = Math.round(fullPeriodCamPaisa * prorateRatio);

  // Quarter end month/year (for quarterly records)
  const camNepaliMonthEnd = isQuarterly
    ? (((npMonth - 1) + (camPeriodMonths - 1)) % 12) + 1
    : null;
  const camNepaliYearEnd = isQuarterly
    ? npYear + Math.floor(((npMonth - 1) + (camPeriodMonths - 1)) / 12)
    : null;

  const camResult = await createCam(
    {
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate: firstDayNepali,
      amountPaisa: firstPeriodCamPaisa,
      amount: firstPeriodCamPaisa / 100,
      status: "pending",
      year: englishYear,
      month: englishMonth,
      nepaliDueDate: rentCycleData.dueDate.english,
      englishDueDate: rentCycleData.dueDate.english,
      camFrequency: isQuarterly ? "quarterly" : "monthly",
      nepaliMonthEnd: camNepaliMonthEnd,
      nepaliYearEnd: camNepaliYearEnd,
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
      status: (mode === "bank_guarantee" || mode === "others") ? "held_as_bg" : "paid",
      paidDate: new Date(),
      year: englishYear,
      month: englishMonth,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate: firstDayNepali,
      createdBy: adminId,
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
    if (mode === "others") {
      sdPayload.othersDetails = {
        chequeNumber: body.sdOthersChequeNumber,
        chequeDate: body.sdOthersDate ? new Date(body.sdOthersDate) : null,
        imageUrl: body.sdOthersImageUrl ?? null,
      };
    }

    const sd = await createSd(sdPayload, adminId, session, entityId);
    if (!sd.success) throw new Error(sd.message);
    const sdDoc = sd.data;

    if (mode !== "bank_guarantee" && mode !== "others") {
      // Journal 3 (Security deposit) is already posted inside createSd().
      // Only update the operational BankAccount.balancePaisa here.
      await applyPaymentToBank({
        paymentMethod: mode,
        bankAccountId: body.securityDepositBankAccountId ?? null,
        amountPaisa: sdDoc.amountPaisa,
        session,
        entityId,
      });
    }
  }
  return tenant[0];
}
