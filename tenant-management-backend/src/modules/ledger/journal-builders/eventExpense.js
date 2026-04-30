/**
 * eventExpense.js
 *
 * Builds the journal payload for an event operating expense (Sallyan House events).
 *
 * Journal: we pay for event logistics (stage, decorations, security, etc.)
 *   DR  5450 EVENT_EXPENSE   amountPaisa   (EXPENSE ↑ — cost recorded)
 *   CR  Cash/Bank            amountPaisa   (ASSET ↓  — money leaves)
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { buildJournalPayload } from "../../../utils/journalPayloadUtils.js";
import {
  getCreditAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import { assertIntegerPaisa } from "../../../utils/moneyUtil.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : new Date(raw ?? Date.now());
  return formatNepaliISO(new NepaliDate(base));
}

/**
 * @param {Object} expense  - EventExpense document (plain object or Mongoose doc)
 *   Must have:  _id, amountPaisa (integer), paymentMethod, nepaliMonth, nepaliYear
 *   Optional:   expenseDate, nepaliDate, recordedBy, property, expenseAccountCode
 *
 * @param {string} bankAccountCode   - required when paymentMethod !== "cash"
 *
 * @returns {Object} Canonical journal payload
 */
export function buildEventExpenseJournal(expense, bankAccountCode) {
  assertValidPaymentMethod(expense.paymentMethod);
  assertIntegerPaisa(expense.amountPaisa, "expense.amountPaisa");

  const { nepaliMonth, nepaliYear } = expense;
  if (!nepaliMonth || !nepaliYear) {
    throw new Error("eventExpense journal: nepaliMonth and nepaliYear are required");
  }

  const transactionDate =
    expense.expenseDate instanceof Date
      ? expense.expenseDate
      : new Date(expense.expenseDate ?? Date.now());

  const nepaliDate = resolveNepaliDateString(expense.nepaliDate, transactionDate);
  const amountNPR = expense.amountPaisa / 100;
  const desc = expense.description ?? "Event expense";
  const description = `${desc} — ${amountNPR} NPR`;

  const drAccountCode = expense.expenseAccountCode ?? ACCOUNT_CODES.EVENT_EXPENSE;
  const crAccountCode = getCreditAccountForPayment(expense.paymentMethod, bankAccountCode);

  return buildJournalPayload({
    transactionType: "EVENT_EXPENSE",
    referenceType: "EventExpense",
    referenceId: expense._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: expense.recordedBy ?? null,
    totalAmountPaisa: expense.amountPaisa,
    property: expense.property ?? null,
    entries: [
      {
        accountCode: drAccountCode,
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
