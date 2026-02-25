/**
 * rent.payment.service.js
 *
 * Single place that atomically records a rent payment.
 *
 * Payment flow:
 *   1. Validate total amount
 *   2. Allocate: rent-first auto-allocation OR explicit caller split
 *   3. Open ONE session
 *   4a. Apply rent portion → paidAmountPaisa  (applyPaymentToRent)
 *   4b. Apply late fee portion → latePaidAmountPaisa  (applyLateFeePayment)  [if any]
 *   5.  Update bank / cash balance                    (applyPaymentToBank)
 *   6a. Post RENT_PAYMENT_RECEIVED journal
 *   6b. Post LATE_FEE_PAYMENT_RECEIVED journal        [if late fee portion > 0]
 *   7.  Commit — or roll back ALL writes if anything throws
 *
 * Journals are built BEFORE the session opens (pure computation, no DB writes).
 * Only writes happen inside the transaction.
 */

import mongoose from "mongoose";
import { Rent } from "../../rents/rent.Model.js";
import {
  applyPaymentToRent,
  applyLateFeePayment,
  validateCombinedPayment,
} from "../../rents/rent.domain.js";
import { ledgerService } from "../../ledger/ledger.service.js";
import { applyPaymentToBank } from "../../banks/bank.domain.js";
import { buildPaymentReceivedJournal } from "../../ledger/journal-builders/index.js";
import { buildLateFeePaymentJournal } from "../../ledger/journal-builders/lateFee.js";
import { assertIntegerPaisa, formatMoney } from "../../../utils/moneyUtil.js";
import { assertValidPaymentMethod } from "../../../utils/paymentAccountUtils.js";
import { resolveNepaliPeriod } from "../../../utils/nepaliDateHelper.js";

/**
 * Record a rent payment (rent principal + optional late fee) atomically.
 *
 * @param {Object}  params
 * @param {string}  params.rentId
 * @param {number}  params.amountPaisa          total payment in paisa
 * @param {string}  params.paymentMethod        "cash"|"bank_transfer"|"cheque"|"mobile_wallet"
 * @param {string}  [params.bankAccountId]      required for bank_transfer / cheque
 * @param {string}  [params.bankAccountCode]    chart-of-accounts code for the bank
 * @param {Date}    [params.paymentDate]        defaults to now
 * @param {Date}    [params.nepaliDate]
 * @param {*}       params.receivedBy           Admin ObjectId
 * @param {Array}   [params.unitPayments]       [{unitId, amountPaisa}]
 * @param {string}  [params.notes]
 *
 * Manual split (optional — omit for auto-allocation):
 * @param {number}  [params.rentPaymentPaisa]
 * @param {number}  [params.lateFeePaymentPaisa]
 */
