/**
 * sdRefund.service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All business logic for settling (refunding / adjusting) a Security Deposit.
 *
 * PUBLIC API:
 *   preflightSdRefund(sdId)                       → validation + balance check
 *   createSdRefund(payload, adminId, entityId)     → DRAFT SdRefund
 *   confirmAndPost(refundId, adminId, entityId)    → POSTED + ledger written
 *   reverseSdRefund(refundId, reason, adminId)     → REVERSED + ledger reversed
 *   getRefundsForSd(sdId)                         → list all settlements for an SD
 *   getSdRefundById(refundId)                      → single settlement detail
 *
 * FLOW:
 *   1. Frontend calls preflightSdRefund() to get current SD state + open dues.
 *   2. User fills the wizard and calls createSdRefund() → DRAFT.
 *   3. User confirms → confirmAndPost() → POSTED (atomic with ledger).
 *   4. Optional reversal within 24h via reverseSdRefund().
 *
 * INVARIANTS:
 *   - Sum of all non-REVERSED SdRefund.totalAmountPaisa for an SD must never
 *     exceed Sd.amountPaisa.
 *   - A REVERSED refund has no effect on remaining SD balance.
 *   - Every POSTED SdRefund has exactly one Transaction doc (via ledger).
 *   - Ledger is always written inside a MongoDB session with the SD update.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { Sd } from "../securityDeposits/sd.model.js";
import { SdRefund } from "./sdRefund.model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildSdRefundJournal } from "../ledger/journal-builders/index.js";
import { formatNepaliISO } from "../../utils/nepaliDateHelper.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function nowNepali() {
  const nd = new NepaliDate(new Date());
  return {
    nepaliDate: formatNepaliISO(nd),
    nepaliMonth: nd.getMonth() + 1,
    nepaliYear: nd.getYear(),
  };
}

/**
 * Compute how much of an SD is still unresolved.
 * remainingPaisa = sd.amountPaisa − sum(non-REVERSED refunds).totalAmountPaisa
 */
async function computeRemainingPaisa(sdId, excludeRefundId = null) {
  const match = {
    sd: new mongoose.Types.ObjectId(String(sdId)),
    status: { $ne: "REVERSED" },
  };
  if (excludeRefundId) {
    match._id = { $ne: new mongoose.Types.ObjectId(String(excludeRefundId)) };
  }
  const result = await SdRefund.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$totalAmountPaisa" } } },
  ]);
  return result[0]?.total ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. preflightSdRefund
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns everything the frontend needs to populate the refund wizard:
 *   - SD details + remaining balance
 *   - Existing refund history
 *   - Open rent/CAM/electricity dues for this tenant (for adjustment options)
 *   - Warnings (not hard blockers)
 *
 * @param {string|ObjectId} sdId
 * @returns {Object} preflight result
 */
