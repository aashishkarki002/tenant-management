/**
 * expense.js  (FIXED)
 *
 * Builds the journal payload for an expense.
 *
 * Correct double-entry:
 *   DR  Expense Account   (EXPENSE ↑ — cost recorded)
 *   CR  Cash / Bank       (ASSET ↓  — money leaves)
 *
 * Changes from original:
 *   - paymentMethod now required; CR account resolved via getCreditAccountForPayment().
 *   - Uses buildJournalPayload() for canonical, validated output.
 *   - assertIntegerPaisa() instead of silent conversion.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import { assertNepaliFields } from "../../../utils/nepaliDateHelper.js";
import {
  getCreditAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";

const EXPENSE_TYPE_MAP = {
  MAINTENANCE: "MAINTENANCE_EXPENSE",
  UTILITY: "UTILITY_EXPENSE",
  SALARY: "OTHER_EXPENSE",
  MANUAL: "OTHER_EXPENSE",
};

/**
 * @param {Object} expense
 *   Must have:  _id, amountPaisa (integer), paymentMethod,
 *               nepaliMonth, nepaliYear
 *   Optional:   expenseCode, EnglishDate, nepaliDate, createdBy,
 *               referenceType, tenant, property
 *
 * @param {string} [bankAccountCode]
 *   Required when paymentMethod is bank_transfer or cheque.
 *
 * @returns {Object} Canonical journal payload
 */
export function buildExpenseJournal(expense, bankAccountCode) {
  // ── 1. Validate ───────────────────────────────────────────────────────────
  assertValidPaymentMethod(expense.paymentMethod);
  assertIntegerPaisa(expense.amountPaisa, "expense.amountPaisa");
  assertNepaliFields({
    nepaliYear: expense.nepaliYear,
    nepaliMonth: expense.nepaliMonth,
  });

  // ── 2. Resolve accounts ───────────────────────────────────────────────────
  const expenseAccountCode = expense.expenseCode ?? ACCOUNT_CODES.EXPENSE_OTHER;
  const crAccountCode = getCreditAccountForPayment(
    expense.paymentMethod,
    bankAccountCode,
  );

  // ── 3. Metadata ───────────────────────────────────────────────────────────
  const transactionDate =
    expense.EnglishDate instanceof Date
      ? expense.EnglishDate
      : new Date(expense.EnglishDate ?? Date.now());
  const nepaliDate =
    expense.nepaliDate instanceof Date ? expense.nepaliDate : transactionDate;
  const tenantName = expense?.tenant?.name ?? "";
  const transactionType =
    EXPENSE_TYPE_MAP[expense.referenceType] ?? "OTHER_EXPENSE";
  const description =
    `Expense (${expense.referenceType ?? "OTHER"}) — ` +
    `${expense.amountPaisa / 100} NPR` +
    (tenantName ? ` — ${tenantName}` : "");

  // ── 4. Canonical payload ──────────────────────────────────────────────────
  return buildJournalPayload({
    transactionType,
    referenceType: "Expense",
    referenceId: expense._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: expense.nepaliMonth,
    nepaliYear: expense.nepaliYear,
    description,
    createdBy: expense.createdBy ?? null,
    totalAmountPaisa: expense.amountPaisa,
    tenant: expense.tenant,
    property: expense.property,
    entries: [
      {
        accountCode: expenseAccountCode,
        debitAmountPaisa: expense.amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: crAccountCode,
        debitAmountPaisa: 0,
        creditAmountPaisa: expense.amountPaisa,
        description,
      },
    ],
  });
}
