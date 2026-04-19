import mongoose from "mongoose";
import { Rent } from "./rent.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import adminModel from "../auth/admin.Model.js";
import { getNepaliMonthDates } from "../../utils/nepaliDateHelper.js";
import dotenv from "dotenv";
import { sendEmail } from "../../config/nodemailer.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildRentChargeJournal,
  buildTdsWithheldJournal,
  buildTdsPaidToGovernmentJournal,
  buildCamChargeJournal,
} from "../ledger/journal-builders/index.js";
import { Unit } from "../units/unit.model.js";
import Notification from "../notifications/notification.model.js";
import NepaliDate from "nepali-datetime";
import { getIO } from "../../config/socket.js";
import { Cam } from "../cam/cam.model.js";
import {
  rupeesToPaisa,
  paisaToRupees,
  formatMoney,
} from "../../utils/moneyUtil.js";
import { calculateRentTotals } from "./helpers/rentTotal.helper.js";
import { buildEntityMapForBlocks } from "../../helper/resolveEntity.js"; // ← NEW

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// QUERY BUILDER (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function buildRentsFilter(filters = {}) {
  const query = {};

  if (filters.tenantId && mongoose.Types.ObjectId.isValid(filters.tenantId))
    query.tenant = new mongoose.Types.ObjectId(filters.tenantId);

  if (filters.propertyId && mongoose.Types.ObjectId.isValid(filters.propertyId))
    query.property = new mongoose.Types.ObjectId(filters.propertyId);

  if (
    ["pending", "paid", "partially_paid", "overdue", "cancelled"].includes(
      filters.status,
    )
  )
    query.status = filters.status;

  if (filters.nepaliMonthStart != null && filters.nepaliMonthEnd != null) {
    const start = Number(filters.nepaliMonthStart);
    const end = Number(filters.nepaliMonthEnd);
    if (start >= 1 && start <= 12 && end >= 1 && end <= 12)
      query.nepaliMonth = { $gte: start, $lte: end };
  } else if (filters.nepaliMonth != null) {
    const m = Number(filters.nepaliMonth);
    if (m >= 1 && m <= 12) query.nepaliMonth = m;
  }

  if (filters.nepaliYear != null) {
    const y = Number(filters.nepaliYear);
    if (!Number.isNaN(y)) query.nepaliYear = y;
  }

  if (filters.startDate || filters.endDate) {
    query.englishDueDate = {};
    if (filters.startDate)
      query.englishDueDate.$gte = new Date(filters.startDate);
    if (filters.endDate) query.englishDueDate.$lte = new Date(filters.endDate);
  }

  return query;
}
export async function buildCarryForwardMap(tenantIds, prevNpYear, prevNpMonth) {
  const prevRents = await Rent.find({
    tenant: { $in: tenantIds },
    nepaliYear: prevNpYear,
    nepaliMonth: prevNpMonth,
    status: { $in: ["pending", "partially_paid", "overdue"] },
  })
    .select(
      "tenant grossRentAmountPaisa tdsAmountPaisa paidAmountPaisa lateFeePaisa latePaidAmountPaisa",
    )
    .lean();

  const map = new Map();
  for (const r of prevRents) {
    const netRent = r.grossRentAmountPaisa - (r.tdsAmountPaisa || 0);
    const remaining = netRent - r.paidAmountPaisa;
    const lateFeeRemaining = Math.max(
      0,
      (r.lateFeePaisa || 0) - (r.latePaidAmountPaisa || 0),
    );
    map.set(r.tenant.toString(), {
      remainingAmountPaisa: Math.max(0, remaining) + lateFeeRemaining,
      carryForwardFromRentId: r._id,
    });
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

import { TenantBalance } from "../tenantBalance/tenantBalance.model.js";

export async function getRentsService(filters = {}) {
  try {
    const rents = await Rent.find(buildRentsFilter(filters))
      .sort({ nepaliDueDate: 1 })
      .populate({
        path: "tenant",
        match: { isDeleted: false },
        select: "name email camChargesPaisa camCharges rentPaymentFrequency",
      })
      .populate({ path: "innerBlock", select: "name" })
      .populate({ path: "block", select: "name" })
      .populate({ path: "property", select: "name" })
      .populate({ path: "units", select: "name" });

    const filtered = rents.filter((r) => r.tenant);
    if (!filtered.length) return { success: true, rents: [] };

    // ── Batch balance lookup — one query for ALL tenants in this page ────────
    const tenantIds = [
      ...new Set(filtered.map((r) => r.tenant._id.toString())),
    ];

    const balanceDocs = await TenantBalance.find(
      { tenant: { $in: tenantIds } },
      {
        tenant: 1,
        rentDuePaisa: 1,
        camDuePaisa: 1,
        lateFeeDuePaisa: 1,
        totalDuePaisa: 1,
        oldestOverdueNepaliYear: 1,
        oldestOverdueNepaliMonth: 1,
      },
    ).lean();

    const balanceByTenant = new Map(
      balanceDocs.map((b) => [b.tenant.toString(), b]),
    );

    // ── Build result ─────────────────────────────────────────────────────────
    const result = filtered.map((rent) => {
      const rentObj = rent.toObject({ virtuals: false, getters: false });
      const t = calculateRentTotals(rent);
      const balance = balanceByTenant.get(rent.tenant._id.toString()) ?? null;

      // ── prevBalance logic ──────────────────────────────────────────────────
      // balance.totalDuePaisa = ALL open dues for this tenant (rent + cam + late fee,
      //                         across ALL months) as maintained by syncTenantBalance().
      //
      // thisRentRemainingPaisa = what THIS specific rent document still owes,
      //                          i.e. the portion of totalDuePaisa that belongs
      //                          to the row currently being rendered.
      //
      // prevBalancePaisa = everything else the tenant owes that is NOT this row —
      //                    overdue months buried behind the current period filter.
      //
      // We use remainingAmountPaisa (net rent unpaid) + remaining late fee
      // because that is exactly what syncTenantBalance() accumulates: it does NOT
      // include CAM here since CAM has its own document and is already in
      // balance.camDuePaisa separately.
      const thisRentRemainingPaisa =
        t.remainingAmountPaisa + // net rent unpaid
        Math.max(0, (t.lateFeePaisa || 0) - (rentObj.latePaidAmountPaisa || 0)); // late fee unpaid

      const prevBalancePaisa = balance
        ? Math.max(0, balance.totalDuePaisa - thisRentRemainingPaisa)
        : 0;

      const hasPrevBalance = prevBalancePaisa > 0;

      return {
        ...rentObj,
        totals: {
          grossRentAmountPaisa: t.grossRentAmountPaisa,
          tdsAmountPaisa: t.tdsAmountPaisa,
          netRentAmountPaisa: t.netRentAmountPaisa,
          paidAmountPaisa: t.paidAmountPaisa,
          remainingAmountPaisa: t.remainingAmountPaisa,
          lateFeePaisa: t.lateFeePaisa,
          totalDuePaisa: t.totalDuePaisa,
          carryForwardBalancePaisa: t.carryForwardBalancePaisa,
          carryForwardFromRentId: t.carryForwardFromRentId,
        },
        formatted: {
          grossRentAmount: formatMoney(t.grossRentAmountPaisa),
          tdsAmount: formatMoney(t.tdsAmountPaisa),
          netRentAmount: formatMoney(t.netRentAmountPaisa),
          paidAmount: formatMoney(t.paidAmountPaisa),
          remainingAmount: formatMoney(t.remainingAmountPaisa),
          lateFee: formatMoney(t.lateFeePaisa),
          totalDue: formatMoney(t.totalDuePaisa),
          carryForwardBalance: formatMoney(t.carryForwardBalancePaisa),
          carryForwardFromRentId: t.carryForwardFromRentId,
        },
        prevBalance: hasPrevBalance
          ? {
              totalDuePaisa: balance.totalDuePaisa,
              rentDuePaisa: balance.rentDuePaisa,
              camDuePaisa: balance.camDuePaisa,
              lateFeeDuePaisa: balance.lateFeeDuePaisa,
              prevBalancePaisa,
              formatted: {
                totalDue: formatMoney(balance.totalDuePaisa),
                prevBalance: formatMoney(prevBalancePaisa),
              },
              oldestOverdueNepaliYear: balance.oldestOverdueNepaliYear,
              oldestOverdueNepaliMonth: balance.oldestOverdueNepaliMonth,
            }
          : null,
      };
    });

    return { success: true, rents: result };
  } catch (error) {
    console.error("[getRentsService]", error.message);
    return {
      success: false,
      message: "Rents fetching failed",
      error: error.message,
    };
  }
}

export async function getRentByIdService(rentId) {
  try {
    const rent = await Rent.findById(rentId)
      .populate("tenant")
      .populate("innerBlock")
      .populate("block")
      .populate("property")
      .populate("units")
      .populate({ path: "unitBreakdown.unit", select: "name" });

    if (!rent)
      return { success: false, statusCode: 404, message: "Rent not found" };

    const rentObj = rent.toObject({ virtuals: false, getters: false });
    const t = calculateRentTotals(rent);

    return {
      success: true,
      rent: {
        ...rentObj,
        totals: {
          grossRentAmountPaisa: t.grossRentAmountPaisa,
          tdsAmountPaisa: t.tdsAmountPaisa,
          netRentAmountPaisa: t.netRentAmountPaisa,
          paidAmountPaisa: t.paidAmountPaisa,
          remainingAmountPaisa: t.remainingAmountPaisa,
          lateFeePaisa: t.lateFeePaisa,
          totalDuePaisa: t.totalDuePaisa,
        },
        formatted: {
          grossRentAmount: formatMoney(t.grossRentAmountPaisa),
          tdsAmount: formatMoney(t.tdsAmountPaisa),
          netRentAmount: formatMoney(t.netRentAmountPaisa),
          paidAmount: formatMoney(t.paidAmountPaisa),
          remainingAmount: formatMoney(t.remainingAmountPaisa),
          lateFee: formatMoney(t.lateFeePaisa),
          totalDue: formatMoney(t.totalDuePaisa),
        },
      },
    };
  } catch (error) {
    console.error("[getRentByIdService]", error.message);
    return {
      success: false,
      message: "Rent fetching failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_STATUSES = [
  "pending",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
];

export async function updateRentService(rentId, body) {
  try {
    const rent = await Rent.findById(rentId);
    if (!rent)
      return { success: false, statusCode: 404, message: "Rent not found" };

    if (body.lateFeePaisa !== undefined) {
      const lf = Number(body.lateFeePaisa);
      if (!Number.isInteger(lf) || lf < 0) {
        return {
          success: false,
          statusCode: 400,
          message: "lateFeePaisa must be a non-negative integer",
        };
      }
      rent.lateFeePaisa = lf;
      rent.lateFeeApplied = lf > 0;
      rent.lateFeeDate =
        lf > 0
          ? body.lateFeeDate
            ? new Date(body.lateFeeDate)
            : new Date()
          : null;
      if (lf > 0) rent.lateFeeStatus = "pending";
    }

    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(body.status)) {
        return {
          success: false,
          statusCode: 400,
          message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
        };
      }
      rent.status = body.status;
    }

    if (body.lateFeeApplied !== undefined)
      rent.lateFeeApplied = Boolean(body.lateFeeApplied);
    if (body.lateFeeDate !== undefined)
      rent.lateFeeDate = body.lateFeeDate ? new Date(body.lateFeeDate) : null;

    await rent.save();
    const result = await getRentByIdService(rentId);
    return {
      success: true,
      rent: result.success ? result.rent : rent.toObject(),
      message: "Rent updated successfully",
    };
  } catch (error) {
    console.error("[updateRentService]", error.message);
    return {
      success: false,
      message: error.message || "Rent update failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE — now accepts entityId and passes it to postJournalEntry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} rentData
 * @param {import('mongoose').ClientSession|null} session
 * @param {import('mongoose').Types.ObjectId|null} entityId  ← NEW param
 */
export async function createNewRent(rentData, session = null, entityId = null) {
  try {
    if (!Number.isInteger(rentData.grossRentAmountPaisa))
      throw new Error(
        `grossRentAmountPaisa must be integer, got: ${rentData.grossRentAmountPaisa}`,
      );
    if (!Number.isInteger(rentData.tdsAmountPaisa))
      throw new Error(
        `tdsAmountPaisa must be integer, got: ${rentData.tdsAmountPaisa}`,
      );

    rentData.paidAmountPaisa ??= 0;
    rentData.lateFeePaisa ??= 0;

    if (rentData.unitBreakdown?.length > 0) {
      rentData.unitBreakdown = rentData.unitBreakdown.map((ub) => {
        if (!Number.isInteger(ub.grossRentAmountPaisa))
          throw new Error(
            `Unit grossRentAmountPaisa must be integer, got: ${ub.grossRentAmountPaisa}`,
          );
        return {
          ...ub,
          tdsAmountPaisa: ub.tdsAmountPaisa ?? 0,
          paidAmountPaisa: ub.paidAmountPaisa ?? 0,
        };
      });
    }

    const opts = session ? { session } : {};
    const created = await Rent.create([rentData], opts);

    // NOTE: journal is posted by the CALLER (tenant.create.js) so that it
    // shares the same session and entityId. createNewRent only persists the
    // document. If called from handleMonthlyRents the journal is posted there.
    return {
      success: true,
      message: "Rent created successfully",
      data: created[0],
    };
  } catch (error) {
    console.error("[createNewRent]", error.message);
    return {
      success: false,
      message: "Failed to create rent",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TDS LEDGER HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Post a non-cash TDS withheld ledger entry for a rent document.
 *
 * The entry debits TDS_RECOVERABLE (1300) and credits ACCOUNTS_RECEIVABLE (1200)
 * so the tenant's net AR obligation reflects only the cash they will pay to
 * the landlord. No cash or bank account is touched.
 *
 * Safe to call multiple times — returns early if:
 *   • tdsAmountPaisa === 0  (no TDS on this rent)
 *   • tdsRecordedInLedger is already true  (duplicate guard)
 *
 * After posting, the flag is set atomically via findByIdAndUpdate so the
 * update is session-aware and survives an abort on the caller's side.
 *
 * @param {import('./rent.Model.js').Rent} rent       - Mongoose document with _id
 * @param {import('mongoose').ClientSession|null} session
 * @param {import('mongoose').Types.ObjectId|null} entityId
 * @returns {Promise<{ success: boolean, skipped?: boolean, reason?: string }>}
 */
export async function recordTdsLedgerEntry(rent, session, entityId) {
  if (!rent.tdsAmountPaisa || rent.tdsAmountPaisa === 0) {
    return { success: true, skipped: true, reason: "no_tds" };
  }

  if (rent.tdsRecordedInLedger) {
    return { success: true, skipped: true, reason: "already_recorded" };
  }

  const payload = buildTdsWithheldJournal(rent);
  await ledgerService.postJournalEntry(payload, session, entityId);

  await Rent.findByIdAndUpdate(
    rent._id,
    { $set: { tdsRecordedInLedger: true } },
    session ? { session } : {},
  );

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// TDS PAYMENT TO GOVERNMENT VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark TDS as paid to government and post verification journal entry.
 *
 * Posts a non-cash journal entry that moves TDS from "Recoverable (unverified)"
 * to "Verified Paid" account for proper balance sheet tracking.
 *
 * Safe to call — returns early if:
 *   • tdsAmountPaisa === 0
 *   • tdsRecordedInLedger === false (withheld entry must exist first)
 *   • tdsPaidToGovernment === true (already verified)
 *
 * @param {import('mongoose').Types.ObjectId|string} rentId
 * @param {import('mongoose').Types.ObjectId|string} adminId - who verified the payment
 * @param {Object} data - { tdsPaidDate?: Date, nepaliTdsPaidDate?: string, tdsPaidNotes?: string }
 * @param {import('mongoose').ClientSession|null} session
 * @param {import('mongoose').Types.ObjectId|null} entityId
 * @returns {Promise<{ success: boolean, skipped?: boolean, reason?: string, rent?: Object }>}
 */
export async function markTdsPaidToGovernment(
  rentId,
  adminId,
  data = {},
  session = null,
  entityId = null,
) {
  const rent = await Rent.findById(rentId).populate("tenant", "name");

  if (!rent) {
    throw new Error("Rent not found");
  }

  if (!rent.tdsAmountPaisa || rent.tdsAmountPaisa === 0) {
    return { success: true, skipped: true, reason: "no_tds" };
  }

  if (!rent.tdsRecordedInLedger) {
    throw new Error(
      "TDS not yet recorded in ledger. Cannot mark as paid before withheld entry exists.",
    );
  }

  if (rent.tdsPaidToGovernment) {
    return {
      success: true,
      skipped: true,
      reason: "already_marked_paid",
      rent,
    };
  }

  // Update rent document
  rent.tdsPaidToGovernment = true;
  rent.tdsPaidDate = data.tdsPaidDate || new Date();
  rent.nepaliTdsPaidDate = data.nepaliTdsPaidDate || null;
  rent.tdsPaidVerifiedBy = adminId;
  rent.tdsPaidNotes = data.tdsPaidNotes || null;

  await rent.save({ session });

  // Post journal entry (moves from TDS_RECOVERABLE to TDS_VERIFIED_PAID)
  if (entityId) {
    const payload = buildTdsPaidToGovernmentJournal(rent);
    await ledgerService.postJournalEntry(payload, session, entityId);
  }

  return { success: true, rent };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON: handleMonthlyRents — entity-aware via buildEntityMapForBlocks
// ─────────────────────────────────────────────────────────────────────────────

export async function handleMonthlyRents(adminId) {
  const createdBy = adminId || process.env.SYSTEM_ADMIN_ID;
  const {
    npMonth,
    npYear,
    firstDayNepali,
    lastDayNepali,
    englishDueDate,
    englishMonth,
    englishYear,
  } = getNepaliMonthDates();

  try {
    // Step 1: Mark overdue
    const overdueResult = await Rent.updateMany(
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

    // Step 2: Active tenants
    const tenants = await Tenant.find({
      status: "active",
      isDeleted: false,
    }).lean();

    if (!tenants.length) {
      return {
        success: true,
        message: "No active tenants",
        createdCount: 0,
        updatedOverdueCount: 0,
      };
    }

    // Step 3: Idempotency
    const existingRents = await Rent.find({
      nepaliMonth: npMonth,
      nepaliYear: npYear,
    }).select("tenant");
    const existingTenantIds = new Set(
      existingRents.map((r) => r.tenant.toString()),
    );

    const tenantsToProcess = tenants.filter(
      (t) => !existingTenantIds.has(t._id.toString()),
    );

    if (!tenantsToProcess.length) {
      return {
        success: true,
        message: "All rents for this month already exist",
        createdCount: 0,
        updatedOverdueCount: overdueResult.modifiedCount,
      };
    }
    const prevNpMonth = npMonth === 1 ? 12 : npMonth - 1;
    const prevNpYear = npMonth === 1 ? npYear - 1 : npYear;

    const carryForwardMap = await buildCarryForwardMap(
      tenantsToProcess.map((t) => t.id),
      prevNpMonth,
      prevNpYear,
    );
    // Step 4: Batch-resolve entityId — ONE query for all blocks ← NEW
    const entityByBlock = await buildEntityMapForBlocks(
      tenantsToProcess.map((t) => t.block),
    );

    const overdueRents = await Rent.find({
      tenant: { $in: tenantsToProcess.map((t) => t._id) },
      status: "overdue",
    })
      .select(
        "tenant grossRentAmountPaisa tdsAmountPaisa paidAmountPaisa lateFeePaisa latePaidAmountPaisa",
      )
      .lean();

    for (const r of overdueRents) {
      const tId = r.tenant.toString();
      const effectivePaisa = r.grossRentAmountPaisa - (r.tdsAmountPaisa || 0);
      const remainingPaisa = effectivePaisa - (r.paidAmountPaisa || 0);
      const lateFeeRemainingPaisa =
        (r.lateFeePaisa || 0) - (r.latePaidAmountPaisa || 0);
      const prev = carryForwardMap.get(tId) || 0;
      carryForwardMap.set(
        tId,
        prev + Math.max(0, remainingPaisa) + Math.max(0, lateFeeRemainingPaisa),
      );
    }

    // Step 5: Build rent documents (unchanged shape)
    const rentsToInsert = tenantsToProcess.map((tenant) => {
      // grossRentAmountPaisa must be GROSS (= net + TDS) so that:
      //   RENT_CHARGE  → DR AR = GROSS
      //   TDS_WITHHELD → CR AR = TDS  →  net AR = GROSS - TDS = NET cash owed
      //
      // grossAmountPaisa is the stored gross monthly rent on the Tenant document.
      // For tenants created before this fix, grossAmountPaisa may be 0; in that
      // case fall back to totalRentPaisa (NET) with tdsAmountPaisa = 0 — the AR
      // will be slightly overstated but won't cause a negative balance.
      //
      // tdsAmountPaisa: derive from gross - net (NOT from tdsPaisa which is a
      // per-sqft rate, not the total monthly TDS amount).
      const grossPaisa = tenant.grossAmountPaisa || 0;
      const netPaisa =
        tenant.totalRentPaisa || rupeesToPaisa(tenant.totalRent || 0);
      const grossRentAmountPaisa = grossPaisa || netPaisa;
      const tdsAmountPaisa =
        grossPaisa > 0 ? Math.max(0, grossPaisa - netPaisa) : 0;
      const cf = carryForwardMap.get(tenant._id.toString());

      return {
        tenant: tenant._id,
        innerBlock: tenant.innerBlock,
        block: tenant.block,
        property: tenant.property,
        nepaliMonth: npMonth,
        nepaliYear: npYear,
        nepaliDate: firstDayNepali,
        grossRentAmountPaisa,
        tdsAmountPaisa,
        paidAmountPaisa: 0,
        lateFeePaisa: 0,
        units: tenant.units,
        createdBy,
        nepaliDueDate: lastDayNepali,
        englishDueDate,
        englishMonth,
        englishYear,
        status: "pending",
        rentFrequency: tenant.rentPaymentFrequency || "monthly",
        carryForwardBalancePaisa: cf.remainingAmountPaisa ?? 0,
        carryForwardFromRentId: cf.carryForwardFromRentId ?? null,
      };
    });

    // Step 6: Bulk insert (unchanged)
    const insertedRents = await Rent.insertMany(rentsToInsert);

    // Step 7: Post journal per rent — entity-tagged ← CHANGED
    const journalLog = { success: 0, failed: 0, errors: [] };

    for (const rent of insertedRents) {
      const entityId = entityByBlock.get(rent.block?.toString()) ?? null;

      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        // 1. Rent charge: DR Accounts Receivable / CR Rent Revenue (gross)
        const payload = buildRentChargeJournal(rent);
        await ledgerService.postJournalEntry(payload, session, entityId);

        // 2. TDS withheld (non-cash): DR TDS Recoverable / CR Accounts Receivable
        //    Reduces AR to the net amount the tenant pays in cash.
        //    Skipped automatically when tdsAmountPaisa === 0.
        await recordTdsLedgerEntry(rent, session, entityId);

        await session.commitTransaction();
        journalLog.success++;
      } catch (err) {
        await session.abortTransaction();
        journalLog.failed++;
        journalLog.errors.push({ rentId: rent._id, error: err.message });
        console.error(
          `[handleMonthlyRents] journal failed for ${rent._id}:`,
          err.message,
        );
      } finally {
        session.endSession();
      }
    }

    return {
      success: true,
      message: `${insertedRents.length} rents created, ${journalLog.success} journaled, ${journalLog.failed} journal errors`,
      createdCount: insertedRents.length,
      updatedOverdueCount: overdueResult.modifiedCount,
      journalErrors: journalLog.errors.length ? journalLog.errors : undefined,
    };
  } catch (error) {
    console.error("[handleMonthlyRents]", error.message);
    return {
      success: false,
      message: "Rents processing failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: backfillTenantRents — create past-month rents for a single tenant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create rent records for a specific tenant for one or more past months.
 *
 * Use case: tenant was onboarded late, cron was missed, or historical records
 * are being entered retroactively. This is idempotent — months that already
 * have a rent record are skipped and reported.
 *
 * @param {string} tenantId - MongoDB ObjectId string
 * @param {{ nepaliYear: number, nepaliMonth: number }[]} monthsToCreate - 1-based months
 * @param {string} adminId - who triggered the backfill
 * @returns {Promise<{ success: boolean, created: string[], skipped: string[], message: string }>}
 */
export async function backfillTenantRents(tenantId, monthsToCreate, adminId) {
  try {
    // 1. Fetch and validate tenant
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) {
      return { success: false, message: "Tenant not found" };
    }
    if (tenant.status !== "active" || tenant.isDeleted) {
      return { success: false, message: "Tenant is not active" };
    }

    // 2. Idempotency — check which months already have a rent record
    const existingRents = await Rent.find({
      tenant: tenant._id,
      $or: monthsToCreate.map((m) => ({
        nepaliYear: m.nepaliYear,
        nepaliMonth: m.nepaliMonth,
      })),
    }).select("nepaliYear nepaliMonth");

    const existingSet = new Set(
      existingRents.map((r) => `${r.nepaliYear}-${r.nepaliMonth}`),
    );

    const toCreate = monthsToCreate.filter(
      (m) => !existingSet.has(`${m.nepaliYear}-${m.nepaliMonth}`),
    );
    const skipped = monthsToCreate
      .filter((m) => existingSet.has(`${m.nepaliYear}-${m.nepaliMonth}`))
      .map((m) => `${m.nepaliYear}-${m.nepaliMonth}`);

    if (!toCreate.length) {
      return {
        success: true,
        message:
          "All requested months already have rent records — nothing created",
        created: [],
        skipped,
      };
    }

    // 3. Resolve entityId for journals (one batch query)
    const entityByBlock = await buildEntityMapForBlocks([tenant.block]);
    const entityId = entityByBlock.get(tenant.block?.toString()) ?? null;

    // 4. Fetch per-unit lease data to build unit breakdown
    const unitDocs =
      tenant.units?.length > 0
        ? await Unit.find({ _id: { $in: tenant.units } }).lean()
        : [];

    const tdsPercentage = tenant.tdsPercentage || 10;

    // Build the per-unit breakdown using each unit's currentLease data.
    // Uses the same reverse-TDS formula as calculateUnitLease().
    const unitBreakdownBase = unitDocs
      .filter(
        (u) =>
          u.currentLease?.leaseSquareFeet > 0 &&
          u.currentLease?.pricePerSqft > 0,
      )
      .map((u) => {
        const pricePerSqft = u.currentLease.pricePerSqft;
        const sqft = u.currentLease.leaseSquareFeet;
        const camRate = u.currentLease.camRatePerSqft || 0;
        const unitTdsRate =
          (u.currentLease.tdsPercentage || tdsPercentage) / 100;
        // Reverse TDS: gross already includes TDS, so TDS = gross - net
        const tdsPerSqft = pricePerSqft - pricePerSqft / (1 + unitTdsRate);
        return {
          unit: u._id,
          grossRentAmountPaisa: rupeesToPaisa(pricePerSqft * sqft),
          tdsAmountPaisa: rupeesToPaisa(tdsPerSqft * sqft),
          pricePerSqft,
          sqft,
          camRate,
        };
      });

    // Only use unit breakdown if ALL units have valid currentLease data
    const useUnitBreakdown =
      unitBreakdownBase.length > 0 &&
      unitBreakdownBase.length === (tenant.units?.length ?? 0);

    // 5. Build rent documents
    const grossPaisa = tenant.grossAmountPaisa || 0;
    const netPaisa =
      tenant.totalRentPaisa || rupeesToPaisa(tenant.totalRent || 0);
    const grossRentAmountPaisa = grossPaisa || netPaisa;
    const tdsAmountPaisa =
      grossPaisa > 0 ? Math.max(0, grossPaisa - netPaisa) : 0;

    const rentsToInsert = toCreate.map(({ nepaliYear, nepaliMonth }) => {
      // nepaliMonth in DB is 1-based; getNepaliMonthDates expects 0-based
      const {
        firstDayNepali,
        lastDayNepali,
        englishDueDate,
        englishMonth,
        englishYear,
      } = getNepaliMonthDates(nepaliYear, nepaliMonth - 1);

      const doc = {
        tenant: tenant._id,
        innerBlock: tenant.innerBlock,
        block: tenant.block,
        property: tenant.property,
        units: tenant.units,
        nepaliYear,
        nepaliMonth,
        nepaliDate: firstDayNepali,
        nepaliDueDate: lastDayNepali,
        englishDueDate,
        englishMonth,
        englishYear,
        grossRentAmountPaisa,
        tdsAmountPaisa,
        paidAmountPaisa: 0,
        lateFeePaisa: 0,
        carryForwardBalancePaisa: 0,
        status: "overdue", // past months are immediately overdue
        rentFrequency: tenant.rentPaymentFrequency || "monthly",
        createdBy: adminId,
        useUnitBreakdown,
      };

      if (useUnitBreakdown) {
        doc.unitBreakdown = unitBreakdownBase.map((ub) => ({
          unit: ub.unit,
          grossRentAmountPaisa: ub.grossRentAmountPaisa,
          tdsAmountPaisa: ub.tdsAmountPaisa,
          paidAmountPaisa: 0,
          status: "overdue",
          pricePerSqft: ub.pricePerSqft,
          sqft: ub.sqft,
          camRate: ub.camRate,
        }));
      }

      return doc;
    });

    // 6. Bulk insert rents
    const insertedRents = await Rent.insertMany(rentsToInsert);

    // 7. Post rent + TDS journals per rent
    const rentJournalLog = { success: 0, failed: 0, errors: [] };

    for (const rent of insertedRents) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();

        const payload = buildRentChargeJournal(rent);
        await ledgerService.postJournalEntry(payload, session, entityId);

        await recordTdsLedgerEntry(rent, session, entityId);

        await session.commitTransaction();
        rentJournalLog.success++;
      } catch (err) {
        await session.abortTransaction();
        rentJournalLog.failed++;
        rentJournalLog.errors.push({ rentId: rent._id, error: err.message });
        console.error(
          `[backfillTenantRents] rent journal failed for ${rent._id}:`,
          err.message,
        );
      } finally {
        session.endSession();
      }
    }

    // 8. Create CAM records for each backfilled month
    const camAmountPaisa =
      tenant.camChargesPaisa || rupeesToPaisa(tenant.camCharges || 0);
    const camLog = { created: 0, skippedExisting: 0, failed: 0, errors: [] };

    if (camAmountPaisa > 0) {
      // Idempotency — skip months that already have a CAM
      const existingCams = await Cam.find({
        tenant: tenant._id,
        $or: toCreate.map((m) => ({
          nepaliYear: m.nepaliYear,
          nepaliMonth: m.nepaliMonth,
        })),
      }).select("nepaliYear nepaliMonth");

      const existingCamSet = new Set(
        existingCams.map((c) => `${c.nepaliYear}-${c.nepaliMonth}`),
      );

      for (const { nepaliYear, nepaliMonth } of toCreate) {
        if (existingCamSet.has(`${nepaliYear}-${nepaliMonth}`)) {
          camLog.skippedExisting++;
          continue;
        }

        const {
          firstDayNepali: nepaliDate,
          lastDayNepali: nepaliDueDate,
          englishDueDate,
          englishMonth,
          englishYear,
        } = getNepaliMonthDates(nepaliYear, nepaliMonth - 1);

        try {
          const [cam] = await Cam.create([
            {
              tenant: tenant._id,
              property: tenant.property,
              block: tenant.block,
              innerBlock: tenant.innerBlock,
              nepaliMonth,
              nepaliYear,
              nepaliDate,
              amountPaisa: camAmountPaisa,
              amount: paisaToRupees(camAmountPaisa),
              paidAmountPaisa: 0,
              paidAmount: 0,
              year: englishYear,
              month: englishMonth,
              nepaliDueDate,
              englishDueDate,
              status: "overdue",
            },
          ]);

          try {
            const camPayload = buildCamChargeJournal(cam, {
              createdBy: adminId,
            });
            await ledgerService.postJournalEntry(camPayload, null, entityId);
          } catch (journalErr) {
            console.error(
              `[backfillTenantRents] CAM journal failed for ${cam._id}:`,
              journalErr.message,
            );
            camLog.errors.push({
              camId: cam._id,
              error: journalErr.message,
            });
          }

          camLog.created++;
        } catch (err) {
          camLog.failed++;
          camLog.errors.push({
            month: `${nepaliYear}-${nepaliMonth}`,
            error: err.message,
          });
          console.error(
            `[backfillTenantRents] CAM create failed for ${nepaliYear}-${nepaliMonth}:`,
            err.message,
          );
        }
      }
    }

    const created = insertedRents.map(
      (r) => `${r.nepaliYear}-${r.nepaliMonth}`,
    );

    return {
      success: true,
      message: `${insertedRents.length} rent record(s) created, ${camLog.created} CAM(s) created, ${rentJournalLog.failed} rent journal error(s)`,
      created,
      skipped,
      unitBreakdownApplied: useUnitBreakdown,
      journalErrors: rentJournalLog.errors.length
        ? rentJournalLog.errors
        : undefined,
      camErrors: camLog.errors.length ? camLog.errors : undefined,
    };
  } catch (error) {
    console.error("[backfillTenantRents]", error.message);
    return {
      success: false,
      message: "Backfill failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON: sendEmailToTenants (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmailToTenants() {
  try {
    const { npMonth, npYear, lastDay } = getNepaliMonthDates();

    const rents = await Rent.find({
      status: { $in: ["pending", "partially_paid"] },
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      emailReminderSent: false,
    }).populate("tenant");

    const cams = await Cam.find({
      status: { $in: ["pending", "partially_paid"] },
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      emailReminderSent: false,
    }).populate("tenant");

    if (![...rents, ...cams].length) {
      return { success: true, message: "No pending rents or CAMs this month" };
    }

    const io = getIO();
    const admins = await adminModel.find({ role: "admin" });
    await Promise.all(
      admins.map(async (admin) => {
        const notification = await Notification.create({
          admin: admin._id,
          type: "RENT_REMINDER",
          title: "Rent Payment Reminder",
          message: `${rents.length} tenant(s) have pending rent for ${npYear}-${npMonth}`,
          data: {
            pendingCount: rents.length,
            monthYear: `${npYear}-${npMonth}`,
          },
          isRead: false,
        });
        if (io)
          io.to(`admin:${admin._id}`).emit("new-notification", {
            notification,
          });
      }),
    );

    const tenantMap = new Map();
    const addToMap = (item, type) => {
      if (!item.tenant?.email) return;
      const key = item.tenant._id.toString();
      if (!tenantMap.has(key))
        tenantMap.set(key, { tenant: item.tenant, rents: [], cams: [] });
      tenantMap.get(key)[type].push(item);
    };
    rents.forEach((r) => addToMap(r, "rents"));
    cams.forEach((c) => addToMap(c, "cams"));

    const sentRentIds = [];
    const sentCamIds = [];

    await Promise.all(
      Array.from(tenantMap.values()).map(
        async ({ tenant, rents: tRents, cams: tCams }) => {
          const rentTotal = tRents.reduce(
            (s, r) => s + calculateRentTotals(r).remainingAmountPaisa,
            0,
          );
          const camTotal = tCams.reduce((s, c) => s + (c.amountPaisa || 0), 0);
          const total = rentTotal + camTotal;

          let dueDateStr = "";
          try {
            const ref = tRents[0] || tCams[0];
            dueDateStr = new NepaliDate(
              ref.nepaliYear,
              (ref.nepaliMonth || 1) - 1,
              30,
            ).format("YYYY-MMMM-DD");
          } catch {
            dueDateStr = lastDay?.format?.("YYYY-MMMM-DD") ?? "";
          }

          let details = "";
          if (tRents.length)
            details += `<tr><td style="padding:8px 0;border-bottom:1px solid #e0e0e0"><strong>Rent:</strong> ${formatMoney(rentTotal)}</td></tr>`;
          if (tCams.length)
            details += `<tr><td style="padding:8px 0;border-bottom:1px solid #e0e0e0"><strong>CAM:</strong> ${formatMoney(camTotal)}</td></tr>`;

          const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif">
        <table style="max-width:600px;margin:20px auto;border:1px solid #e0e0e0;border-radius:8px">
          <tr><td style="padding:20px">
            <h2>Hello ${tenant.name},</h2>
            <p>Reminder: pending payments for <strong>${npYear}-${npMonth}</strong>.</p>
            <table width="100%">${details}
              <tr><td style="padding:12px 0;border-top:2px solid #333;border-bottom:2px solid #333">
                <strong>Total: ${formatMoney(total)}</strong></td></tr>
            </table>
            <p>Please pay before <strong>${dueDateStr}</strong>.</p>
            <p>Thank you,<br><strong>Management Team</strong></p>
          </td></tr>
        </table></body></html>`;

          try {
            await sendEmail({
              to: tenant.email,
              subject: "Reminder for Rent and CAM Payment",
              html,
            });
            tRents.forEach((r) => sentRentIds.push(r._id));
            tCams.forEach((c) => sentCamIds.push(c._id));
          } catch (e) {
            console.error(`[sendEmailToTenants] ${tenant.email}:`, e.message);
          }
        },
      ),
    );

    if (sentRentIds.length)
      await Rent.updateMany(
        { _id: { $in: sentRentIds } },
        { $set: { emailReminderSent: true } },
      );
    if (sentCamIds.length)
      await Cam.updateMany(
        { _id: { $in: sentCamIds } },
        { $set: { emailReminderSent: true } },
      );

    const sent = Array.from(tenantMap.values()).filter(
      ({ tenant }) => tenant?.email,
    ).length;
    return {
      success: true,
      message: `Emails sent to ${sent} of ${tenantMap.size} tenants`,
    };
  } catch (error) {
    console.error("[sendEmailToTenants]", error.message);
    return {
      success: false,
      message: "Failed to send emails",
      error: error.message,
    };
  }
}

export default handleMonthlyRents;
