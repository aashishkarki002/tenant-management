/**
 * cam.service.js
 *
 * Changes from previous revision:
 *   1. Import { buildEntityMapForBlocks } from resolveEntity.helper.js
 *   2. handleMonthlyCams — one batch Block query after tenantsToProcess is built,
 *      entityId resolved per CAM from the Map inside the journal loop
 *   3. Removed the stray ADMIN_ID reference that was causing a ReferenceError
 *      in the original — now uses process.env.SYSTEM_ADMIN_ID as fallback
 *
 * createCam and getCams are character-for-character identical to the original.
 */

import mongoose from "mongoose";
import { Cam } from "./cam.model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildCamChargeJournal } from "../ledger/journal-builders/index.js";
import { getNepaliMonthDates } from "../../utils/nepaliDateHelper.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import {
  rupeesToPaisa,
  paisaToRupees,
  formatMoney,
} from "../../utils/moneyUtil.js";
import { buildEntityMapForBlocks } from "../../helper/resolveEntity.js"; // ← NEW
import {
  generateDocumentNumber,
  DOCUMENT_TYPES,
} from "../documentCounter/documentNumber.service.js";
import dotenv from "dotenv";
dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// CREATE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

async function createCam(camData, createdBy, session = null) {
  try {
    if (!camData.amountPaisa && camData.amount) {
      camData.amountPaisa = rupeesToPaisa(camData.amount);
    }
    if (!camData.paidAmountPaisa) {
      camData.paidAmountPaisa = camData.paidAmount
        ? rupeesToPaisa(camData.paidAmount)
        : 0;
    }

    const cam = await Cam.create([camData], session ? { session } : {});

    console.log("✅ CAM created:", {
      id: cam[0]._id,
      amount: formatMoney(cam[0].amountPaisa),
      amountPaisa: cam[0].amountPaisa,
    });

    return {
      success: true,
      message: "Cam created successfully",
      data: cam[0],
    };
  } catch (error) {
    console.error("Failed to create cam:", error);
    return {
      success: false,
      message: "Failed to create cam",
      error: error.message,
    };
  }
}
export { createCam };

// ─────────────────────────────────────────────────────────────────────────────
// CRON: handleMonthlyCams — handles both monthly and quarterly tenants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if `currentMonth` (1-12) is a quarter-start month for a tenant
 * whose billing cycle starts on `quarterStartMonth` (1-12).
 * Quarters repeat every 3 months: startMonth, startMonth+3, startMonth+6, startMonth+9.
 */
function isQuarterStartMonth(currentMonth, quarterStartMonth) {
  return ((currentMonth - quarterStartMonth + 12) % 3) === 0;
}

/**
 * For a quarterly period starting at (year, month1), return the ending month/year
 * after `periodMonths` months (e.g. 3).
 */
function getQuarterEnd(startYear, startMonth1, periodMonths = 3) {
  const totalMonth0 = (startMonth1 - 1) + (periodMonths - 1); // 0-based index of last month
  const endMonth1 = (totalMonth0 % 12) + 1;
  const endYear   = startYear + Math.floor(totalMonth0 / 12);
  return { nepaliMonthEnd: endMonth1, nepaliYearEnd: endYear };
}

