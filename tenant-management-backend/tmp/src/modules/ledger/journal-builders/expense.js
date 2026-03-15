/**
 * expense.js  (FIXED)
 *
 * Builds the journal payload for an expense.
 *
 * Correct double-entry:
 *   DR  Expense Account   (EXPENSE ↑ — cost recorded)
 *   CR  Cash / Bank       (ASSET ↓  — money leaves)
 *
 * FIX: nepaliDate now always stored as a BS "YYYY-MM-DD" string,
 *      never as a raw Date object.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import {
  assertNepaliFields,
  formatNepaliISO,
} from "../../../utils/nepaliDateHelper.js";
import {
  getCreditAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

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

  // FIX: always a BS "YYYY-MM-DD" string
  const nepaliDate = resolveNepaliDateString(
    expense.nepaliDate,
    transactionDate,
  );

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
