import mongoose from "mongoose";
import { Tenant } from "./Tenant.Model.js";
import tenantValidation from "../../validations/tenantValidation.js";
import { Unit } from "../units/unit.model.js";
import { sendWelcomeEmail } from "../../config/nodemailer.js";
import { smsTenant } from "../../config/nestsms.templates.js";
import { createTenantTransaction } from "./services/tenant.create.js";
import buildDocumentsFromFiles, {
  uploadSingleFile,
  rollbackUploads,
} from "./helpers/fileUploadHelper.js";
import { paisaToRupees, rupeesToPaisa, divideMoney } from "../../utils/moneyUtil.js";
import { calculateMultiUnitLease } from "./domain/rent.calculator.service.js";
import { Rent } from "../rents/rent.Model.js";
import { Cam } from "../cam/cam.model.js";
import { SystemConfig } from "../systemConfig/SystemConfig.Model.js";
import { enableEscalation } from "./escalation/rent.escalation.service.js";
import { createNewRent, recordTdsLedgerEntry } from "../rents/rent.service.js";
import { createCam } from "../cam/cam.service.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildRentChargeJournal } from "../ledger/journal-builders/index.js";
import { buildCamChargeJournal } from "../ledger/journal-builders/camCharge.js";
import { TenantBalance } from "../tenantBalance/tenantBalance.model.js";
import { ACCOUNT_CODES } from "../ledger/config/accounts.js";
import { resolveEntityFromBlock } from "../../helper/resolveEntity.js";
import { getNepaliMonthDates, getRentCycleDates } from "../../utils/nepaliDateHelper.js";

