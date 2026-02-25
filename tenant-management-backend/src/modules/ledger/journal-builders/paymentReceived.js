/**
 * paymentReceived.js  (FIXED)
 *
 * Builds the journal payload for a rent payment received.
 *
 * Correct double-entry:
 *   DR  Cash / Bank Account   (ASSET ↑ — money received)
 *   CR  Accounts Receivable   (ASSET ↓ — tenant owes less)
 *
 * Changes from original:
 *   - paymentMethod is now required; routed to correct account via getDebitAccountForPayment().
 *   - No Gregorian fallback for nepaliMonth/nepaliYear.
 *   - Uses buildJournalPayload() for canonical, validated output.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { resolveNepaliPeriod } from "../../../utils/nepaliDateHelper.js";
import {
  getDebitAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";

/**
 * @param {Object} payment  - Payment document
 *   Must have:  _id, amountPaisa (integer), paymentMethod
 *   Optional:   paymentDate, nepaliDate, createdBy / receivedBy
 *
 * @param {Object} rent     - Rent document (for context)
 *   Must have:  nepaliMonth, nepaliYear
 *   Optional:   tenant, property
 *
 * @param {string} [bankAccountCode]
 *   Required when paymentMethod is "bank_transfer" or "cheque".
 *   Should be the account code of the specific BankAccount (e.g. "1010-NABIL").
 *
 * @returns {Object} Canonical journal payload
 */
export function buildPaymentReceivedJournal(payment, rent, bankAccountCode) {
  // ── 1. Validate payment method ───────────────────────────────────────────
  assertValidPaymentMethod(payment.paymentMethod);

  // ── 2. Validate amount ───────────────────────────────────────────────────
  assertIntegerPaisa(payment.amountPaisa, "payment.amountPaisa");

  // ── 3. Resolve Nepali period (no Gregorian fallback) ─────────────────────
  const transactionDate =
    payment.paymentDate instanceof Date
      ? payment.paymentDate
      : new Date(payment.paymentDate ?? Date.now());

  const { nepaliMonth, nepaliYear } = resolveNepaliPeriod({
    nepaliMonth: rent?.nepaliMonth,
    nepaliYear: rent?.nepaliYear,
    fallbackDate: transactionDate,
  });

  // ── 4. Determine DR account from payment method ───────────────────────────
  const drAccountCode = getDebitAccountForPayment(
    payment.paymentMethod,
    bankAccountCode,
  );

  const tenantName = rent?.tenant?.name ?? "";
  const description =
    `Rent payment received for ${nepaliMonth}/${nepaliYear}` +
    (tenantName ? ` — ${tenantName}` : "");
  const nepaliDate =
    payment.nepaliDate instanceof Date ? payment.nepaliDate : transactionDate;

  // ── 5. Build canonical payload ───────────────────────────────────────────
  return buildJournalPayload({
    transactionType: "RENT_PAYMENT_RECEIVED",
    referenceType: "RentPayment",
    referenceId: payment._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: payment.createdBy ?? payment.receivedBy ?? null,
    totalAmountPaisa: payment.amountPaisa,
    tenant: rent?.tenant,
    property: rent?.property,
    entries: [
      {
        accountCode: drAccountCode,
        debitAmountPaisa: payment.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: payment.amountPaisa,
        description,
      },
    ],
  });
}
