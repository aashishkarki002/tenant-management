/**
 * tenant.service.js  (FIXED)
 *
 * FIX — updatePendingRentRecords used wrong enum value:
 *   OLD: status: { $in: ["pending", "partial"] }
 *        ↑ "partial" is not in the Rent status enum — matched NOTHING silently.
 *          All partially-paid rents were skipped on financial recalculation.
 *   FIX: status: { $in: ["pending", "partially_paid"] }
 *
 * Everything else in tenant.service.js is unchanged.
 * Only the internal updatePendingRentRecords function is patched here.
 * The full file is included so you can drop it in place.
 */

import mongoose from "mongoose";
import { Tenant } from "./Tenant.Model.js";
import tenantValidation from "../../validations/tenantValidation.js";
import { Unit } from "../units/Unit.Model.js";
import { sendWelcomeEmail } from "../../config/nodemailer.js";
import { createTenantTransaction } from "./services/tenant.create.js";
import { uploadSingleFile } from "./helpers/fileUploadHelper.js";
import { paisaToRupees, rupeesToPaisa } from "../../utils/moneyUtil.js";
import { calculateMultiUnitLease } from "./domain/rent.calculator.service.js";
import { Rent } from "../rents/rent.Model.js";
import { Cam } from "../cam/cam.model.js";
import { SystemConfig } from "../systemConfig/SystemConfig.Model.js";
import { enableEscalation } from "./escalation/rent.escalation.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export async function createTenant(body, files, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
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

    if (Array.isArray(body.unitNumber) && !body.units)
      body.units = body.unitNumber;
    else if (body.unitNumber && !body.units) body.units = [body.unitNumber];

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
    ];
    const hasDocuments =
      files &&
      documentFields.some(
        (f) =>
          files[f] && (Array.isArray(files[f]) ? files[f].length > 0 : true),
      );

    if (!hasDocuments) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: "Tenant documents are required",
      };
    }

    const tenant = await createTenantTransaction(body, files, adminId, session);

    await session.commitTransaction();
    session.endSession();

    // Fire-and-forget: apply system escalation defaults if configured
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
  // Use the same aggregation as searchTenants (no filter stage) so that
  // paymentStatus is always computed from live Rent/CAM records.
  // A plain Tenant.find() has no access to Rent/CAM data and would leave
  // paymentStatus undefined, causing every card to show Paid on the
  // unfiltered list.
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
        select: "name unitNumber sqft price -__v",
      });

    if (!tenant) return null;

    tenant.units = (tenant.units || []).filter((u) => u != null);

    if (tenant.units.length > 0) {
      tenant.units = tenant.units.map((unit) => ({
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
    }

    const tenantJson = tenant.toJSON();
    return {
      ...tenantJson,
      units: tenant.units,
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

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

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
      // BS (Nepali) date strings — paired with their AD counterparts above
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
      { new: true, session },
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
  const softDeleted = await Tenant.findByIdAndUpdate(
    tenantId,
    { isDeleted: true },
    { new: true },
  );
  if (!softDeleted)
    return { success: false, statusCode: 404, message: "Tenant not found" };
  await Unit.updateMany(
    { _id: { $in: softDeleted.units } },
    { $set: { isOccupied: false } },
  );
  return {
    success: true,
    statusCode: 200,
    message: "Tenant deleted successfully",
    tenant: softDeleted,
  };
}

export async function restoreTenant(tenantId) {
  const restored = await Tenant.findByIdAndUpdate(
    tenantId,
    { isDeleted: false },
    { new: true },
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
                    // DUE SOON: unpaid and due within 7 days
                    {
                      $or: [
                        {
                          $and: [
                            { $ne: ["$$latestRent", null] },
                            {
                              $in: [
                                "$$latestRent.status",
                                ["pending", "partially_paid"],
                              ],
                            },
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
                            {
                              $in: [
                                "$$latestCam.status",
                                ["pending", "partially_paid"],
                              ],
                            },
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
                    // UPCOMING: unpaid but due is still far away (e.g. quarterly
                    // rent collected 3 months in advance). This is NOT "paid" —
                    // the debt exists, payment is just not urgent yet.
                    // Show as "due_soon" so the badge is honest.
                    // Only fall through to "paid" when there are genuinely no
                    // unpaid records at all.
                    {
                      $cond: [
                        {
                          $or: [
                            {
                              $and: [
                                { $ne: ["$$latestRent", null] },
                                {
                                  $in: [
                                    "$$latestRent.status",
                                    ["pending", "partially_paid"],
                                  ],
                                },
                              ],
                            },
                            {
                              $and: [
                                { $ne: ["$$latestCam", null] },
                                {
                                  $in: [
                                    "$$latestCam.status",
                                    ["pending", "partially_paid"],
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                        "due_soon", // unpaid + future due date > 7 days → still due_soon
                        "paid", // everything is genuinely paid
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
    const validPaymentStatuses = ["paid", "due_soon", "overdue"];
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
  const sqft = updates.leasedSquareFeet ?? tenant.leasedSquareFeet;
  const pricePerSqft =
    updates.pricePerSqft ?? paisaToRupees(tenant.pricePerSqftPaisa);
  const camRate =
    updates.camRatePerSqft ?? paisaToRupees(tenant.camRatePerSqftPaisa);
  const tdsPct = updates.tdsPercentage ?? tenant.tdsPercentage ?? 10;

  const calc = calculateMultiUnitLease(
    [
      {
        unitId: tenant.units[0]?.toString() || tenant.units[0]?._id?.toString(),
        leasedSquareFeet: sqft,
        pricePerSqft,
        camRatePerSqft: camRate,
        securityDeposit:
          updates.securityDeposit ?? paisaToRupees(tenant.securityDepositPaisa),
      },
    ],
    tdsPct,
  );

  const { totals } = calc;
  return {
    pricePerSqftPaisa: rupeesToPaisa(pricePerSqft),
    camRatePerSqftPaisa: rupeesToPaisa(camRate),
    tdsPaisa: rupeesToPaisa(totals.totalTds),
    rentalRatePaisa: rupeesToPaisa(totals.rentMonthly / sqft),
    grossAmountPaisa: rupeesToPaisa(totals.grossMonthly),
    totalRentPaisa: rupeesToPaisa(totals.rentMonthly),
    camChargesPaisa: rupeesToPaisa(totals.camMonthly),
    netAmountPaisa: rupeesToPaisa(totals.netMonthly),
    pricePerSqft,
    camRatePerSqft: camRate,
    tdsPercentage: tdsPct,
    leasedSquareFeet: sqft,
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
