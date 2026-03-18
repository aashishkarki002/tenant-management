/**
 * rent.payment.service.js
 *
 * Change from previous revision:
 *   Import { resolveEntityFromBlock } from resolveEntity.helper.js.
 *   Called once per payment after Rent.findById, inside the active session.
 *   entityId is passed to every postJournalEntry call in that payment
 *   (rent payment journal + late fee payment journal if applicable).
 *
 * All allocation logic, validation, bank balance update, and Payment document
 * creation are unchanged from the existing codebase patterns.
 */

import mongoose from "mongoose";
import { Rent } from "./rent.Model.js";
import { Payment } from "../payment/payment.model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildPaymentReceivedJournal,
  buildLateFeePaymentJournal,
} from "../ledger/journal-builders/index.js";
import { applyPaymentToBank } from "../banks/bank.domain.js";
import {
  applyPaymentToRent,
  applyLateFeePayment,
  applyPaymentWithUnitBreakdown,
  allocatePayment,
  validateCombinedPayment,
} from "./rent.domain.js";
import { formatMoney } from "../../utils/moneyUtil.js";
import { resolveEntityFromBlock } from "../../helper/resolveEntity.js"; // ← NEW

// ─────────────────────────────────────────────────────────────────────────────
// RECORD RENT PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a rent + optional late fee payment atomically.
 *
 * All writes happen in one session:
 *   Rent document → Payment document → BankAccount balance → LedgerEntries
 *
 * entityId is resolved from rent.block once before any writes and stamped
 * on all journal entries posted in this call.
 *
 * @param {Object} params
 * @param {string}  params.rentId
 * @param {number}  params.amountPaisa         positive integer paisa
 * @param {string}  params.paymentMethod       "cash"|"bank_transfer"|"cheque"|"mobile_wallet"
 * @param {string}  [params.bankAccountId]     required for bank_transfer / cheque
 * @param {string}  [params.bankAccountCode]   required for bank_transfer / cheque
 * @param {Date}    [params.paymentDate]        defaults to now
 * @param {Date}    [params.nepaliDate]
 * @param {*}       [params.receivedBy]
 * @param {string}  [params.notes]
 * @param {Object}  [params.explicitSplit]     { rentPaymentPaisa, lateFeePaymentPaisa }
 */
