import { Cam } from "./cam.model.js";
import { ledgerService } from "../../ledger/ledger.service.js";
import { buildCamChargeJournal } from "../../ledger/journal-builders/index.js";
import { getNepaliMonthDates } from "../../../utils/nepaliDateHelper.js";
import { Tenant } from "../Tenant.Model.js";
import dotenv from "dotenv";
dotenv.config();
const ADMIN_ID = process.env.SYSTEM_ADMIN_ID;
async function createCam(camData, createdBy, session = null) {
  try {
    const cam = await Cam.create([camData], session ? { session } : {});

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
export const handleMonthlyCams = async () => {
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
    const overdueResult = await Cam.updateMany(
      {
        status: { $in: ["pending", "partially_paid"] },
        $or: [
          { nepaliYear: { $lt: npYear } },
          { nepaliYear: npYear, nepaliMonth: { $lt: npMonth } },
        ],
      },
      { $set: { status: "overdue" } },
    );
    console.log("Overdue cams updated:", overdueResult.modifiedCount);
    const tenants = await Tenant.find({ status: "active" }).lean();
    if (!tenants.length) {
      return { success: false, message: "No tenants found", count: 0 };
    }
    const existingCams = await Cam.find({
      nepaliMonth: npMonth,
      nepaliYear: npYear,
    }).select("tenant");
    const existingTenantIds = new Set(
      existingCams.map((c) => c.tenant.toString()),
    );
    const camsToInsert = tenants
      .filter((tenant) => !existingTenantIds.has(tenant._id.toString()))
      .map((tenant) => ({
        tenant: tenant._id,
        property: tenant.property,
        block: tenant.block,
        innerBlock: tenant.innerBlock,
        nepaliMonth: npMonth,
        nepaliYear: npYear,
        nepaliDate,
        amount: tenant.camCharges,
        year: englishYear,
        month: englishMonth,
        nepaliDueDate: lastDay,
        englishDueDate: englishDueDate,
        paidAmount: 0,
        status: "pending",
      }));
    if (camsToInsert.length) {
      const insertedCams = await Cam.insertMany(camsToInsert);
      for (const cam of insertedCams) {
        try {
          const camChargePayload = buildCamChargeJournal(cam, {
            createdBy: ADMIN_ID,
          });
          await ledgerService.postJournalEntry(camChargePayload, null);
        } catch (error) {
          console.error("Failed to record cam charge:", error);
        }
      }
      console.log("Monthly cams created:", camsToInsert.length);
    } else {
      console.log("No new monthly cams to create");
    }
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

/**
 * Fetch all CAMs, optionally filtered by nepaliMonth/nepaliYear.
 * Populates tenant for frontend matching (tenant + month/year).
 */
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
  return cams;
};
