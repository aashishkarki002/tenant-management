import mongoose from "mongoose";
import { Tenant } from "../Tenant.Model.js";
import { Unit } from "../../units/Unit.Model.js";
import { parseUnitIds, filterOccupiedUnits } from "../helpers/unit.helper.js";
import { buildDocumentsFromFiles } from "../helpers/fileUploadHelper.js";
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

export async function createTenantTransaction(body, files, adminId, session) {
  const {
    npMonth,
    npYear,
    nepaliDate,
    englishMonth,
    englishYear,
    lastDay,
    nepaliDueDate,
  } = getNepaliMonthDates();

  if (body.unitNumber && !body.units) body.units = [body.unitNumber];
  const documents = await buildDocumentsFromFiles(files);
  const unitIds = parseUnitIds(body.units);

  const units = await Unit.find({ _id: { $in: unitIds } }).session(session);
  if (units.length !== unitIds.length) {
    throw new Error("One or more units not found");
  }
  const occupied = filterOccupiedUnits(units);
  if (occupied.length) {
    throw new Error(
      `One or more units are already occupied: ${occupied
        .map((u) => u.name)
        .join(", ")}`
    );
  }
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
    console.log("[Quarterly Tenant] Rent cycle calculated:");
    console.log("├─ Coverage Period:", rentCycleData.coverageMonths.join(", "));
    console.log("├─ Charge Date:", rentCycleData.chargeDate.nepali);
    console.log("├─ Due Date:", rentCycleData.dueDate.nepali);
    console.log("└─ Quarter:", rentCycleData.coverageQuarter);
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
  const tenant = await Tenant.create(
    [
      {
        ...body,
        units: unitIds,
        documents,
        cam: { ratePerSqft: body.camRatePerSqft },
        isDeleted: false,
        ...(isQuarterly && {
          // quarterlyRentAmount is set by Tenant model pre-save hook from totalRent
          nextRentDueDate: rentCycleData.dueDate.english,
          lastRentChargedDate: rentCycleData.chargeDate.english,
        }),
      },
    ],
    { session }
  );
  await Unit.updateMany(
    { _id: { $in: unitIds } },
    { $set: { isOccupied: true } },
    { session }
  );
  const rentAmount = isQuarterly
    ? tenant[0].quarterlyRentAmount
    : tenant[0].totalRent;
  // Rent creation

  const rentPayload = {
    tenant: tenant[0]._id,
    innerBlock: tenant[0].innerBlock,
    block: tenant[0].block,
    property: tenant[0].property,
    rentAmount: rentAmount,
    rentFrequency: body.rentPaymentFrequency,
    paidAmount: 0,
    tdsAmount: 0,
    status: "pending",
    createdBy: adminId,
    units: tenant[0].units,
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
  };

  const rentResult = await createNewRent(rentPayload, session);

  if (!rentResult.success) throw new Error(rentResult.message);

  const rentChargePayload = buildRentChargeJournal(rentResult.data);
  await ledgerService.postJournalEntry(rentChargePayload, session);

  // CAM creation
  const camResult = await createCam(
    {
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate,
      amount: tenant[0].camCharges,
      status: "pending",
      paidDate: null,
      notes: "",
      year: englishYear,
      month: englishMonth,
      nepaliDueDate: rentCycleData.dueDate.nepali,
    },
    adminId,
    session
  );

  if (!camResult.success) throw new Error(camResult.message);

  const camChargePayload = buildCamChargeJournal(camResult.data, {
    createdBy: adminId,
  });
  await ledgerService.postJournalEntry(camChargePayload, session);

  // Security deposit creation
  const sd = await createSd(
    {
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,
      amount: tenant[0].securityDeposit,
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
    },
    adminId,
    session
  );
  if ([body.securityDepositMode].includes("cash", "bank_transfer")) {
    sd.amount = body.securityDepositAmount;
  }

  if ([body.securityDepositMode].includes("cheque")) {
    sd.chequeDetails = {
      chequeNumber: body.chequeNumber,
      chequeDate: body.chequeDate,
      bankName: body.bankName,
    };
  }
  if ([body.securityDepositMode].includes("bank_guarantee")) {
    sd.bankGuaranteeDetails = {
      bgNumber: body.bgNumber,
      bankName: body.bankName,
      issueDate: body.issueDate,
      expiryDate: body.expiryDate,
      files: body.bankGuaranteeFiles,
      uploadedAt: new Date(),
    };
  }

  if (!sd.success) throw new Error(sd.message);

  return tenant[0];
}