export async function recordRentPayment({
  rentId,
  amountPaisa,
  paymentMethod,
  bankAccountId,
  bankAccountCode,
  paymentDate = new Date(),
  nepaliDate,
  receivedBy,
  notes,
  explicitSplit = null,
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── 1. Fetch rent ──────────────────────────────────────────────────────
    const rent = await Rent.findById(rentId).session(session);
    if (!rent) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 404, message: "Rent not found" };
    }

    if (rent.status === "paid") {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: "Rent is already fully paid",
      };
    }

    // ── 2. Resolve entity from block — once, before any writes ─────────────
    const entityId = await resolveEntityFromBlock(rent.block, session);
    console.log(
      `[recordRentPayment] entityId=${entityId ?? "null"} ← block=${rent.block}`,
    );

    // ── 3. Validate and allocate ───────────────────────────────────────────
    const validation = validateCombinedPayment(
      rent,
      amountPaisa,
      explicitSplit,
    );
    if (!validation.valid) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 400, message: validation.error };
    }

    const { rentPaymentPaisa, lateFeePaymentPaisa } = validation.split;

    // ── 4. Mutate rent ─────────────────────────────────────────────────────
    if (rentPaymentPaisa > 0) {
      applyPaymentToRent(rent, rentPaymentPaisa, paymentDate, receivedBy);
    }
    if (lateFeePaymentPaisa > 0) {
      applyLateFeePayment(rent, lateFeePaymentPaisa, paymentDate, receivedBy);
    }
    await rent.save({ session });

    // ── 5. Payment document ────────────────────────────────────────────────
    const [payment] = await Payment.create(
      [
        {
          rent: rentId,
          tenant: rent.tenant,
          amountPaisa,
          paymentMethod,
          paymentDate,
          nepaliDate,
          bankAccount: bankAccountId ?? null,
          bankAccountCode: bankAccountCode ?? null,
          receivedBy,
          notes,
          paymentStatus: "completed",
          allocations: {
            rent: { amountPaisa: rentPaymentPaisa },
            ...(lateFeePaymentPaisa > 0 && {
              lateFee: { amountPaisa: lateFeePaymentPaisa },
            }),
          },
        },
      ],
      { session },
    );

    // ── 6. Bank balance ────────────────────────────────────────────────────
    await applyPaymentToBank({
      paymentMethod,
      bankAccountId: bankAccountId ?? null,
      amountPaisa,
      session,
    });

    // ── 7. Rent payment journal ← entityId ────────────────────────────────
    if (rentPaymentPaisa > 0) {
      await ledgerService.postJournalEntry(
        buildPaymentReceivedJournal(rent, {
          amountPaisa: rentPaymentPaisa,
          paymentMethod,
          bankAccountCode,
          paymentDate,
          payment,
        }),
        session,
        entityId,
      );
    }

    // ── 8. Late fee payment journal ← entityId ────────────────────────────
    if (lateFeePaymentPaisa > 0) {
      await ledgerService.postJournalEntry(
        buildLateFeePaymentJournal(rent, {
          amountPaisa: lateFeePaymentPaisa,
          paymentMethod,
          bankAccountCode,
          paymentDate,
          payment,
        }),
        session,
        entityId,
      );
    }

    await session.commitTransaction();
    session.endSession();

    console.log(
      `[recordRentPayment] ✅ rent=${rentId} paid=${formatMoney(amountPaisa)} entity=${entityId ?? "null"}`,
    );

    return {
      success: true,
      statusCode: 200,
      message: "Payment recorded successfully",
      payment,
      rent,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("[recordRentPayment]", error.message);
    return {
      success: false,
      statusCode: 500,
      message: "Payment recording failed",
      error: error.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORD UNIT-BREAKDOWN RENT PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a payment distributed across specific units (multi-unit rents).
 * Same entity resolution pattern as recordRentPayment.
 *
 * @param {Object} params
 * @param {string}  params.rentId
 * @param {number}  params.amountPaisa
 * @param {Array}   params.unitPayments        [{ unitId, amountPaisa }]
 * @param {string}  params.paymentMethod
 * @param {string}  [params.bankAccountId]
 * @param {string}  [params.bankAccountCode]
 * @param {Date}    [params.paymentDate]
 * @param {Date}    [params.nepaliDate]
 * @param {*}       [params.receivedBy]
 * @param {string}  [params.notes]
 */
export async function recordUnitRentPayment({
  rentId,
  amountPaisa,
  unitPayments,
  paymentMethod,
  bankAccountId,
  bankAccountCode,
  paymentDate = new Date(),
  nepaliDate,
  receivedBy,
  notes,
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ── 1. Fetch rent ──────────────────────────────────────────────────────
    const rent = await Rent.findById(rentId).session(session);
    if (!rent) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 404, message: "Rent not found" };
    }

    if (!rent.useUnitBreakdown || !rent.unitBreakdown?.length) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message:
          "Rent does not use unit breakdown — use recordRentPayment instead",
      };
    }

    // ── 2. Resolve entity ──────────────────────────────────────────────────
    const entityId = await resolveEntityFromBlock(rent.block, session);
    console.log(
      `[recordUnitRentPayment] entityId=${entityId ?? "null"} ← block=${rent.block}`,
    );

    // ── 3. Apply unit breakdown payment ───────────────────────────────────
    applyPaymentWithUnitBreakdown(
      rent,
      amountPaisa,
      unitPayments,
      paymentDate,
      receivedBy,
    );
    await rent.save({ session });

    // ── 4. Payment document ────────────────────────────────────────────────
    const [payment] = await Payment.create(
      [
        {
          rent: rentId,
          tenant: rent.tenant,
          amountPaisa,
          paymentMethod,
          paymentDate,
          nepaliDate,
          bankAccount: bankAccountId ?? null,
          bankAccountCode: bankAccountCode ?? null,
          receivedBy,
          notes,
          paymentStatus: "completed",
          allocations: {
            rent: {
              amountPaisa,
              unitAllocations: unitPayments.map((up) => ({
                unitId: up.unitId,
                amountPaisa: up.amountPaisa,
              })),
            },
          },
        },
      ],
      { session },
    );

    // ── 5. Bank balance ────────────────────────────────────────────────────
    await applyPaymentToBank({
      paymentMethod,
      bankAccountId: bankAccountId ?? null,
      amountPaisa,
      session,
    });

    // ── 6. Payment journal ← entityId ─────────────────────────────────────
    await ledgerService.postJournalEntry(
      buildPaymentReceivedJournal(rent, {
        amountPaisa,
        paymentMethod,
        bankAccountCode,
        paymentDate,
        payment,
      }),
      session,
      entityId,
    );

    await session.commitTransaction();
    session.endSession();

    console.log(
      `[recordUnitRentPayment] ✅ rent=${rentId} paid=${formatMoney(amountPaisa)} entity=${entityId ?? "null"}`,
    );

    return {
      success: true,
      statusCode: 200,
      message: "Unit payment recorded successfully",
      payment,
      rent,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("[recordUnitRentPayment]", error.message);
    return {
      success: false,
      statusCode: 500,
      message: "Unit payment recording failed",
      error: error.message,
    };
  }
}