export async function recordRentPayment({
  rentId,
  amountPaisa,
  paymentMethod,
  bankAccountId,
  bankAccountCode,
  paymentDate,
  nepaliDate,
  receivedBy,
  unitPayments,
  notes,
  // optional explicit split
  rentPaymentPaisa: explicitRentPaisa,
  lateFeePaymentPaisa: explicitLateFeePaisa,
}) {
  // ── 0. Pre-session validation ─────────────────────────────────────────────
  assertIntegerPaisa(amountPaisa, "amountPaisa");
  assertValidPaymentMethod(paymentMethod);
  if (!receivedBy) throw new Error("receivedBy (admin id) is required");

  const txDate =
    paymentDate instanceof Date
      ? paymentDate
      : new Date(paymentDate ?? Date.now());

  const nepaliTxDate = nepaliDate instanceof Date ? nepaliDate : txDate;

  // ── 1. Load rent ──────────────────────────────────────────────────────────
  const rent = await Rent.findById(rentId)
    .populate("tenant", "name")
    .populate("property", "name");

  if (!rent)
    return {
      success: false,
      message: `Rent not found: ${rentId}`,
      statusCode: 404,
    };
  if (rent.status === "cancelled")
    return {
      success: false,
      message: "Cannot pay a cancelled rent",
      statusCode: 400,
    };

  // ── 2. Allocate payment between rent and late fee ─────────────────────────
  const explicitSplit =
    explicitRentPaisa != null || explicitLateFeePaisa != null
      ? {
          rentPaymentPaisa: explicitRentPaisa ?? 0,
          lateFeePaymentPaisa: explicitLateFeePaisa ?? 0,
        }
      : null;

  const validation = validateCombinedPayment(rent, amountPaisa, explicitSplit);
  if (!validation.valid)
    return { success: false, message: validation.error, statusCode: 400 };

  const { rentPaymentPaisa, lateFeePaymentPaisa } = validation.split;

  // ── 3. Build journal payloads before opening session (pure, no DB writes) ──
  const { nepaliMonth, nepaliYear } = resolveNepaliPeriod({
    nepaliMonth: rent.nepaliMonth,
    nepaliYear: rent.nepaliYear,
    fallbackDate: txDate,
  });

  const rentPaymentDoc = {
    _id: new mongoose.Types.ObjectId(),
    amountPaisa: rentPaymentPaisa,
    paymentMethod,
    paymentDate: txDate,
    nepaliDate: nepaliTxDate,
    createdBy: receivedBy,
    receivedBy,
  };

  // Always build rent journal (rent portion is always > 0 because rent is senior)
  const rentJournalPayload =
    rentPaymentPaisa > 0
      ? buildPaymentReceivedJournal(
          rentPaymentDoc,
          { ...rent.toObject({ getters: false }), nepaliMonth, nepaliYear },
          bankAccountCode,
        )
      : null;

  // Build late fee journal only when a late fee portion is being paid
  const lateFeeJournalPayload =
    lateFeePaymentPaisa > 0
      ? buildLateFeePaymentJournal(
          {
            _id: new mongoose.Types.ObjectId(),
            amountPaisa: lateFeePaymentPaisa,
            paymentMethod,
            paymentDate: txDate,
            nepaliDate: nepaliTxDate,
            createdBy: receivedBy,
          },
          { ...rent.toObject({ getters: false }), nepaliMonth, nepaliYear },
          bankAccountCode,
        )
      : null;

  // ── 4. Open session — everything below is atomic ──────────────────────────
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 4a. Apply rent principal payment
    if (rentPaymentPaisa > 0) {
      applyPaymentToRent(rent, rentPaymentPaisa, txDate, receivedBy);
    }

    // 4b. Apply unit breakdown if provided (mutates unitBreakdown entries)
    if (unitPayments?.length && rent.useUnitBreakdown) {
      unitPayments.forEach(({ unitId, amountPaisa: unitAmt }) => {
        const ub = rent.unitBreakdown.find(
          (u) => u.unit.toString() === unitId.toString(),
        );
        if (ub) ub.paidAmountPaisa += unitAmt;
      });
    }

    // 4c. Apply late fee payment
    if (lateFeePaymentPaisa > 0) {
      applyLateFeePayment(rent, lateFeePaymentPaisa, txDate, receivedBy);
    }

    if (notes) rent.notes = notes;
    await rent.save({ session });

    // 5. Update cash / bank balance (once, for the total amount)
    await applyPaymentToBank({
      paymentMethod,
      bankAccountId,
      amountPaisa, // total — bank doesn't care about the rent/fee split
      session,
    });

    // 6a. Post rent journal
    if (rentJournalPayload) {
      const { duplicate } = await ledgerService.postJournalEntry(
        rentJournalPayload,
        session,
      );
      if (duplicate) {
        console.warn(
          `[recordRentPayment] Duplicate rent journal for rent ${rentId}`,
        );
      }
    }

    // 6b. Post late fee journal
    if (lateFeeJournalPayload) {
      const { duplicate } = await ledgerService.postJournalEntry(
        lateFeeJournalPayload,
        session,
      );
      if (duplicate) {
        console.warn(
          `[recordRentPayment] Duplicate late fee journal for rent ${rentId}`,
        );
      }
    }

    await session.commitTransaction();

    const summary = rent.getFinancialSummary();

    return {
      success: true,
      message: buildSuccessMessage(rentPaymentPaisa, lateFeePaymentPaisa),
      allocation: {
        totalPaisa: amountPaisa,
        rentPaymentPaisa,
        lateFeePaymentPaisa,
      },
      rent: rent.toObject({ virtuals: true, getters: false }),
      summary,
      statusCode: 200,
    };
  } catch (err) {
    await session.abortTransaction();
    console.error("[recordRentPayment] rolled back:", err.message);
    return {
      success: false,
      message: err.message ?? "Payment failed",
      statusCode: 500,
    };
  } finally {
    session.endSession();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSuccessMessage(rentPaisa, lateFeePaisa) {
  if (lateFeePaisa > 0) {
    return (
      `Payment of ${formatMoney(rentPaisa + lateFeePaisa)} recorded ` +
      `(${formatMoney(rentPaisa)} rent + ${formatMoney(lateFeePaisa)} late fee)`
    );
  }
  return `Payment of ${formatMoney(rentPaisa)} recorded`;
}

// ─── Unit-breakdown variant ───────────────────────────────────────────────────

/**
 * Validates unit payment distribution then delegates to recordRentPayment.
 */
export async function recordUnitRentPayment(params) {
  const { amountPaisa, unitPayments, rentPaymentPaisa, lateFeePaymentPaisa } =
    params;

  if (!Array.isArray(unitPayments) || unitPayments.length === 0) {
    return {
      success: false,
      message: "unitPayments array is required",
      statusCode: 400,
    };
  }

  assertIntegerPaisa(amountPaisa, "amountPaisa");

  // Unit payments must add up to the RENT portion only (not late fee)
  const rentPortion =
    rentPaymentPaisa ?? amountPaisa - (lateFeePaymentPaisa ?? 0);

  const unitSum = unitPayments.reduce((s, u) => {
    assertIntegerPaisa(u.amountPaisa, `unitPayment[${u.unitId}].amountPaisa`);
    return s + u.amountPaisa;
  }, 0);

  if (unitSum !== rentPortion) {
    return {
      success: false,
      message: `Unit payments sum (${unitSum} paisa) does not match rent portion (${rentPortion} paisa)`,
      statusCode: 400,
    };
  }

  return recordRentPayment(params);
}

/**
 * Helpers re‑exported for payment.service.js
 *
 * These mirror the logic in rent.domain.js so that createPayment()
 * can build a concise rent summary and unit breakdown.
 */

export function calculateRentRemaining(rent) {
  const effectiveRentPaisa =
    (rent.rentAmountPaisa || 0) - (rent.tdsAmountPaisa || 0);
  const paid = rent.paidAmountPaisa || 0;
  const remaining = effectiveRentPaisa - paid;
  return remaining > 0 ? remaining : 0;
}

export function updateRentStatus(rent) {
  const effectiveRentPaisa =
    (rent.rentAmountPaisa || 0) - (rent.tdsAmountPaisa || 0);
  const paid = rent.paidAmountPaisa || 0;

  if (paid <= 0) rent.status = "pending";
  else if (paid >= effectiveRentPaisa) rent.status = "paid";
  else rent.status = "partially_paid";

  return rent.status;
}

export function getUnitPaymentDetails(rent) {
  if (!rent.useUnitBreakdown || !Array.isArray(rent.unitBreakdown)) {
    return [];
  }

  return rent.unitBreakdown.map((ub) => {
    const effectiveUnitPaisa =
      (ub.rentAmountPaisa || 0) - (ub.tdsAmountPaisa || 0);
    const paid = ub.paidAmountPaisa || 0;
    const remaining = Math.max(0, effectiveUnitPaisa - paid);

    return {
      unitId: ub.unit?._id ?? ub.unit,
      unitName: ub.unit?.name ?? ub.unitName ?? undefined,
      rentAmountPaisa: ub.rentAmountPaisa,
      tdsAmountPaisa: ub.tdsAmountPaisa,
      paidAmountPaisa: ub.paidAmountPaisa,
      remainingPaisa: remaining,
      status: ub.status,
    };
  });
}

// Re‑export applyPaymentToRent so payment.service.js can alias it
export { applyPaymentToRent };
