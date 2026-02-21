import { Revenue } from "./Revenue.Model.js";
import { RevenueSource } from "./RevenueSource.Model.js";
import Admin from "../auth/admin.Model.js";
import mongoose from "mongoose";
import { applyPaymentToBank } from "../banks/bank.domain.js";
import {
  createExternalPaymentRecord,
  createPaymentRecord,
  buildPaymentPayload,
  buildExternalPaymentPayload,
} from "../payment/payment.domain.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildRevenueReceivedJournal } from "../ledger/journal-builders/index.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";
import { getNepaliYearMonthFromDate } from "../../utils/nepaliDateHelper.js";

async function createRevenue(revenueData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      source,
      amountPaisa,
      amount, // Backward compatibility
      date = new Date(),
      payerType,
      tenant,
      externalPayer,
      referenceType = "MANUAL",
      referenceId,
      status = "RECORDED",
      notes,
      createdBy,
      adminId,
      nepaliDate,
      paymentMethod = "bank_transfer",
      bankAccountId,
    } = revenueData;

    // ✅ Convert to paisa if needed
    const finalAmountPaisa =
      amountPaisa !== undefined
        ? amountPaisa
        : amount
          ? rupeesToPaisa(amount)
          : 0;
    const finalAmount = finalAmountPaisa / 100; // For backward compatibility

    /* ----------------------------------
       BASIC VALIDATIONS
    ---------------------------------- */

    if (!source) throw new Error("Revenue source is required");
    if (!finalAmountPaisa || finalAmountPaisa <= 0)
      throw new Error("Valid amount is required");
    if (!payerType) throw new Error("payerType is required");

    if (payerType === "TENANT" && !tenant) {
      throw new Error("Tenant is required for TENANT revenue");
    }

    if (payerType === "EXTERNAL") {
      if (!externalPayer?.name || !externalPayer?.type) {
        throw new Error("External payer name and type are required");
      }
    }

    /* ----------------------------------
       VALIDATE REFERENCES
    ---------------------------------- */

    const revenueSource = await RevenueSource.findById(source).session(session);
    if (!revenueSource) {
      throw new Error("Revenue source not found");
    }

    const admin = await Admin.findById(createdBy || adminId).session(session);
    if (!admin) {
      throw new Error("Admin not found");
    }

    /* ----------------------------------
       APPLY PAYMENT TO BANK
    ---------------------------------- */

    const bankAccount = await applyPaymentToBank({
      paymentMethod,
      bankAccountId,
      amountPaisa: finalAmountPaisa,
      session,
    });

    /* ----------------------------------
       CREATE PAYMENT (TENANT ONLY)
    ---------------------------------- */

    let payment = null;

    if (payerType === "TENANT") {
      const paymentPayload = buildPaymentPayload({
        tenantId: tenant,
        amountPaisa: finalAmountPaisa,
        paymentDate: date,
        paymentMethod,
        paymentStatus: "paid",
        note: notes,
        nepaliDate: nepaliDate || date,
        adminId: createdBy || adminId,
        bankAccountId: bankAccount?._id || bankAccountId,
      });

      payment = await createPaymentRecord(paymentPayload, session);
    } else if (payerType === "EXTERNAL") {
      const externalPayload = buildExternalPaymentPayload({
        payerName: externalPayer.name,
        amountPaisa: finalAmountPaisa,
        paymentDate: date,
        nepaliDate: nepaliDate || date,
        paymentMethod,
        paymentStatus: "paid",
        bankAccountId: bankAccount?._id || bankAccountId,
        note: notes,
        adminId: createdBy || adminId,
      });
      payment = await createExternalPaymentRecord(externalPayload, session);
    }

    /* ----------------------------------
       CREATE REVENUE
    ---------------------------------- */

    const [revenue] = await Revenue.create(
      [
        {
          source,
          amountPaisa: finalAmountPaisa,
          amount: finalAmount, // Backward compatibility
          date,
          ...getNepaliYearMonthFromDate(date),
          payerType,
          tenant: payerType === "TENANT" ? tenant : undefined,
          externalPayer: payerType === "EXTERNAL" ? externalPayer : undefined,
          referenceType,
          referenceId,
          status,
          notes,
          createdBy: createdBy || adminId,
        },
      ],
      { session },
    );

    /* ----------------------------------
       RECORD IN LEDGER (DR Cash/Bank, CR Revenue)
    ---------------------------------- */
    const ledgerDescription =
      payerType === "EXTERNAL"
        ? `Revenue from ${externalPayer.name}`
        : "Manual revenue received";
    const revenuePayload = buildRevenueReceivedJournal(revenue, {
      amountPaisa: finalAmountPaisa,
      paymentDate: date,
      nepaliDate: nepaliDate || date,
      description: ledgerDescription,
      createdBy: createdBy || adminId,
    });
    await ledgerService.postJournalEntry(revenuePayload, session);

    /* ----------------------------------
       COMMIT
    ---------------------------------- */

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: "Revenue created successfully",
      data: revenue,
      payment, // null for EXTERNAL
      bankAccount,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Failed to create revenue:", error);

    return {
      success: false,
      message: "Failed to create revenue",
      error: error.message,
    };
  }
}