export async function createTenant(body, files, adminId) {
  // ── Parse unitLeases JSON string (multipart forms send it as string) ────────
  if (body.unitLeases && typeof body.unitLeases === "string") {
    try {
      const parsed = JSON.parse(body.unitLeases);
      if (Array.isArray(parsed)) {
        body.unitLeases = parsed;
        const unitIds = parsed
          .map((u) => u.unitId)
          .filter((id) => typeof id === "string" && id.trim().length > 0);
        if (unitIds.length > 0) body.units = unitIds;
      }
    } catch (e) {
      console.error("Failed to parse unitLeases JSON:", e);
    }
  }

  await tenantValidation.validate(body, { abortEarly: false });

  const documentFields = [
    "image",
    "pdfAgreement",
    "citizenShip",
    "company_docs",
    "tax_certificate",
    "bank_guarantee",
    "cheque",
    "other",
    "sd_others",
  ];
  const hasDocuments =
    files &&
    documentFields.some(
      (f) =>
        files[f] && (Array.isArray(files[f]) ? files[f].length > 0 : true),
    );

  if (!hasDocuments) {
    return {
      success: false,
      statusCode: 400,
      message: "Tenant documents are required",
    };
  }

  // ── Upload files BEFORE opening the transaction ──────────────────────────
  // Cloudinary uploads can take up to 120s. Holding a MongoDB session open
  // that long causes lock contention and session timeouts.
  let documents;
  try {
    documents = await buildDocumentsFromFiles(files);
  } catch (uploadErr) {
    return {
      success: false,
      statusCode: 400,
      message: uploadErr.message,
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  // Inject sd_others image URL into body so createTenantTransaction can store it
  const sdOthersDoc = documents.find((d) => d.type === "sd_others");
  if (sdOthersDoc?.files?.[0]?.url) {
    body.sdOthersImageUrl = sdOthersDoc.files[0].url;
  }

  try {
    const tenant = await createTenantTransaction(body, documents, adminId, session);

    await session.commitTransaction();
    session.endSession();


    applyDefaultEscalationIfEnabled(tenant._id.toString())
      .then((r) => {
        if (r?.applied) console.log(`Escalation applied to ${tenant.name}`);
      })
      .catch((e) =>
        console.error("Failed to apply default escalation:", e.message),
      );

    if (tenant.email) {
      sendWelcomeEmail({ to: tenant.email, tenantName: tenant.name })
        .then(() => console.log(`Welcome email sent to ${tenant.email}`))
        .catch((e) =>
          console.error(`Welcome email failed for ${tenant.email}:`, e.message),
        );
    }

    // if (tenant.phone) {
    //   smsTenant.welcome(tenant.phone, { tenantName: tenant.name } ,{unitName: tenant.units[0]?.name || "", propertyName: ""});
    // }

    return {
      success: true,
      statusCode: 201,
      message: "Tenant and initial rent created successfully",
      tenant,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Tenant creation error:", error);

    // DB transaction failed — delete already-uploaded Cloudinary assets
    if (documents?.length) {
      rollbackUploads(documents).catch((e) =>
        console.error("Cloudinary rollback error:", e.message),
      );
    }

    return {
      success: false,
      statusCode: 500,
      message: "Tenant creation failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

export async function getTenants() {

  return searchTenants({});
}

export async function getTenantById(id) {
  try {
    const tenant = await Tenant.findById(id)
      .populate({
        path: "property",
        select: "name description address createdAt updatedAt",
      })
      .populate({ path: "block", select: "name property createdAt updatedAt" })
      .populate({ path: "innerBlock", select: "name block property" })
      .populate({
        path: "units",
        match: { isDeleted: false },
        select: "name unitNumber sqft price",
      });

    if (!tenant) return null;

    const populatedUnits = (tenant.units || []).filter((u) => u != null);

    const mappedUnits = populatedUnits.map((unit) => ({
      ...unit.toObject(),
      currentLease: {
        tenant: tenant._id,
        leaseSquareFeet: tenant.leasedSquareFeet || unit.sqft || 0,
        pricePerSqft: paisaToRupees(tenant.pricePerSqftPaisa),
        camRatePerSqft: paisaToRupees(tenant.camRatePerSqftPaisa),
        securityDeposit: paisaToRupees(tenant.securityDepositPaisa),
        leaseStartDate: tenant.leaseStartDate,
        leaseEndDate: tenant.leaseEndDate,
        dateOfAgreementSigned: tenant.dateOfAgreementSigned,
        keyHandoverDate: tenant.keyHandoverDate,
        spaceHandoverDate: tenant.spaceHandoverDate,
        spaceReturnedDate: tenant.spaceReturnedDate,
        status: tenant.status || "active",
        notes: tenant.notes || "",
        tdsPercentage: tenant.tdsPercentage || 10,
        securityDepositStatus: "held",
        tds: paisaToRupees(tenant.tdsPaisa),
        monthlyRent: paisaToRupees(tenant.totalRentPaisa),
        monthlyCam: paisaToRupees(tenant.camChargesPaisa),
        totalMonthly: paisaToRupees(tenant.monthlyTotalPaisa),
        grossAmount: paisaToRupees(tenant.grossAmountPaisa),
      },
      isExpiringSoon: checkLeaseExpiringSoon(tenant.leaseEndDate),
      leaseDurationMonths: calculateLeaseDuration(
        tenant.leaseStartDate,
        tenant.leaseEndDate,
      ),
    }));

    const tenantJson = tenant.toJSON();
    return {
      ...tenantJson,
      units: mappedUnits,
      tds: paisaToRupees(tenant.tdsPaisa),
      rentalRate: paisaToRupees(tenant.rentalRatePaisa),
      grossAmount: paisaToRupees(tenant.grossAmountPaisa),
      totalRent: paisaToRupees(tenant.totalRentPaisa),
      camCharges: paisaToRupees(tenant.camChargesPaisa),
      netAmount: paisaToRupees(tenant.netAmountPaisa),
      securityDeposit: paisaToRupees(tenant.securityDepositPaisa),
      quarterlyRentAmount: paisaToRupees(tenant.quarterlyRentAmountPaisa),
      pricePerSqft: paisaToRupees(tenant.pricePerSqftPaisa),
      camRatePerSqft: paisaToRupees(tenant.camRatePerSqftPaisa),
    };
  } catch (error) {
    console.error("Error in getTenantById:", error);
    throw error;
  }
}

export async function updateTenant(tenantId, body, files) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingTenant = await Tenant.findById(tenantId).session(session);
    if (!existingTenant) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 404, message: "Tenant not found" };
    }

    const updatedTenantData = {};

    // Basic fields
    const basicFields = [
      "name",
      "email",
      "phone",
      "address",
      "status",
      "notes",
      // AD dates
      "leaseStartDate",
      "leaseEndDate",
      "dateOfAgreementSigned",
      "keyHandoverDate",
      "spaceHandoverDate",
      "spaceReturnedDate",
      "leaseStartDateNepali",
      "leaseEndDateNepali",
      "dateOfAgreementSignedNepali",
      "keyHandoverDateNepali",
      "spaceHandoverDateNepali",
      "spaceReturnedDateNepali",
      "tdsPercentage",
      "rentPaymentFrequency",
    ];
    basicFields.forEach((f) => {
      if (body[f] !== undefined) updatedTenantData[f] = body[f];
    });

    // Property assignment fields
    if (body.block) updatedTenantData.block = body.block;
    if (body.innerBlock) updatedTenantData.innerBlock = body.innerBlock;

    // Units — accept repeated form keys (array) or comma-separated string
    if (body.unitNumber !== undefined) {
      let newUnits;
      if (Array.isArray(body.unitNumber)) {
        newUnits = body.unitNumber.filter(Boolean);
      } else if (typeof body.unitNumber === "string" && body.unitNumber) {
        newUnits = body.unitNumber.split(",").filter(Boolean);
      }
      if (newUnits && newUnits.length > 0) {
        updatedTenantData.units = newUnits;
      }
    }

    // Financial recalculation
    const financialsChanged = hasFinancialChanges(body, existingTenant);
    let recalculationResult = null;

    if (financialsChanged) {
      recalculationResult = recalculateTenantFinancials(existingTenant, body);
      Object.assign(updatedTenantData, recalculationResult);

      if (existingTenant.rentPaymentFrequency === "quarterly") {
        updatedTenantData.quarterlyRentAmountPaisa =
          recalculationResult.totalRentPaisa * 3;
      }
    }

    if (Object.keys(updatedTenantData).length === 0) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: "No fields to update",
      };
    }

    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: updatedTenantData },
      { returnDocument: "after", session },
    )
      .populate("property")
      .populate("block")
      .populate("innerBlock")
      .populate("units");

    let rentUpdateResult = { updated: 0 };
    let camUpdateResult = { updated: 0 };

    if (financialsChanged && recalculationResult) {
      rentUpdateResult = await updatePendingRentRecords(
        updatedTenant,
        recalculationResult,
        session,
      );
      camUpdateResult = await updatePendingCAMRecords(
        updatedTenant,
        recalculationResult,
        session,
      );
    }

    if (updatedTenantData.units || updatedTenantData.status === "vacated") {
      const occupied = updatedTenantData.status !== "vacated";

      if (updatedTenantData.units) {
        // Release units that were removed
        const oldUnitIds = (existingTenant.units || []).map((id) =>
          id.toString()
        );
        const newUnitIds = updatedTenantData.units.map((id) => id.toString());
        const removedUnitIds = oldUnitIds.filter(
          (id) => !newUnitIds.includes(id)
        );

        if (removedUnitIds.length > 0) {
          await Unit.updateMany(
            { _id: { $in: removedUnitIds } },
            { $set: { isOccupied: false } },
            { session }
          );
        }
      }

      // Mark current (new) units with correct occupancy
      await Unit.updateMany(
        { _id: { $in: updatedTenant.units } },
        { $set: { isOccupied: occupied } },
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    let message = "Tenant updated successfully";
    if (financialsChanged) {
      message += `. Updated ${rentUpdateResult.updated} rent record(s) and ${camUpdateResult.updated} CAM record(s).`;
    }

    return {
      success: true,
      statusCode: 200,
      message,
      tenant: updatedTenant,
      recalculation: financialsChanged
        ? {
            rentsUpdated: rentUpdateResult.updated,
            camsUpdated: camUpdateResult.updated,
            newMonthlyRent: paisaToRupees(recalculationResult.totalRentPaisa),
            newMonthlyCam: paisaToRupees(recalculationResult.camChargesPaisa),
            newMonthlyTotal: paisaToRupees(recalculationResult.netAmountPaisa),
          }
        : null,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Tenant update error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Error updating tenant",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE / RESTORE / SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteTenant(tenantId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch tenant first — we need lease data before soft-deleting
    const tenant = await Tenant.findById(tenantId).session(session);
    if (!tenant) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 404, message: "Tenant not found" };
    }

    // 2. Soft-delete the tenant
    tenant.isDeleted = true;
    tenant.status = "vacated";
    tenant.isActive = false;
    await tenant.save({ session });

    // 3. For each occupied unit — record occupancy history, clear lease
    const units = await Unit.find({
      _id: { $in: tenant.units },
      isOccupied: true,
    }).session(session);

    for (const unit of units) {
      const lease = unit.currentLease;

      unit.occupancyHistory.push({
        tenant: tenant._id,
        startDate: lease?.leaseStartDate ?? tenant.leaseStartDate,
        endDate: lease?.leaseEndDate ?? tenant.leaseEndDate,
        vacatedDate: new Date(),
        monthlyRent:
          lease?.monthlyRent ?? paisaToRupees(tenant.totalRentPaisa) ?? 0,
        monthlyCam:
          lease?.monthlyCam ?? paisaToRupees(tenant.camChargesPaisa) ?? 0,
        reason: "tenant_vacated",
        notes: `Auto-recorded on tenant deletion (${tenant.name})`,
      });

      unit.currentLease = undefined;
      unit.isOccupied = false;

      await unit.save({ session });
    }

    // 4. Catch any non-occupied units (edge case — just clear the flag)
    await Unit.updateMany(
      {
        _id: { $in: tenant.units },
        isOccupied: false, // already-vacant units, no history needed
      },
      { $set: { isOccupied: false } },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      statusCode: 200,
      message: "Tenant deleted successfully",
      tenant,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Delete tenant error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Tenant deletion failed",
      error: error.message,
    };
  }
}

