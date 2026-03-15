/**
 * rent.payment.service.js  (NEW)
 *
 * Single place that atomically records a rent payment:
 *   1. Validates the payment against the rent (no DB writes)
 *   2. Opens a session
 *   3. Updates the Rent document (applyPayment → pre-save sets status)
 *   4. Updates Cash account / BankAccount balance  (applyPaymentToBank)
 *   5. Posts the double-entry journal              (postJournalEntry)
 *   6. Commits — or rolls back all three if anything throws
 *
 * This is the H-2 fix: bank + ledger were in separate transactions.
 */

import mongoose from "mongoose";
import { Rent } from "./rent.Model.js";
import { validateRentPayment } from "./rent.domain.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { applyPaymentToBank } from "../banks/bank.domain.js";
import { buildPaymentReceivedJournal } from "../ledger/journal-builders/index.js";
import { assertIntegerPaisa } from "../../utils/moneyUtil.js";
import { assertValidPaymentMethod } from "../../utils/paymentAccountUtils.js";
import { resolveNepaliPeriod } from "../../utils/nepaliDateHelper.js";
import { formatMoney } from "../../utils/moneyUtil.js";

/**
 * Record a rent payment atomically.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.rentId
 * @param {number}  params.amountPaisa       - positive integer paisa
 * @param {string}  params.paymentMethod     - "cash"|"bank_transfer"|"cheque"|"mobile_wallet"
 * @param {string}  [params.bankAccountId]   - required for bank_transfer / cheque
 * @param {string}  [params.bankAccountCode] - chart-of-accounts code for this bank account
 * @param {Date}    [params.paymentDate]     - defaults to now
 * @param {Date}    [params.nepaliDate]
 * @param {*}       params.receivedBy        - Admin ObjectId
 * @param {Array}   [params.unitPayments]    - [{unitId, amountPaisa}] for unit-breakdown rents
 * @param {string}  [params.notes]
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
}) {
  // ── 0. Input validation — before opening a session ───────────────────────
  assertIntegerPaisa(amountPaisa, "amountPaisa");
  assertValidPaymentMethod(paymentMethod);
  if (!receivedBy) throw new Error("receivedBy (admin id) is required");

  const txDate =
    paymentDate instanceof Date
      ? paymentDate
      : new Date(paymentDate ?? Date.now());

  // ── 1. Load and validate rent (read-only, no session needed) ─────────────
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

  const validation = validateRentPayment(rent, amountPaisa);
  if (!validation.valid)
    return { success: false, message: validation.error, statusCode: 400 };

  // ── 2. Build journal payload before opening session (no DB writes here) ──
  const { nepaliMonth, nepaliYear } = resolveNepaliPeriod({
    nepaliMonth: rent.nepaliMonth,
    nepaliYear: rent.nepaliYear,
    fallbackDate: txDate,
  });

  // Synthetic payment document — matches what buildPaymentReceivedJournal expects
  const paymentDoc = {
    _id: new mongoose.Types.ObjectId(),
    amountPaisa,
    paymentMethod,
    paymentDate: txDate,
    nepaliDate: nepaliDate instanceof Date ? nepaliDate : txDate,
    createdBy: receivedBy,
    receivedBy,
  };

  const journalPayload = buildPaymentReceivedJournal(
    paymentDoc,
    { ...rent.toObject({ getters: false }), nepaliMonth, nepaliYear },
    bankAccountCode,
  );

  // ── 3. Open session — everything below is atomic ─────────────────────────
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 3a. Update the Rent document
    rent.applyPayment(amountPaisa, txDate, receivedBy, unitPayments ?? null);
    if (notes) rent.notes = notes;
    await rent.save({ session });

    // 3b. Update Cash account or BankAccount balance
    await applyPaymentToBank({
      paymentMethod,
      bankAccountId,
      amountPaisa,
      session,
    });

    // 3c. Post double-entry journal (idempotency guard in postJournalEntry handles retries)
    const { transaction, duplicate } = await ledgerService.postJournalEntry(
      journalPayload,
      session,
    );
    if (duplicate) {
      console.warn(
        `[recordRentPayment] Duplicate journal for rent ${rentId} — committing rent update only`,
      );
    }

    await session.commitTransaction();

    return {
      success: true,
      message: `Payment of ${formatMoney(amountPaisa)} recorded`,
      rent: rent.toObject({ virtuals: true, getters: false }),
      transaction: transaction?.toObject ? transaction.toObject() : transaction,
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

/**
 * Unit-breakdown variant — validates unit payment distribution before delegating.
 */
export async function recordUnitRentPayment(params) {
  const { amountPaisa, unitPayments } = params;

  if (!Array.isArray(unitPayments) || unitPayments.length === 0) {
    return {
      success: false,
      message: "unitPayments array is required",
      statusCode: 400,
    };
  }

  assertIntegerPaisa(amountPaisa, "amountPaisa");

  const unitSum = unitPayments.reduce((s, u) => {
    assertIntegerPaisa(u.amountPaisa, `unitPayment[${u.unitId}].amountPaisa`);
    return s + u.amountPaisa;
  }, 0);

  if (unitSum !== amountPaisa) {
    return {
      success: false,
      message: `Unit payments sum (${unitSum} paisa) does not match total (${amountPaisa} paisa)`,
      statusCode: 400,
    };
  }

  return recordRentPayment(params);
}