export const handleMonthlyCams = async (adminId) => {
  const createdBy = adminId || process.env.SYSTEM_ADMIN_ID;
  const {
    npMonth,
    npYear,
    nepaliDate,
    englishDueDate,
    lastDay,
    englishMonth,
    englishYear,
  } = getNepaliMonthDates();

  try {
    // Step 1: Mark overdue CAMs from past periods
    const overdueResult = await Cam.updateMany(
      {
        $and: [
          { $or: [{ status: "pending" }, { status: "partially_paid" }] },
          {
            $or: [
              { nepaliYear: { $lt: npYear } },
              { nepaliYear: npYear, nepaliMonth: { $lt: npMonth } },
            ],
          },
        ],
      },
      { $set: { status: "overdue" } },
    );
    console.log("Overdue cams updated:", overdueResult.modifiedCount);

    // Step 2: Load active tenants
    const tenants = await Tenant.find({ status: "active" }).lean();
    if (!tenants.length) {
      return { success: false, message: "No tenants found", count: 0 };
    }

    // Step 3: Idempotency — skip tenants already charged for this billing period
    const existingCams = await Cam.find({
      nepaliMonth: npMonth,
      nepaliYear: npYear,
    }).select("tenant");
    const existingTenantIds = new Set(
      existingCams.map((c) => c.tenant.toString()),
    );

    // Step 4: Filter to tenants that need a CAM this month
    // - Monthly tenants: always
    // - Quarterly tenants: only when current month is their quarter-start month
    const tenantsToProcess = tenants.filter((t) => {
      if (existingTenantIds.has(t._id.toString())) return false;
      if (t.rentPaymentFrequency !== "quarterly") return true; // monthly — always charge
      const quarterStart = t.camQuarterStartMonth;
      if (!quarterStart) return true; // fallback: treat as monthly
      return isQuarterStartMonth(npMonth, quarterStart);
    });

    if (!tenantsToProcess.length) {
      return {
        success: true,
        message: "No CAMs to create this period",
        count: 0,
        updatedOverdueCount: overdueResult.modifiedCount,
      };
    }

    // Step 5: Batch-resolve entityId
    const entityByBlock = await buildEntityMapForBlocks(
      tenantsToProcess.map((t) => t.block),
    );

    // Step 6: Build CAM documents — sequential loop so documentNumbers are gapless
    const camsToInsert = [];
    for (const tenant of tenantsToProcess) {
      const isQuarterly = tenant.rentPaymentFrequency === "quarterly";
      const monthlyPaisa = tenant.camChargesPaisa || rupeesToPaisa(tenant.camCharges || 0);
      const periodMonths = isQuarterly ? 3 : 1;
      const amountPaisa = Math.round(monthlyPaisa * periodMonths);
      const { nepaliMonthEnd, nepaliYearEnd } = isQuarterly
        ? getQuarterEnd(npYear, npMonth, periodMonths)
        : { nepaliMonthEnd: null, nepaliYearEnd: null };
      const documentNumber = await generateDocumentNumber(DOCUMENT_TYPES.CAM, { fiscalYear: npYear });

      camsToInsert.push({
        tenant: tenant._id,
        property: tenant.property,
        block: tenant.block,
        innerBlock: tenant.innerBlock,
        nepaliMonth: npMonth,
        nepaliYear: npYear,
        nepaliDate,
        amountPaisa,
        paidAmountPaisa: 0,
        amount: paisaToRupees(amountPaisa),
        paidAmount: 0,
        year: englishYear,
        month: englishMonth,
        nepaliDueDate: lastDay,
        englishDueDate,
        status: "pending",
        camFrequency: isQuarterly ? "quarterly" : "monthly",
        nepaliMonthEnd,
        nepaliYearEnd,
        documentNumber,
      });
    }

    // Step 7: Bulk insert — ordered:false skips duplicates without aborting the batch
    let insertedCams = [];
    try {
      insertedCams = await Cam.insertMany(camsToInsert, { ordered: false });
    } catch (bulkErr) {
      if (bulkErr.code === 11000 || bulkErr.name === "MongoBulkWriteError") {
        insertedCams = bulkErr.insertedDocs ?? [];
        console.warn(
          `[handleMonthlyCams] ${bulkErr.writeErrors?.length ?? "?"} duplicate(s) skipped, ` +
          `${insertedCams.length} inserted`,
        );
      } else {
        throw bulkErr;
      }
    }

    // Step 8: Post journal per CAM — entity-tagged
    for (const cam of insertedCams) {
      const entityId = entityByBlock.get(cam.block?.toString()) ?? null;
      try {
        const camChargePayload = buildCamChargeJournal(cam, { createdBy });
        await ledgerService.postJournalEntry(camChargePayload, null, entityId);
      } catch (error) {
        console.error(
          `[handleMonthlyCams] journal failed for cam=${cam._id} block=${cam.block}:`,
          error.message,
        );
      }
    }

    const monthlyCount = camsToInsert.filter(c => c.camFrequency === "monthly").length;
    const quarterlyCount = camsToInsert.filter(c => c.camFrequency === "quarterly").length;
    console.log(`CAMs created: ${monthlyCount} monthly, ${quarterlyCount} quarterly`);

    return {
      success: true,
      message: "CAMs handled successfully",
      count: insertedCams.length,
      monthlyCount,
      quarterlyCount,
      updatedOverdueCount: overdueResult.modifiedCount,
    };
  } catch (error) {
    console.error("Failed to handle monthly cams:", error);
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// READ (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const getCams = async (filters = {}) => {
  const query = {};
  if (filters.nepaliMonth != null) query.nepaliMonth = filters.nepaliMonth;
  if (filters.nepaliYear != null) query.nepaliYear = filters.nepaliYear;
  if (filters.tenantId != null) query.tenant = new mongoose.Types.ObjectId(String(filters.tenantId));
  if (filters.status != null) query.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status;

  const cams = await Cam.find(query)
    .populate("tenant")
    .populate("property")
    .populate("block")
    .populate("innerBlock")
    .lean();

  const camsWithFormatted = cams.map((cam) => ({
    ...cam,
    formatted: {
      amount: formatMoney(cam.amountPaisa || rupeesToPaisa(cam.amount || 0)),
      paidAmount: formatMoney(
        cam.paidAmountPaisa || rupeesToPaisa(cam.paidAmount || 0),
      ),
      remainingAmount: formatMoney(
        (cam.amountPaisa || rupeesToPaisa(cam.amount || 0)) -
          (cam.paidAmountPaisa || rupeesToPaisa(cam.paidAmount || 0)),
      ),
    },
  }));

  return camsWithFormatted;
};
