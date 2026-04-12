/**
 * chequeClearing.js
 *
 * Journal builders for the cheque clearing lifecycle.
 *
 * ISSUED cheque lifecycle (expense / loan):
 *   On issue:    DR Expense (5xxx)   / CR 1020 (clearing)   ← posted by expense.js / loan.js
 *   On deposit:  DR 1020 (clearing)  / CR Bank              ← buildChequeDepositJournal (ISSUED)
 *   On bounce:   DR 1020 (clearing)  / CR Expense (5xxx)    ← buildChequeBounceJournal
 *
 * RECEIVED cheque lifecycle (revenue):
 *   On receipt:  NO journal — Revenue doc created with status PENDING_CHEQUE
 *   On deposit:  DR Bank             / CR Revenue (4xxx)    ← buildChequeDepositJournal (RECEIVED)
 *                Revenue doc status → RECORDED
 *   On bounce:   NO journal — Revenue doc status → REVERSED
 *
 * 1020 (Cheques in Transit) is only used for the ISSUED direction.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";

/**
 * Build the deposit journal that moves funds from the clearing account to bank.
 *
 * @param {Object} draft  — ChequeDraft document (plain object or Mongoose doc)
 * @returns {Object} Canonical journal payload
 */
export function buildChequeDepositJournal(draft) {
  assertIntegerPaisa(draft.amountPaisa, "draft.amountPaisa");

  const clearing = ACCOUNT_CODES.CHEQUE_CLEARING; // "1020"
  const bank = draft.bankAccountCode;

  if (!bank) {
    throw new Error(
      `ChequeDraft ${draft._id}: bankAccountCode is required for deposit journal`,
    );
  }

  const description =
    `Cheque deposit — ${draft.direction} #${draft.chequeNumber}` +
    (draft.partyName ? ` (${draft.partyName})` : "") +
    ` — ${draft.amountPaisa / 100} NPR`;

  let entries;
  if (draft.direction === "ISSUED") {
    // ISSUED: cheque clears → move from clearing liability to bank
    // DR 1020 (clearing)  / CR Bank
    entries = [
      { accountCode: clearing, debitAmountPaisa: draft.amountPaisa, creditAmountPaisa: 0, description },
      { accountCode: bank,     debitAmountPaisa: 0, creditAmountPaisa: draft.amountPaisa, description },
    ];
  } else {
    // RECEIVED: cheque deposited → money enters the bank AND revenue is recognised now
    // DR Bank / CR Revenue (4xxx)
    // No clearing account involved — nothing was posted at receipt time.
    const revenueAccount = draft.referenceAccountCode;
    if (!revenueAccount) {
      throw new Error(
        `ChequeDraft ${draft._id}: referenceAccountCode is required for RECEIVED deposit journal`,
      );
    }
    entries = [
      { accountCode: bank,           debitAmountPaisa: draft.amountPaisa, creditAmountPaisa: 0, description },
      { accountCode: revenueAccount, debitAmountPaisa: 0, creditAmountPaisa: draft.amountPaisa, description },
    ];
  }

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

  const clearing = ACCOUNT_CODES.CHEQUE_CLEARING; // "1020"
  const sourceAccount = draft.referenceAccountCode;

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

  // ISSUED reversal: clearing had a CR balance → DR clearing to remove it, CR back to expense
  // RECEIVED reversal: clearing had a DR balance → CR clearing to remove it, DR back to revenue
  const entries =
    draft.direction === "ISSUED"
      ? [
          { accountCode: clearing,       debitAmountPaisa: draft.amountPaisa, creditAmountPaisa: 0, description },
          { accountCode: sourceAccount,  debitAmountPaisa: 0, creditAmountPaisa: draft.amountPaisa, description },
        ]
      : [
          { accountCode: sourceAccount,  debitAmountPaisa: draft.amountPaisa, creditAmountPaisa: 0, description },
          { accountCode: clearing,       debitAmountPaisa: 0, creditAmountPaisa: draft.amountPaisa, description },
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