export { createRevenue };
async function getRevenue(revenueId) {
  try {
    const revenue = await Revenue.findById(revenueId)
      .populate("source")
      .populate("tenant")
      .populate("createdBy");
    if (!revenue) {
      throw new Error("Revenue not found");
    }
    return revenue;
  } catch (error) {
    console.error("Failed to get revenue:", error);
    throw error;
  }
}
export { getRevenue };

async function getAllRevenue() {
  try {
    const revenue = await Revenue.find()
      .populate("source", "name code")
      .populate("tenant", "name")
      .sort({ date: -1 });
    return {
      success: true,
      message: "Revenue fetched successfully",
      data: revenue,
    };
  } catch (error) {
    console.error("Failed to get all revenue:", error);
    return {
      success: false,
      message: "Failed to get all revenue",
      error: error.message,
    };
  }
}
export { getAllRevenue };
async function getRevenueSource() {
  try {
    const revenueSource = await RevenueSource.find();
    return {
      success: true,
      message: "Revenue source fetched successfully",
      data: revenueSource,
    };
  } catch (error) {
    console.error("Failed to get revenue source:", error);
    return {
      success: false,
      message: "Failed to get revenue source",
      error: error.message,
    };
  }
}
export { getRevenueSource };
/**
 * Record revenue for a rent payment
 * @param {Object} params - Revenue recording parameters
 * @param {number} params.amount - Payment amount
 * @param {Date} params.paymentDate - Payment date
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.rentId - Rent ID
 * @param {string} params.note - Payment note
 * @param {string|ObjectId} params.adminId - Admin ID who created the payment
 * @param {Session} params.session - MongoDB session (optional)
 */
export async function recordRentRevenue({
  amountPaisa,
  amount, // Backward compatibility
  paymentDate,
  tenantId,
  rentId,
  note,
  adminId,
  session = null,
}) {
  try {
    // ✅ Convert to paisa if needed
    const finalAmountPaisa =
      amountPaisa !== undefined
        ? amountPaisa
        : amount
          ? rupeesToPaisa(amount)
          : 0;

    // Find the RENT revenue source
    const rentRevenueSource = await RevenueSource.findOne({
      code: "RENT",
    }).session(session);
    if (!rentRevenueSource) {
      throw new Error("Revenue source RENT not configured");
    }

    // Create revenue record
    const revenue = await Revenue.create(
      [
        {
          source: rentRevenueSource._id,
          amountPaisa: finalAmountPaisa,
          amount: finalAmountPaisa / 100, // Backward compatibility
          date: paymentDate,
          ...getNepaliYearMonthFromDate(paymentDate),
          payerType: "TENANT",
          tenant: new mongoose.Types.ObjectId(tenantId),
          referenceType: "RENT",
          referenceId: new mongoose.Types.ObjectId(rentId),
          status: "RECORDED",
          notes: note,
          createdBy: new mongoose.Types.ObjectId(adminId),
        },
      ],
      { session },
    );

    return revenue[0];
  } catch (error) {
    console.error("Failed to record rent revenue:", error);
    throw error;
  }
}

