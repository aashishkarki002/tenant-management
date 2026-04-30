/**
 * chequeClearing.js
 *
 * Journal builders for the cheque clearing lifecycle.
 *
 * ISSUED cheque lifecycle (expense):
 *   On issue:    DR Expense (5xxx)   / CR Bank              ← posted by expense.service.js
 *   On deposit:  *(no journal)*  status → DEPOSITED         ← money already left bank at issue
 *   On bounce:   DR Bank             / CR Expense (5xxx)    ← buildChequeBounceJournal
 *
 * RECEIVED cheque lifecycle (revenue):
 *   On receipt:  NO journal — Revenue doc created with status PENDING_CHEQUE
 *   On deposit:  DR Bank             / CR Revenue (4xxx)    ← buildChequeDepositJournal (RECEIVED)
 *                Revenue doc status → RECORDED
 *   On bounce:   NO journal — Revenue doc status → REVERSED
 */

import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";

/**
 * Build the deposit journal that moves funds from the clearing account to bank.
 *
 * @param {Object} draft  — ChequeDraft document (plain object or Mongoose doc)
 * @returns {Object} Canonical journal payload
 */
export function buildChequeDepositJournal(draft) {
  if (draft.direction === "ISSUED") {
    throw new Error(
      `buildChequeDepositJournal must not be called for ISSUED cheques — ` +
        `the journal was already posted at issue time (DR Expense / CR Bank).`,
    );
  }

  assertIntegerPaisa(draft.amountPaisa, "draft.amountPaisa");

  const bank = draft.bankAccountCode;

  if (!bank) {
    throw new Error(
      `ChequeDraft ${draft._id}: bankAccountCode is required for deposit journal`,
    );
  }

  // RECEIVED: cheque deposited → money enters the bank AND revenue is recognised now
  // DR Bank / CR Revenue (4xxx)
  const revenueAccount = draft.referenceAccountCode;
  if (!revenueAccount) {
    throw new Error(
      `ChequeDraft ${draft._id}: referenceAccountCode is required for RECEIVED deposit journal`,
    );
  }

  const description =
    `Cheque deposit — ${draft.direction} #${draft.chequeNumber}` +
    (draft.partyName ? ` (${draft.partyName})` : "") +
    ` — ${draft.amountPaisa / 100} NPR`;

  const entries = [
    { accountCode: bank,           debitAmountPaisa: draft.amountPaisa, creditAmountPaisa: 0, description },
    { accountCode: revenueAccount, debitAmountPaisa: 0, creditAmountPaisa: draft.amountPaisa, description },
  ];

  const payload = buildJournalPayload({
    transactionType: "CHEQUE_DEPOSIT",
    referenceType: "ChequeDraft",
    referenceId: draft._id,
    transactionDate: draft.depositedAt ? new Date(draft.depositedAt) : new Date(),
    nepaliMonth: draft.nepaliMonth,
    nepaliYear: draft.nepaliYear,
    description,
    createdBy: draft.depositedBy ?? draft.createdBy ?? null,
    totalAmountPaisa: draft.amountPaisa,
    entries,
  });

  // Override nepaliDate with the BS string (buildJournalPayload defaults to Date)
  if (draft.nepaliDate) payload.nepaliDate = draft.nepaliDate;

  return payload;
}

/**
 * Build the reversal journal for a bounced or cancelled cheque.
 *
 * Reverses the clearing account back to the original source account.
 *
 * @param {Object} draft  — ChequeDraft document
 * @returns {Object} Canonical journal payload
 */
export function buildChequeBounceJournal(draft) {
  assertIntegerPaisa(draft.amountPaisa, "draft.amountPaisa");

  const sourceAccount = draft.referenceAccountCode;
  const bank = draft.bankAccountCode;

  if (!sourceAccount) {
    throw new Error(
      `ChequeDraft ${draft._id}: referenceAccountCode is required for bounce/cancel reversal journal`,
    );
  }

  const action = draft.status === "BOUNCED" ? "bounce" : "cancellation";
  const description =
    `Cheque ${action} — ${draft.direction} #${draft.chequeNumber}` +
    (draft.partyName ? ` (${draft.partyName})` : "") +
    ` — ${draft.amountPaisa / 100} NPR`;

  // ISSUED reversal: original was DR Expense / CR Bank → reverse: DR Bank / CR Expense
  // RECEIVED reversal: no journal was ever posted, so this branch is unreachable in practice
  const entries =
    draft.direction === "ISSUED"
      ? [
          { accountCode: bank,          debitAmountPaisa: draft.amountPaisa, creditAmountPaisa: 0, description },
          { accountCode: sourceAccount, debitAmountPaisa: 0, creditAmountPaisa: draft.amountPaisa, description },
        ]
      : [
          { accountCode: sourceAccount, debitAmountPaisa: draft.amountPaisa, creditAmountPaisa: 0, description },
          { accountCode: bank,          debitAmountPaisa: 0, creditAmountPaisa: draft.amountPaisa, description },
        ];

  const payload = buildJournalPayload({
    transactionType: draft.status === "BOUNCED" ? "CHEQUE_BOUNCE" : "CHEQUE_CANCEL",
    referenceType: "ChequeDraft",
    referenceId: draft._id,
    transactionDate: new Date(),
    nepaliMonth: draft.nepaliMonth,
    nepaliYear: draft.nepaliYear,
    description,
    createdBy: draft.depositedBy ?? draft.createdBy ?? null,
    totalAmountPaisa: draft.amountPaisa,
    entries,
  });

  if (draft.nepaliDate) payload.nepaliDate = draft.nepaliDate;

  return payload;
}
