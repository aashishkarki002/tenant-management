import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { getDebitAccountForPayment } from "../../../utils/paymentAccountUtils.js";

/**
 * Build journal payload for a CAM payment received (DR Cash/Bank, CR Accounts Receivable).
 * Uses paisa for all amounts.
 * @param {Object} payment - Payment document with _id, paymentDate, nepaliDate, amountPaisa, createdBy/receivedBy
 * @param {Object} cam - Cam document with tenant, property, nepaliMonth, nepaliYear
 * @param {number} [amountPaisa] - Amount in paisa to record (defaults to payment.amountPaisa)
 * @param {number} [amount] - Amount in rupees (backward compatibility)
 * @param {string} [cashBankAccountCode] - Account code for DR (default CASH_BANK 1000)
 * @returns {Object} Journal payload for postJournalEntry
 */
export function buildCamPaymentReceivedJournal(payment, cam, bankAccountCode) {
  // Validate
  if (!payment.amountPaisa || !Number.isInteger(payment.amountPaisa)) {
    throw new Error(
      `payment.amountPaisa must be an integer, got: ${payment.amountPaisa}`,
    );
  }

  const transactionDate =
    payment.paymentDate instanceof Date
      ? payment.paymentDate
      : new Date(payment.paymentDate ?? Date.now());

  const nepaliMonth =
    cam?.nepaliMonth ?? new Date(transactionDate).getMonth() + 1;
  const nepaliYear = cam?.nepaliYear ?? new Date(transactionDate).getFullYear();
  const nepaliDate =
    payment.nepaliDate instanceof Date ? payment.nepaliDate : transactionDate;

  const drAccountCode = getDebitAccountForPayment(
    payment.paymentMethod,
    bankAccountCode,
  );

  const description =
    `CAM payment received for ${nepaliMonth}/${nepaliYear}` +
    (cam?.tenant?.name ? ` — ${cam.tenant.name}` : "");

  return buildJournalPayload({
    transactionType: "CAM_PAYMENT_RECEIVED",
    referenceType: "CamPayment",
    referenceId: payment._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: payment.createdBy ?? payment.receivedBy ?? null,
    totalAmountPaisa: payment.amountPaisa,
    tenant: cam?.tenant,
    property: cam?.property,
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