/**
 * Record revenue for a CAM payment
 * @param {Object} params - Revenue recording parameters
 * @param {number} params.amount - Payment amount
 * @param {Date} params.paymentDate - Payment date
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.camId - CAM ID
 * @param {string} params.note - Payment note
 * @param {string|ObjectId} params.adminId - Admin ID who created the payment
 * @param {Session} params.session - MongoDB session (optional)
 */
export async function recordCamRevenue({
  amountPaisa,
  amount, // Backward compatibility
  paymentDate,
  tenantId,
  camId,
  note,
  adminId,
  session = null,
}) {
  try {
    // ✅ Convert to paisa if needed
    const finalAmountPaisa =
      amountPaisa !== undefined
        ? amountPaisa
        : amount
          ? rupeesToPaisa(amount)
          : 0;

    // Find the CAM revenue source
    const camRevenueSource = await RevenueSource.findOne({
      code: "CAM",
    }).session(session);
    if (!camRevenueSource) {
      throw new Error("Revenue source CAM not configured");
    }

    // Create revenue record
    const revenue = await Revenue.create(
      [
        {
          source: camRevenueSource._id,
          amountPaisa: finalAmountPaisa,
          amount: finalAmountPaisa / 100, // Backward compatibility
          date: paymentDate,
          ...getNepaliYearMonthFromDate(paymentDate),
          payerType: "TENANT",
          tenant: new mongoose.Types.ObjectId(tenantId),
          referenceType: "CAM",
          referenceId: new mongoose.Types.ObjectId(camId),
          status: "RECORDED",
          notes: note,
          createdBy: new mongoose.Types.ObjectId(adminId),
        },
      ],
      { session },
    );

    return revenue[0];
  } catch (error) {
    console.error("Failed to record CAM revenue:", error);
    throw error;
  }
}

/**
 * Record revenue for an electricity payment (unit meter / tenant-billed only).
 * Property-billed meter types (common_area, parking, sub_meter) are expenses —
 * callers must guard with `meterType === "unit"` before calling this helper.
 *
 * @param {Object}           params
 * @param {number}           params.amountPaisa   - Payment amount in paisa
 * @param {Date}             params.paymentDate   - Date of payment
 * @param {string|ObjectId}  params.tenantId      - Tenant who paid
 * @param {string|ObjectId}  params.electricityId - Source Electricity document
 * @param {string}           params.nepaliMonth   - Nepali billing month (for notes)
 * @param {string}           params.nepaliYear    - Nepali billing year (for notes)
 * @param {string|ObjectId}  params.adminId       - Admin creating the record
 * @param {ClientSession}    params.session       - Mongoose session (required — caller owns the transaction)
 */
export async function recordElectricityRevenue({
  amountPaisa,
  paymentDate,
  tenantId,
  electricityId,
  nepaliMonth,
  nepaliYear,
  adminId,
  session = null,
}) {
  // Resolve (or lazily create) the UTILITY revenue source.
  // findOneAndUpdate with upsert is idempotent and race-condition-safe.
  const utilitySource = await RevenueSource.findOneAndUpdate(
    { code: "UTILITY" },
    { $setOnInsert: { code: "UTILITY", name: "Electricity / Utility" } },
    { upsert: true, new: true, session },
  );

  const [revenue] = await Revenue.create(
    [
      {
        source: utilitySource._id,
        amountPaisa,
        date: paymentDate,
        ...getNepaliYearMonthFromDate(paymentDate),
        payerType: "TENANT",
        tenant: new mongoose.Types.ObjectId(tenantId),
        referenceType: "ELECTRICITY",
        referenceId: new mongoose.Types.ObjectId(electricityId),
        status: "RECORDED",
        notes: `Electricity payment – ${nepaliMonth}/${nepaliYear}`,
        createdBy: new mongoose.Types.ObjectId(adminId),
      },
    ],
    { session },
  );

  return revenue;
}
