/**
 * chequeClearing.js
 *
 * Journal builders for the cheque clearing lifecycle.
 *
 * RECEIVED cheque lifecycle:
 *   On receipt  (PENDING):   DR 1150 Cheques In Hand / CR Revenue (4xxx)   ← buildChequeReceiptJournal
 *   On deposit  (DEPOSITED): DR Bank                 / CR 1150              ← buildChequeDepositJournal
 *   On bounce   (BOUNCED):   DR Revenue (4xxx)       / CR 1150              ← buildChequeBounceJournal
 *
 * ISSUED cheque lifecycle:
 *   On issue    (PENDING):   DR Expense (5xxx) / CR 2150 Cheques Payable   ← posted by expense.service.js
 *   On deposit  (DEPOSITED): DR 2150           / CR Bank                   ← buildChequeDepositJournal
 *   On bounce   (BOUNCED):   DR 2150           / CR Expense (5xxx)         ← buildChequeBounceJournal
 *
 * Bank balance changes ONLY at deposit time — never at issue/receipt.
 * Revenue is recognised at receipt time, not at bank clearance.
 * Expense is recognised at issue time, not at bank clearance.
 */

import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";
import { ACCOUNT_CODES } from "../config/accounts.js";

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT  (RECEIVED cheques only — posted at creation time)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the receipt journal for a RECEIVED cheque.
 * Recognises revenue immediately when the cheque is handed over.
 *
 * DR 1150 Cheques In Hand   amountPaisa   (ASSET ↑ — physical cheque in hand)
 * CR Revenue (4xxx)          amountPaisa   (REVENUE ↑ — income earned)
 *
 * @param {Object} draft  — ChequeDraft document (plain object)
 */
export function buildChequeReceiptJournal(draft) {
  if (draft.direction !== "RECEIVED") {
    throw new Error(
      `buildChequeReceiptJournal must only be called for RECEIVED cheques. ` +
        `Got direction: "${draft.direction}"`,
    );
  }

  assertIntegerPaisa(draft.amountPaisa, "draft.amountPaisa");

  const revenueAccount = draft.referenceAccountCode;
  if (!revenueAccount) {
    throw new Error(
      `ChequeDraft ${draft._id}: referenceAccountCode is required for cheque receipt journal`,
    );
  }

  const description =
    `Cheque received — #${draft.chequeNumber}` +
    (draft.partyName ? ` (${draft.partyName})` : "") +
    ` — ${draft.amountPaisa / 100} NPR`;

  const entries = [
    {
      accountCode: ACCOUNT_CODES.CHEQUES_IN_HAND,
      debitAmountPaisa: draft.amountPaisa,
      creditAmountPaisa: 0,
      description,
    },
    {
      accountCode: revenueAccount,
      debitAmountPaisa: 0,
      creditAmountPaisa: draft.amountPaisa,
      description,
    },
  ];

  const payload = buildJournalPayload({
    transactionType: "CHEQUE_RECEIPT",
    referenceType: "ChequeDraft",
    referenceId: draft._id,
    transactionDate: draft.chequeDate ? new Date(draft.chequeDate) : new Date(),
    nepaliMonth: draft.nepaliMonth,
    nepaliYear: draft.nepaliYear,
    description,
    createdBy: draft.createdBy ?? null,
    totalAmountPaisa: draft.amountPaisa,
    entries,
  });

  if (draft.nepaliDate) payload.nepaliDate = draft.nepaliDate;
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPOSIT  (both directions — posted when cheque clears the bank)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the deposit journal that moves funds to/from the bank.
 *
 * RECEIVED: DR Bank / CR 1150 Cheques In Hand
 * ISSUED:   DR 2150 Cheques Payable / CR Bank
 *
 * @param {Object} draft  — ChequeDraft document (plain object)
 */
export function buildChequeDepositJournal(draft) {
  assertIntegerPaisa(draft.amountPaisa, "draft.amountPaisa");

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

  if (draft.direction === "RECEIVED") {
    // Cheque deposited to bank — moves from Cheques In Hand to Bank
    // DR Bank / CR 1150
    entries = [
      {
        accountCode: bank,
        debitAmountPaisa: draft.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.CHEQUES_IN_HAND,
        debitAmountPaisa: 0,
        creditAmountPaisa: draft.amountPaisa,
        description,
      },
    ];
  } else {
    // Issued cheque cleared by bank — obligation settled, bank decreases
    // DR 2150 / CR Bank
    entries = [
      {
        accountCode: ACCOUNT_CODES.CHEQUES_PAYABLE,
        debitAmountPaisa: draft.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: bank,
        debitAmountPaisa: 0,
        creditAmountPaisa: draft.amountPaisa,
        description,
      },
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

  if (draft.nepaliDate) payload.nepaliDate = draft.nepaliDate;
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOUNCE / CANCEL  (both directions — reverses the original issue/receipt entry)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the reversal journal for a bounced or cancelled cheque.
 * Only called for PENDING cheques (deposit never happened).
 *
 * RECEIVED reversal (reverses DR 1150 / CR Revenue):
 *   DR Revenue (4xxx) / CR 1150
 *
 * ISSUED reversal (reverses DR Expense / CR 2150):
 *   DR 2150 / CR Expense (5xxx)
 *
 * @param {Object} draft  — ChequeDraft document with updated status
 */
export function buildChequeBounceJournal(draft) {
  assertIntegerPaisa(draft.amountPaisa, "draft.amountPaisa");

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

  let entries;

  if (draft.direction === "RECEIVED") {
    // Received: reversal of DR 1150 / CR Revenue
    // DR Revenue (4xxx) / CR 1150
    entries = [
      {
        accountCode: sourceAccount,
        debitAmountPaisa: draft.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.CHEQUES_IN_HAND,
        debitAmountPaisa: 0,
        creditAmountPaisa: draft.amountPaisa,
        description,
      },
    ];
  } else {
    // Issued: reversal of DR Expense / CR 2150
    // DR 2150 / CR Expense (5xxx)
    entries = [
      {
        accountCode: ACCOUNT_CODES.CHEQUES_PAYABLE,
        debitAmountPaisa: draft.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: sourceAccount,
        debitAmountPaisa: 0,
        creditAmountPaisa: draft.amountPaisa,
        description,
      },
    ];
  }

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
