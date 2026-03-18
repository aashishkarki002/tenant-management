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
// CRON: handleMonthlyCams — entity-aware via buildEntityMapForBlocks
// ─────────────────────────────────────────────────────────────────────────────

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
    // Step 1: Mark overdue (unchanged)
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

    // Step 2: Active tenants (unchanged)
    const tenants = await Tenant.find({ status: "active" }).lean();
    if (!tenants.length) {
      return { success: false, message: "No tenants found", count: 0 };
    }

    // Step 3: Idempotency (unchanged)
    const existingCams = await Cam.find({
      nepaliMonth: npMonth,
      nepaliYear: npYear,
    }).select("tenant");
    const existingTenantIds = new Set(
      existingCams.map((c) => c.tenant.toString()),
    );

    const tenantsToProcess = tenants.filter(
      (t) => !existingTenantIds.has(t._id.toString()),
    );

    if (!tenantsToProcess.length) {
      return {
        success: true,
        message: "All CAMs for this month already exist",
        count: 0,
        updatedOverdueCount: overdueResult.modifiedCount,
      };
    }

    // Step 4: Batch-resolve entityId — ONE query for all blocks ← NEW
    const entityByBlock = await buildEntityMapForBlocks(
      tenantsToProcess.map((t) => t.block),
    );

    // Step 5: Build CAM documents (unchanged shape)
    const camsToInsert = tenantsToProcess.map((tenant) => {
      const amountPaisa =
        tenant.camChargesPaisa || rupeesToPaisa(tenant.camCharges || 0);

      return {
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
        englishDueDate: englishDueDate,
        status: "pending",
      };
    });

    if (!camsToInsert.length) {
      return {
        success: true,
        message: "No new monthly cams to create",
        count: 0,
        updatedOverdueCount: overdueResult.modifiedCount,
      };
    }

    // Step 6: Bulk insert (unchanged)
    const insertedCams = await Cam.insertMany(camsToInsert);

    // Step 7: Post journal per CAM — entity-tagged ← CHANGED
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

    console.log("Monthly cams created:", camsToInsert.length);

    return {
      success: true,
      message: "Monthly cams handled successfully",
      count: camsToInsert.length,
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