export async function restoreTenant(tenantId) {
  const restored = await Tenant.findByIdAndUpdate(
    tenantId,
    { isDeleted: false },
    { returnDocument: "after" },
  );
  if (!restored)
    return { success: false, statusCode: 404, message: "Tenant not found" };
  return {
    success: true,
    statusCode: 200,
    message: "Tenant restored successfully",
    tenant: restored,
  };
}

/**
 * searchTenants — Production-grade tenant filtering
 *
 * DESIGN PRINCIPLES:
 *   1. Backend is the source of truth for ALL business logic
 *   2. Frontend is "dumb" — just passes query params and renders results
 *   3. Payment status computed server-side from Rent records (single source of truth)
 *   4. All filters validated, sanitized, and documented
 *   5. Optimized MongoDB queries with proper indexes
 *
 * SUPPORTED FILTERS:
 *   • search         : Text search across name, email, phone, unit numbers
 *   • block          : Location filter (property block)
 *   • innerBlock     : Sub-location filter (inner block)
 *   • status         : Tenant status (active, inactive, vacated) - multiple values
 *   • paymentStatus  : Payment status (paid, due_soon, overdue) - multiple values
 *   • frequency      : Billing frequency (monthly, quarterly) - multiple values
 *   • lease          : Lease status (expiring_soon, expired) - multiple values
 *
 * PAYMENT STATUS LOGIC:
 *   • paid       : Latest rent/cam has status "paid"
 *   • due_soon   : Next payment due within 7 days (status: pending/partially_paid)
 *   • overdue    : Payment past due date (status: overdue on rent/cam records)
 *
 * PERFORMANCE:
 *   • Uses compound indexes: { status, isDeleted, block, innerBlock }
 *   • Aggregation pipeline for payment status join (single query)
 *   • Text search uses MongoDB text index
 *
 * @param {Object} query - Express req.query object
 * @returns {Promise<Array>} Filtered tenant list with computed payment status
 */