export async function preflightSdRefund(sdId) {
  const sd = await Sd.findById(sdId)
    .populate("tenant", "name phone")
    .populate("block", "name")
    .lean();

  if (!sd) throw new Error(`Security deposit not found: ${sdId}`);
  if (sd.status === "refunded") {
    return {
      canRefund: false,
      reason: "SD is already fully refunded",
      sd,
      remainingPaisa: 0,
      existingRefunds: [],
      openDues: { rentPaisa: 0, camPaisa: 0, electricityPaisa: 0 },
      warnings: ["This security deposit has already been fully refunded."],
    };
  }

  const settledPaisa = await computeRemainingPaisa(sdId);
  const remainingPaisa = sd.amountPaisa - settledPaisa;
  const existingRefunds = await SdRefund.find({ sd: sdId })
    .sort({ refundDate: -1 })
    .lean();

  const warnings = [];
  if (remainingPaisa <= 0) {
    warnings.push("No remaining SD balance — all funds have been settled.");
  }

  // Query open dues across Rent, Cam, Electricity for this tenant
  // These are used to offer "Apply to dues" options in the wizard.
  const Rent = mongoose.model("Rent");
  const [openRents] = await Rent.aggregate([
    {
      $match: {
        tenant: sd.tenant._id ?? sd.tenant,
        status: { $in: ["pending", "overdue", "partial"] },
      },
    },
    {
      $group: {
        _id: null,
        totalDuePaisa: {
          $sum: { $subtract: ["$rentAmountPaisa", "$paidAmountPaisa"] },
        },
      },
    },
  ]);

  // CAM dues
  const Cam = mongoose.model("Cam");
  const [openCams] = await Cam.aggregate([
    {
      $match: {
        tenant: sd.tenant._id ?? sd.tenant,
        status: { $in: ["pending", "overdue", "partial"] },
      },
    },
    {
      $group: {
        _id: null,
        totalDuePaisa: {
          $sum: { $subtract: ["$camAmountPaisa", "$paidAmountPaisa"] },
        },
      },
    },
  ]).catch(() => []);

  return {
    canRefund: remainingPaisa > 0,
    sd,
    settledPaisa,
    remainingPaisa,
    existingRefunds,
    openDues: {
      rentPaisa: openRents?.totalDuePaisa ?? 0,
      camPaisa: openCams?.totalDuePaisa ?? 0,
      electricityPaisa: 0, // extend when electricity model supports it
    },
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. createSdRefund (DRAFT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a DRAFT SdRefund (not yet posted to ledger).
 * Validates amounts but does NOT write any journal entries.
 *
 * @param {Object} payload
 *   @param {string}   sdId
 *   @param {Date}     refundDate
 *   @param {Object[]} lineItems        - array of adjustment line items
 *   @param {string}   [internalNotes]
 * @param {string|ObjectId} adminId     - admin processing the refund
 * @param {string|ObjectId} entityId    - OwnershipEntity
 * @returns {SdRefund} draft document
 */
export async function createSdRefund(payload, adminId, entityId) {
  const { sdId, refundDate, lineItems, internalNotes } = payload;

  if (!entityId) throw new Error("entityId is required");
  if (!lineItems?.length) throw new Error("lineItems must not be empty");

  const sd = await Sd.findById(sdId).populate("tenant", "name").lean();
  if (!sd) throw new Error(`SD not found: ${sdId}`);

  // Guard: total line items must not exceed remaining SD balance
  const settledPaisa = await computeRemainingPaisa(sdId);
  const remainingPaisa = sd.amountPaisa - settledPaisa;
  const requestedPaisa = lineItems.reduce(
    (s, item) => s + (item.amountPaisa ?? 0),
    0,
  );

  if (requestedPaisa > remainingPaisa) {
    throw new Error(
      `Requested settlement amount (${requestedPaisa} paisa) exceeds ` +
        `remaining SD balance (${remainingPaisa} paisa).`,
    );
  }

  const date = refundDate ? new Date(refundDate) : new Date();
  const nd = new NepaliDate(date);
  const nepaliDate = formatNepaliISO(nd);
  const nepaliMonth = nd.getMonth() + 1;
  const nepaliYear = nd.getYear();

  const refundDoc = new SdRefund({
    sd: sdId,
    tenant: sd.tenant._id ?? sd.tenant,
    block: sd.block,
    entityId,
    lineItems,
    totalAmountPaisa: requestedPaisa,
    refundDate: date,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    status: "DRAFT",
    processedBy: adminId,
    internalNotes: internalNotes ?? "",
    sdSnapshot: {
      amountPaisa: sd.amountPaisa,
      remainingPaisa,
      mode: sd.mode,
      status: sd.status,
    },
  });

  await refundDoc.save();
  return refundDoc;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. confirmAndPost (DRAFT → POSTED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically:
 *   1. Re-validate remaining balance (guard against concurrent requests)
 *   2. Post double-entry journal via ledgerService
 *   3. Call sd.applyRefund() to update the SD document's refundHistory
 *   4. Mark SdRefund as POSTED with transactionId
 *   5. Update SD root status (partially_refunded or refunded)
 *
 * All steps run inside a single MongoDB session.
 *
 * @param {string|ObjectId} refundId
 * @param {string|ObjectId} adminId
 * @param {string|ObjectId} entityId
 * @returns {Object} { refund, transaction, sd }
 */
export async function confirmAndPost(refundId, adminId, entityId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const refund = await SdRefund.findById(refundId).session(session);
    if (!refund) throw new Error(`SdRefund not found: ${refundId}`);
    if (refund.status !== "DRAFT") {
      throw new Error(
        `SdRefund is not in DRAFT status. Current: ${refund.status}`,
      );
    }

    const sd = await Sd.findById(refund.sd)
      .populate("tenant", "name")
      .session(session);
    if (!sd) throw new Error(`SD not found: ${refund.sd}`);

    // Re-validate remaining balance (concurrent guard)
    const settledPaisa = await computeRemainingPaisa(refund.sd, refundId);
    const remainingPaisa = sd.amountPaisa - settledPaisa;

    if (refund.totalAmountPaisa > remainingPaisa) {
      throw new Error(
        `Concurrent conflict: remaining balance is now ${remainingPaisa} paisa ` +
          `but this refund requests ${refund.totalAmountPaisa} paisa.`,
      );
    }

    // Build journal payload
    const journalPayload = buildSdRefundJournal(
      sd,
      {
        refundId: refund._id,
        refundDate: refund.refundDate,
        createdBy: adminId,
        lineItems: refund.lineItems,
      },
      entityId,
    );

    // Post to ledger
    const { transaction } = await ledgerService.postJournalEntry(
      journalPayload,
      session,
      entityId,
    );

    // Update SD document — apply refund history entries
    const cashRefundLines = refund.lineItems.filter(
      (l) => l.type === "CASH_REFUND",
    );
    const cashTotal = cashRefundLines.reduce((s, l) => s + l.amountPaisa, 0);

    if (cashTotal > 0) {
      sd.applyRefund(
        cashTotal,
        refund.refundDate,
        adminId,
        null, // unitRefunds — optional; extend for per-unit SD
        refund.lineItems
          .map((l) => l.note)
          .filter(Boolean)
          .join("; "),
        cashRefundLines[0]?.paymentMethod ?? "bank_transfer",
      );
    }

    // For non-cash adjustments: push to refundHistory as adjustments
    const adjustmentLines = refund.lineItems.filter(
      (l) => l.type !== "CASH_REFUND",
    );
    for (const line of adjustmentLines) {
      sd.refundHistory.push({
        amountPaisa: line.amountPaisa,
        refundDate: refund.refundDate,
        refundedBy: adminId,
        reason: `${line.type}: ${line.note ?? ""}`,
        mode: "bank_transfer", // adjustment, not actual cash movement
      });
    }

    await sd.save({ session });

    // Mark SdRefund as POSTED
    refund.status = "POSTED";
    refund.transactionId = transaction._id;
    await refund.save({ session });

    await session.commitTransaction();

    return {
      refund: refund.toObject(),
      transaction,
      sd: sd.toObject(),
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. reverseSdRefund (POSTED → REVERSED)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reverse a posted SD refund within 24h.
 * Reverses the ledger journal and marks the SdRefund as REVERSED.
 * The SD's refundHistory entries added by this refund are rolled back.
 *
 * @param {string|ObjectId} refundId
 * @param {string}          reason
 * @param {string|ObjectId} adminId   - must be super_admin (enforced at controller)
 * @returns {Object} reversed refund document
 */
export async function reverseSdRefund(refundId, reason, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const refund = await SdRefund.findById(refundId).session(session);
    if (!refund) throw new Error(`SdRefund not found: ${refundId}`);
    if (refund.status !== "POSTED") {
      throw new Error(
        `Only POSTED refunds can be reversed. Current: ${refund.status}`,
      );
    }

    // 24h window check
    const AGE_MS = Date.now() - refund.createdAt.getTime();
    if (AGE_MS > 24 * 60 * 60 * 1000) {
      throw new Error(
        "Reversal window has expired (24h). Contact support for manual correction.",
      );
    }

    if (!refund.transactionId) {
      throw new Error("Refund has no linked transaction — cannot reverse.");
    }

    // Reverse the ledger journal
    await ledgerService.reverseJournalEntry(
      refund.transactionId,
      reason,
      adminId,
      session,
    );

    // Roll back SD refundHistory entries that this refund created
    const sd = await Sd.findById(refund.sd).session(session);
    if (sd) {
      // Remove history entries added on the refund date by this admin
      // (best-effort — full fidelity requires referenceId on refundHistory)
      const refundDateStr = refund.refundDate.toISOString().split("T")[0];
      sd.refundHistory = sd.refundHistory.filter((h) => {
        const hDateStr =
          h.refundDate instanceof Date
            ? h.refundDate.toISOString().split("T")[0]
            : "";
        return !(
          hDateStr === refundDateStr && String(h.refundedBy) === String(adminId)
        );
      });
      await sd.save({ session });
    }

    // Mark SdRefund REVERSED
    refund.status = "REVERSED";
    refund.reversedBy = adminId;
    refund.reversedAt = new Date();
    refund.reversalReason = reason;
    await refund.save({ session });

    await session.commitTransaction();
    return refund.toObject();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Query helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function getRefundsForSd(sdId) {
  return SdRefund.find({ sd: sdId })
    .populate("processedBy", "name email")
    .populate("reversedBy", "name email")
    .sort({ refundDate: -1 })
    .lean();
}

export async function getSdRefundById(refundId) {
  return SdRefund.findById(refundId)
    .populate("sd")
    .populate("tenant", "name phone")
    .populate("processedBy", "name email")
    .lean();
}