export async function searchTenants(query) {
  const { search, block, innerBlock, status, paymentStatus, frequency, lease } =
    query;

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 1: Build MongoDB aggregation pipeline
  // ─────────────────────────────────────────────────────────────────────────

  const pipeline = [];

  // ── Base filter: only active, non-deleted tenants ─────────────────────────
  const matchStage = { isDeleted: false };

  // ── Location filters ───────────────────────────────────────────────────────
  if (block) {
    if (!mongoose.Types.ObjectId.isValid(block)) {
      throw new Error("Invalid block ID format");
    }
    matchStage.block = new mongoose.Types.ObjectId(block);
  }

  if (innerBlock) {
    if (!mongoose.Types.ObjectId.isValid(innerBlock)) {
      throw new Error("Invalid innerBlock ID format");
    }
    matchStage.innerBlock = new mongoose.Types.ObjectId(innerBlock);
  }

  // ── Tenant status filter ───────────────────────────────────────────────────
  if (status) {
    const statusArr = Array.isArray(status) ? status : [status];
    const validStatuses = ["active", "inactive", "vacated"];
    const sanitized = statusArr.filter((s) => validStatuses.includes(s));
    if (sanitized.length > 0) {
      matchStage.status = { $in: sanitized };
    }
  }

  // ── Billing frequency filter ───────────────────────────────────────────────
  if (frequency) {
    const freqArr = Array.isArray(frequency) ? frequency : [frequency];
    const validFreqs = ["monthly", "quarterly"];
    const sanitized = freqArr.filter((f) => validFreqs.includes(f));
    if (sanitized.length > 0) {
      matchStage.rentPaymentFrequency = { $in: sanitized };
    }
  }

  // ── Lease status filter ────────────────────────────────────────────────────
  // BUSINESS RULES:
  //   • expiring_soon : lease ends within 30 days from today (frontend shows < 30 days)
  //   • expired       : lease end date is in the past
  if (lease) {
    const leaseArr = Array.isArray(lease) ? lease : [lease];
    const now = new Date();
    const future30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (leaseArr.includes("expiring_soon") && leaseArr.includes("expired")) {
      // Both: show all leases ending within 30 days (past or future)
      matchStage.leaseEndDate = { $lte: future30 };
    } else if (leaseArr.includes("expiring_soon")) {
      // Only expiring soon: future but within 30 days
      matchStage.leaseEndDate = { $gt: now, $lte: future30 };
    } else if (leaseArr.includes("expired")) {
      // Only expired: already past
      matchStage.leaseEndDate = { $lt: now };
    }
  }

  // ── Text search ─────────────────────────────────────────────────────────────
  // Search across: tenant name, email, phone, AND unit numbers
  if (search && search.trim()) {
    const escaped = String(search.trim()).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const searchRegex = new RegExp(escaped, "i");
    matchStage.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  pipeline.push({ $match: matchStage });

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 2: Join with Rent collection to compute payment status
  // ─────────────────────────────────────────────────────────────────────────

  pipeline.push(
    // Join latest rent records
    {
      $lookup: {
        from: "rents",
        let: { tenantId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$tenant", "$$tenantId"] },
            },
          },
          { $sort: { englishDueDate: -1 } },
          { $limit: 2 }, // Get latest 2 records for better accuracy
        ],
        as: "rentRecords",
      },
    },

    // Join latest CAM records
    {
      $lookup: {
        from: "cams",
        let: { tenantId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$tenant", "$$tenantId"] },
            },
          },
          { $sort: { englishDueDate: -1 } },
          { $limit: 2 },
        ],
        as: "camRecords",
      },
    },

    // Compute payment status
    {
      $addFields: {
        computedPaymentStatus: {
          $let: {
            vars: {
              latestRent: { $arrayElemAt: ["$rentRecords", 0] },
              latestCam: { $arrayElemAt: ["$camRecords", 0] },
              now: new Date(),
              sevenDaysFromNow: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
            in: {
              $cond: [
                // OVERDUE: Any unpaid rent/cam past due date
                {
                  $or: [
                    {
                      $and: [
                        { $ne: ["$$latestRent", null] },
                        {
                          $in: [
                            "$$latestRent.status",
                            ["pending", "partially_paid", "overdue"],
                          ],
                        },
                        { $lt: ["$$latestRent.englishDueDate", "$$now"] },
                      ],
                    },
                    {
                      $and: [
                        { $ne: ["$$latestCam", null] },
                        {
                          $in: [
                            "$$latestCam.status",
                            ["pending", "partially_paid", "overdue"],
                          ],
                        },
                        { $lt: ["$$latestCam.englishDueDate", "$$now"] },
                      ],
                    },
                  ],
                },
                "overdue",
                {
                  $cond: [
                    // PARTIAL: partially paid and not yet past due
                    {
                      $or: [
                        {
                          $and: [
                            { $ne: ["$$latestRent", null] },
                            { $eq: ["$$latestRent.status", "partially_paid"] },
                            { $gte: ["$$latestRent.englishDueDate", "$$now"] },
                          ],
                        },
                        {
                          $and: [
                            { $ne: ["$$latestCam", null] },
                            { $eq: ["$$latestCam.status", "partially_paid"] },
                            { $gte: ["$$latestCam.englishDueDate", "$$now"] },
                          ],
                        },
                      ],
                    },
                    "partial",
                    {
                      $cond: [
                        // DUE SOON: unpaid (pending only) and due within 7 days
                        {
                          $or: [
                            {
                              $and: [
                                { $ne: ["$$latestRent", null] },
                                { $eq: ["$$latestRent.status", "pending"] },
                                { $gte: ["$$latestRent.englishDueDate", "$$now"] },
                                {
                                  $lte: [
                                    "$$latestRent.englishDueDate",
                                    "$$sevenDaysFromNow",
                                  ],
                                },
                              ],
                            },
                            {
                              $and: [
                                { $ne: ["$$latestCam", null] },
                                { $eq: ["$$latestCam.status", "pending"] },
                                { $gte: ["$$latestCam.englishDueDate", "$$now"] },
                                {
                                  $lte: [
                                    "$$latestCam.englishDueDate",
                                    "$$sevenDaysFromNow",
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                        "due_soon",
                        // UPCOMING: pending but due is still far away
                        {
                          $cond: [
                            {
                              $or: [
                                {
                                  $and: [
                                    { $ne: ["$$latestRent", null] },
                                    { $eq: ["$$latestRent.status", "pending"] },
                                  ],
                                },
                                {
                                  $and: [
                                    { $ne: ["$$latestCam", null] },
                                    { $eq: ["$$latestCam.status", "pending"] },
                                  ],
                                },
                              ],
                            },
                            "due_soon", // pending + future due date > 7 days → due_soon
                            "paid",
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },

        // Also compute outstanding amount for frontend
        outstandingAmount: {
          $add: [
            {
              $reduce: {
                input: "$rentRecords",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        {
                          $in: [
                            "$$this.status",
                            ["pending", "partially_paid", "overdue"],
                          ],
                        },
                        {
                          $subtract: [
                            "$$this.rentAmountPaisa",
                            "$$this.paidAmountPaisa",
                          ],
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
            {
              $reduce: {
                input: "$camRecords",
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        {
                          $in: [
                            "$$this.status",
                            ["pending", "partially_paid", "overdue"],
                          ],
                        },
                        {
                          $subtract: [
                            "$$this.amountPaisa",
                            "$$this.paidAmountPaisa",
                          ],
                        },
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 3: Filter by computed payment status (if requested)
  // ─────────────────────────────────────────────────────────────────────────

  if (paymentStatus) {
    const paymentArr = Array.isArray(paymentStatus)
      ? paymentStatus
      : [paymentStatus];
    const validPaymentStatuses = ["paid", "due_soon", "overdue", "partial"];
    const sanitized = paymentArr.filter((p) =>
      validPaymentStatuses.includes(p),
    );

    if (sanitized.length > 0) {
      pipeline.push({
        $match: {
          computedPaymentStatus: { $in: sanitized },
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 4: Populate references and clean up
  // ─────────────────────────────────────────────────────────────────────────

  pipeline.push(
    {
      $lookup: {
        from: "properties",
        localField: "property",
        foreignField: "_id",
        as: "property",
      },
    },
    { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "blocks",
        localField: "block",
        foreignField: "_id",
        as: "block",
      },
    },
    { $unwind: { path: "$block", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "innerblocks",
        localField: "innerBlock",
        foreignField: "_id",
        as: "innerBlock",
      },
    },
    { $unwind: { path: "$innerBlock", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "units",
        let: { unitIds: "$units" },
        pipeline: [
          {
            $match: {
              $expr: { $in: ["$_id", "$$unitIds"] },
              isDeleted: false,
            },
          },
          {
            $project: {
              unitNumber: 1,
              name: 1,
              sqft: 1,
              price: 1,
            },
          },
        ],
        as: "units",
      },
    },

    // Join TenantBalance for overdue breakdown (rent + CAM + late fees)
    {
      $lookup: {
        from: "tenantbalances",
        localField: "_id",
        foreignField: "tenant",
        pipeline: [
          {
            $project: {
              rentDuePaisa: 1,
              camDuePaisa: 1,
              lateFeeDuePaisa: 1,
              totalDuePaisa: 1,
              oldestOverdueNepaliYear: 1,
              oldestOverdueNepaliMonth: 1,
              consecutiveUnpaidMonths: 1,
            },
          },
        ],
        as: "tenantBalance",
      },
    },
    { $unwind: { path: "$tenantBalance", preserveNullAndEmptyArrays: true } },

    // Remove temporary fields
    {
      $project: {
        rentRecords: 0,
        camRecords: 0,
      },
    },

    // Sort by name for consistent results
    { $sort: { name: 1 } },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // STAGE 5: Execute aggregation and return results
  // ─────────────────────────────────────────────────────────────────────────

  const results = await Tenant.aggregate(pipeline);

  // Filter out tenants with no units (defensive)
  const validResults = results.filter(
    (t) => Array.isArray(t.units) && t.units.length > 0,
  );

  // Convert paisa to rupees for frontend consumption
  return validResults.map((tenant) => ({
    ...tenant,
    // Convert outstanding amount from paisa to rupees
    outstandingAmount: paisaToRupees(tenant.outstandingAmount || 0),
    // TenantBalance denormalized overdue snapshot (rent + CAM + late fees)
    overdueBalance: paisaToRupees(tenant.tenantBalance?.totalDuePaisa || 0),
    rentDue: paisaToRupees(tenant.tenantBalance?.rentDuePaisa || 0),
    camDue: paisaToRupees(tenant.tenantBalance?.camDuePaisa || 0),
    lateFeeDue: paisaToRupees(tenant.tenantBalance?.lateFeeDuePaisa || 0),
    oldestOverdueNepaliYear: tenant.tenantBalance?.oldestOverdueNepaliYear ?? null,
    oldestOverdueNepaliMonth: tenant.tenantBalance?.oldestOverdueNepaliMonth ?? null,
    consecutiveUnpaidMonths: tenant.tenantBalance?.consecutiveUnpaidMonths ?? 0,
    // Keep payment status for frontend
    paymentStatus: tenant.computedPaymentStatus,
    // Convert all financial fields
    tds: paisaToRupees(tenant.tdsPaisa || 0),
    rentalRate: paisaToRupees(tenant.rentalRatePaisa || 0),
    grossAmount: paisaToRupees(tenant.grossAmountPaisa || 0),
    totalRent: paisaToRupees(tenant.totalRentPaisa || 0),
    camCharges: paisaToRupees(tenant.camChargesPaisa || 0),
    netAmount: paisaToRupees(tenant.netAmountPaisa || 0),
    securityDeposit: paisaToRupees(tenant.securityDepositPaisa || 0),
    quarterlyRentAmount: paisaToRupees(tenant.quarterlyRentAmountPaisa || 0),
    pricePerSqft: paisaToRupees(tenant.pricePerSqftPaisa || 0),
    camRatePerSqft: paisaToRupees(tenant.camRatePerSqftPaisa || 0),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD UNITS TO EXISTING TENANT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add one or more new units to an existing active tenant.
 *
 * Creates separate new Rent + CAM documents for the added units
 * (does NOT modify existing Rent/CAM records), then recalculates
 * the tenant's aggregate financial fields.
 *
 * @param {string} tenantId
 * @param {Object} body
 * @param {Array}  body.newUnitLeases  - [{ unitId, leasedSquareFeet, pricePerSqft, camRatePerSqft }]
 * @param {string} adminId
 */
export async function addUnitsToTenant(tenantId, body, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tenant = await Tenant.findById(tenantId).session(session);
    if (!tenant) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 404, message: "Tenant not found" };
    }

    if (tenant.status === "vacated" || tenant.isDeleted) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: "Cannot add units to a vacated or deleted tenant",
      };
    }

    // ── Validate & parse new unit leases ──────────────────────────────────
    const newUnitLeases = body.newUnitLeases;
    if (!Array.isArray(newUnitLeases) || newUnitLeases.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: "newUnitLeases must be a non-empty array",
      };
    }

    const existingUnitIds = tenant.units.map((u) => u.toString());
    const newUnitIds = newUnitLeases.map((ul) => {
      if (!mongoose.Types.ObjectId.isValid(ul.unitId)) {
        throw new Error(`Invalid unitId: ${ul.unitId}`);
      }
      return ul.unitId.toString();
    });

    // Prevent duplicates
    const duplicates = newUnitIds.filter((id) => existingUnitIds.includes(id));
    if (duplicates.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: `Unit(s) already assigned to this tenant: ${duplicates.join(", ")}`,
      };
    }

    // ── Fetch & occupation-check new units ────────────────────────────────
    const newUnits = await Unit.find({
      _id: { $in: newUnitIds },
    }).session(session);

    if (newUnits.length !== newUnitIds.length) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 404, message: "One or more new units not found" };
    }

    const occupiedUnits = newUnits.filter((u) => u.isOccupied);
    if (occupiedUnits.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: `Units already occupied: ${occupiedUnits.map((u) => u.name).join(", ")}`,
      };
    }

    // ── Calculate financials for the NEW units only ───────────────────────
    const tdsPercentage = tenant.tdsPercentage ?? 10;
    const newCalc = calculateMultiUnitLease(newUnitLeases, tdsPercentage);
    const { totals: newTotals, units: newCalcUnits } = newCalc;

    const newTotalRentPaisa = rupeesToPaisa(newTotals.rentMonthly);
    const newCamPaisa = rupeesToPaisa(newTotals.camMonthly);
    const newGrossPaisa = rupeesToPaisa(newTotals.grossMonthly);
    const newTdsPaisa = rupeesToPaisa(newTotals.totalTds);
    const newSqft = newTotals.sqft;

    // ── Determine billing period (use current Nepali date) ────────────────
    const { npMonth, npYear, firstDayNepali, englishMonth, englishYear } =
      getNepaliMonthDates();

    const isQuarterly = tenant.rentPaymentFrequency === "quarterly";
    const periodMonths = isQuarterly ? 3 : 1;

    const { rentDueNp, rentDueDate } = getRentCycleDates({
      startYear: npYear,
      startMonth: npMonth,
      frequencyMonths: periodMonths,
    });

    // ── Resolve entity for journal entries ────────────────────────────────
    const entityId = await resolveEntityFromBlock(
      tenant.block.toString(),
      session,
    );

    // ── Create new Rent record for added units ────────────────────────────
    const grossRentPeriodPaisa = newGrossPaisa * periodMonths;
    const periodTdsPaisa = newTdsPaisa * periodMonths;

    const rentResult = await createNewRent(
      {
        tenant: tenant._id,
        innerBlock: tenant.innerBlock,
        block: tenant.block,
        property: tenant.property,
        grossRentAmountPaisa: grossRentPeriodPaisa,
        tdsAmountPaisa: periodTdsPaisa,
        paidAmountPaisa: 0,
        rentFrequency: tenant.rentPaymentFrequency,
        status: "pending",
        createdBy: adminId,
        units: newUnitIds.map((id) => new mongoose.Types.ObjectId(id)),
        nepaliMonth: npMonth,
        nepaliYear: npYear,
        nepaliDate: firstDayNepali,
        englishMonth,
        englishYear,
        nepaliDueDate: rentDueNp,
        englishDueDate: rentDueDate,
        lateFee: 0,
        useUnitBreakdown: true,
        unitBreakdown: newCalcUnits.map((u) => ({
          unit: new mongoose.Types.ObjectId(u.unitId),
          grossRentAmountPaisa: rupeesToPaisa(u.grossMonthly) * periodMonths,
          tdsAmountPaisa: rupeesToPaisa(u.totalTds) * periodMonths,
          paidAmountPaisa: 0,
        })),
      },
      session,
    );
    if (!rentResult.success) throw new Error(rentResult.message);

    await ledgerService.postJournalEntry(
      buildRentChargeJournal(rentResult.data),
      session,
      entityId,
    );
    await recordTdsLedgerEntry(rentResult.data, session, entityId);

    // ── Create new CAM record for added units ─────────────────────────────
    const camResult = await createCam(
      {
        tenant: tenant._id,
        property: tenant.property,
        block: tenant.block,
        innerBlock: tenant.innerBlock,
        nepaliMonth: npMonth,
        nepaliYear: npYear,
        nepaliDate: firstDayNepali,
        amountPaisa: newCamPaisa,
        amount: newTotals.camMonthly,
        status: "pending",
        year: englishYear,
        month: englishMonth,
        nepaliDueDate: rentDueDate,
        englishDueDate: rentDueDate,
      },
      adminId,
      session,
    );
    if (!camResult.success) throw new Error(camResult.message);

    await ledgerService.postJournalEntry(
      buildCamChargeJournal(camResult.data, { createdBy: adminId }),
      session,
      entityId,
    );

    // ── Occupy the new units ──────────────────────────────────────────────
    for (let i = 0; i < newUnits.length; i++) {
      const ul = newCalcUnits[i];
      await newUnits[i].occupy({
        tenant: tenant._id,
        leaseSquareFeet: ul.sqft,
        pricePerSqft: ul.pricePerSqft,
        camRatePerSqft: ul.camRatePerSqft,
        securityDeposit: ul.securityDeposit || 0,
        leaseStartDate: tenant.leaseStartDate,
        leaseEndDate: tenant.leaseEndDate,
        dateOfAgreementSigned: tenant.dateOfAgreementSigned,
        keyHandoverDate: tenant.keyHandoverDate,
        spaceHandoverDate: tenant.spaceHandoverDate,
        notes: "",
      });
      await newUnits[i].save({ session });
    }

    // ── Update tenant aggregate financials ────────────────────────────────
    // Add the new unit amounts on top of existing amounts
    const updatedTotalRentPaisa = tenant.totalRentPaisa + newTotalRentPaisa;
    const updatedCamPaisa = tenant.camChargesPaisa + newCamPaisa;
    const updatedGrossPaisa = tenant.grossAmountPaisa + newGrossPaisa;
    const updatedTdsPaisa = tenant.tdsPaisa + newTdsPaisa;
    const updatedSqft = tenant.leasedSquareFeet + newSqft;
    const updatedNetPaisa = updatedTotalRentPaisa + updatedCamPaisa;

    const updatedWeightedPricePerSqft = updatedGrossPaisa / updatedSqft;
    const updatedWeightedCamRate = updatedCamPaisa / updatedSqft;

    await Tenant.findByIdAndUpdate(
      tenantId,
      {
        $push: { units: { $each: newUnitIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        $set: {
          leasedSquareFeet: updatedSqft,
          totalRentPaisa: updatedTotalRentPaisa,
          camChargesPaisa: updatedCamPaisa,
          grossAmountPaisa: updatedGrossPaisa,
          tdsPaisa: updatedTdsPaisa,
          netAmountPaisa: updatedNetPaisa,
          rentalRatePaisa: divideMoney(updatedTotalRentPaisa, updatedSqft),
          pricePerSqftPaisa: rupeesToPaisa(updatedWeightedPricePerSqft),
          camRatePerSqftPaisa: rupeesToPaisa(updatedWeightedCamRate),
          pricePerSqft: updatedWeightedPricePerSqft,
          camRatePerSqft: updatedWeightedCamRate,
          ...(isQuarterly && {
            quarterlyRentAmountPaisa: updatedTotalRentPaisa * 3,
          }),
        },
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      statusCode: 200,
      message: `${newUnitIds.length} unit(s) added. New Rent and CAM records created.`,
      addedUnits: newUnitIds,
      newRentRecord: rentResult.data._id,
      newCamRecord: camResult.data._id,
      newMonthlyRent: paisaToRupees(newTotalRentPaisa),
      newMonthlyCam: paisaToRupees(newCamPaisa),
      updatedAggregateTotalRent: paisaToRupees(updatedTotalRentPaisa),
      updatedAggregateCam: paisaToRupees(updatedCamPaisa),
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("addUnitsToTenant error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Failed to add units to tenant",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function checkLeaseExpiringSoon(leaseEndDate) {
  if (!leaseEndDate) return false;
  const days = Math.ceil(
    (new Date(leaseEndDate) - new Date()) / (1000 * 60 * 60 * 24),
  );
  return days > 0 && days <= 60;
}

function calculateLeaseDuration(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate),
    e = new Date(endDate);
  return (
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  );
}

function hasFinancialChanges(updates, existing) {
  return [
    "leasedSquareFeet",
    "pricePerSqft",
    "pricePerSqftPaisa",
    "camRatePerSqft",
    "camRatePerSqftPaisa",
    "tdsPercentage",
  ].some((f) => {
    if (updates[f] === undefined) return false;
    return f.endsWith("Paisa")
      ? updates[f] !== existing[f]
      : Math.abs(Number(updates[f]) - Number(existing[f])) > 0.01;
  });
}

function recalculateTenantFinancials(tenant, updates) {
  const totalSqft = updates.leasedSquareFeet ?? tenant.leasedSquareFeet;
  const pricePerSqft =
    updates.pricePerSqft ?? paisaToRupees(tenant.pricePerSqftPaisa);
  const camRate =
    updates.camRatePerSqft ?? paisaToRupees(tenant.camRatePerSqftPaisa);
  const tdsPct = updates.tdsPercentage ?? tenant.tdsPercentage ?? 10;

  // Build one entry per unit; if the tenant has multiple units we spread the
  // total sqft evenly across them (rate changes apply uniformly to all units).
  const unitCount = Math.max(1, tenant.units?.length ?? 1);
  const sqftPerUnit = totalSqft / unitCount;
  const unitLeaseConfigs = (tenant.units?.length > 0 ? tenant.units : [{}]).map(
    (u) => ({
      unitId: u?._id?.toString() ?? u?.toString() ?? "unit",
      leasedSquareFeet: sqftPerUnit,
      pricePerSqft,
      camRatePerSqft: camRate,
      securityDeposit:
        updates.securityDeposit ?? paisaToRupees(tenant.securityDepositPaisa),
    }),
  );

  const calc = calculateMultiUnitLease(unitLeaseConfigs, tdsPct);

  const { totals } = calc;
  return {
    pricePerSqftPaisa: rupeesToPaisa(pricePerSqft),
    camRatePerSqftPaisa: rupeesToPaisa(camRate),
    tdsPaisa: rupeesToPaisa(totals.totalTds),
    rentalRatePaisa: rupeesToPaisa(totals.rentMonthly / totalSqft),
    grossAmountPaisa: rupeesToPaisa(totals.grossMonthly),
    totalRentPaisa: rupeesToPaisa(totals.rentMonthly),
    camChargesPaisa: rupeesToPaisa(totals.camMonthly),
    netAmountPaisa: rupeesToPaisa(totals.netMonthly),
    pricePerSqft,
    camRatePerSqft: camRate,
    tdsPercentage: tdsPct,
    leasedSquareFeet: totalSqft,
  };
}

/**
 * Update pending rent records after a financial change.
 *
 * FIX: was filtering on status "partial" — corrected to "partially_paid".
 */
async function updatePendingRentRecords(tenant, newFinancials, session) {
  // FIX: "partial" → "partially_paid" (correct enum value)
  const pendingRents = await Rent.find({
    tenant: tenant._id,
    status: { $in: ["pending", "partially_paid"] },
  }).session(session);

  let updatedCount = 0;

  for (const rent of pendingRents) {
    try {
      const multiplier = rent.rentFrequency === "quarterly" ? 3 : 1;
      const newRentAmount = newFinancials.totalRentPaisa * multiplier;
      const newTdsAmount = newFinancials.tdsPaisa * multiplier;

      if (
        Math.abs(rent.rentAmountPaisa - newRentAmount) > 1 ||
        Math.abs(rent.tdsAmountPaisa - newTdsAmount) > 1
      ) {
        rent.rentAmountPaisa = newRentAmount;
        rent.tdsAmountPaisa = newTdsAmount;
        await rent.save({ session });
        updatedCount++;
      }
    } catch (err) {
      console.error(`Failed to update rent ${rent._id}:`, err.message);
    }
  }

  return { updated: updatedCount };
}

async function updatePendingCAMRecords(tenant, newFinancials, session) {
  const pendingCams = await Cam.find({
    tenant: tenant._id,
    status: { $in: ["pending", "partially_paid"] },
  }).session(session);

  let updatedCount = 0;

  for (const cam of pendingCams) {
    try {
      const newAmount = newFinancials.camChargesPaisa;
      if (Math.abs(cam.amountPaisa - newAmount) > 1) {
        cam.amountPaisa = newAmount;
        await cam.save({ session });
        updatedCount++;
      }
    } catch (err) {
      console.error(`Failed to update CAM ${cam._id}:`, err.message);
    }
  }

  return { updated: updatedCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE RENT FREQUENCY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Change a tenant's rent payment frequency (monthly ↔ quarterly).
 *
 * strategy "clear":
 *   Cancels all pending/overdue Rent + CAM records, posts reversal journals,
 *   zeroes TenantBalance. A clean slate for the new billing cycle.
 *
 * strategy "carry_forward":
 *   Leaves pending/overdue records untouched. The outstanding amounts remain
 *   in TenantBalance and must be collected before or alongside the new cycle.
 *
 * Metadata (rentFrequencyChangedAt, rentFrequencyChangedBy,
 * rentFrequencyChangedReason) is always written to the Tenant document.
 */
export async function changeRentFrequency(tenantId, { newFrequency, reason, strategy, adminId }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tenant = await Tenant.findById(tenantId).session(session);
    if (!tenant) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 404, message: "Tenant not found" };
    }

    if (tenant.rentPaymentFrequency === newFrequency) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 400, message: `Frequency is already ${newFrequency}` };
    }

    if (!["monthly", "quarterly"].includes(newFrequency)) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 400, message: "Invalid frequency. Must be monthly or quarterly" };
    }

    if (!["clear", "carry_forward"].includes(strategy)) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 400, message: "Invalid strategy. Must be clear or carry_forward" };
    }

    if (!reason || !reason.trim()) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 400, message: "Reason is required" };
    }

    const entityId = await resolveEntityFromBlock(tenant.block.toString(), session);
    const now = new Date();

    let cancelledRents = 0;
    let cancelledCams = 0;

    if (strategy === "clear") {
      // ── Cancel pending / overdue Rent records ───────────────────────────
      const pendingRents = await Rent.find({
        tenant: tenant._id,
        status: { $in: ["pending", "overdue", "partially_paid"] },
      }).session(session);

      for (const rent of pendingRents) {
        const netUnpaidPaisa =
          (rent.grossRentAmountPaisa - (rent.tdsAmountPaisa || 0)) -
          (rent.paidAmountPaisa || 0);

        if (netUnpaidPaisa > 0) {
          const reversal = {
            transactionType: "RENT_CHARGE_CANCELLED",
            referenceType: "Rent",
            referenceId: rent._id,
            transactionDate: now,
            nepaliDate: rent.nepaliDate ?? null,
            nepaliMonth: rent.nepaliMonth,
            nepaliYear: rent.nepaliYear,
            description: `Rent charge cancelled — frequency change to ${newFrequency}. ${reason.trim()}`,
            createdBy: adminId ?? null,
            totalAmountPaisa: netUnpaidPaisa,
            tenant: tenant._id,
            property: tenant.property,
            entries: [
              {
                accountCode: ACCOUNT_CODES.REVENUE,
                debitAmountPaisa: netUnpaidPaisa,
                creditAmountPaisa: 0,
                description: "Reverse unearned rental income",
              },
              {
                accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
                debitAmountPaisa: 0,
                creditAmountPaisa: netUnpaidPaisa,
                description: "Clear tenant rent receivable",
              },
            ],
          };
          await ledgerService.postJournalEntry(reversal, session, entityId);
        }

        rent.status = "cancelled";
        rent.notes = (rent.notes || "") + `\nCancelled on ${now.toISOString()}: frequency change to ${newFrequency}. ${reason.trim()}`;
        await rent.save({ session });
        cancelledRents++;
      }

      // ── Cancel pending / overdue CAM records ────────────────────────────
      const pendingCams = await Cam.find({
        tenant: tenant._id,
        status: { $in: ["pending", "overdue", "partially_paid"] },
      }).session(session);

      for (const cam of pendingCams) {
        const unpaidPaisa = (cam.amountPaisa || 0) - (cam.paidAmountPaisa || 0);

        if (unpaidPaisa > 0) {
          const reversal = {
            transactionType: "CAM_CHARGE_CANCELLED",
            referenceType: "Cam",
            referenceId: cam._id,
            transactionDate: now,
            nepaliDate: cam.nepaliDate ?? null,
            nepaliMonth: cam.nepaliMonth,
            nepaliYear: cam.nepaliYear,
            description: `CAM charge cancelled — frequency change to ${newFrequency}. ${reason.trim()}`,
            createdBy: adminId ?? null,
            totalAmountPaisa: unpaidPaisa,
            tenant: tenant._id,
            property: tenant.property,
            entries: [
              {
                accountCode: ACCOUNT_CODES.CAM_REVENUE,
                debitAmountPaisa: unpaidPaisa,
                creditAmountPaisa: 0,
                description: "Reverse unearned CAM income",
              },
              {
                accountCode: ACCOUNT_CODES.CAM_RECEIVABLE,
                debitAmountPaisa: 0,
                creditAmountPaisa: unpaidPaisa,
                description: "Clear tenant CAM receivable",
              },
            ],
          };
          await ledgerService.postJournalEntry(reversal, session, entityId);
        }

        cam.status = "cancelled";
        cam.notes = (cam.notes || "") + `\nCancelled on ${now.toISOString()}: frequency change to ${newFrequency}. ${reason.trim()}`;
        await cam.save({ session });
        cancelledCams++;
      }

      // ── Zero TenantBalance ───────────────────────────────────────────────
      await TenantBalance.findOneAndUpdate(
        { tenant: tenant._id },
        { $set: { rentDuePaisa: 0, camDuePaisa: 0, lateFeeDuePaisa: 0, totalDuePaisa: 0 } },
        { session, upsert: false },
      );
    }

    // ── Update Tenant frequency + audit metadata ─────────────────────────
    const updateData = {
      rentPaymentFrequency: newFrequency,
      rentFrequencyChangedAt: now,
      rentFrequencyChangedBy: adminId ?? null,
      rentFrequencyChangedReason: reason.trim(),
    };

    if (newFrequency === "quarterly") {
      updateData.quarterlyRentAmountPaisa = tenant.totalRentPaisa * 3;
    } else {
      updateData.quarterlyRentAmountPaisa = 0;
    }

    await Tenant.findByIdAndUpdate(tenantId, { $set: updateData }, { session });

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      statusCode: 200,
      message: `Rent frequency changed to ${newFrequency}. ${strategy === "clear" ? `Cancelled ${cancelledRents} rent and ${cancelledCams} CAM record(s).` : "Existing pending records carried forward."}`,
      cancelledRents,
      cancelledCams,
      strategy,
      newFrequency,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("changeRentFrequency error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Failed to change rent frequency",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALATION DEFAULT (fire-and-forget)
// ─────────────────────────────────────────────────────────────────────────────

async function applyDefaultEscalationIfEnabled(tenantId) {
  const config = await SystemConfig.findOne({ key: "rentEscalationDefaults" });
  if (!config?.value?.enabled) return { applied: false };

  const {
    percentageIncrease,
    intervalMonths = 12,
    appliesTo = "rent_only",
  } = config.value;
  const result = await enableEscalation(tenantId, {
    percentageIncrease,
    intervalMonths,
    appliesTo,
  });
  return { applied: result.success };
}
