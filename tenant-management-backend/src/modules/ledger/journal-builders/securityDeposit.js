/**
 * securityDeposit.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Journal payload builder for security deposit received.
 *
 * Double-entry:
 *   DR  Cash / Bank sub-account      (ASSET ↑     — money in)
 *   CR  Security Deposit Liability   (LIABILITY ↑ — we owe it back)
 *
 * FIX (this commit):
 *   Previously the 3rd parameter defaulted to ACCOUNT_CODES.CASH_BANK ("1000"),
 *   meaning any caller that forgot bankAccountCode silently debited the cash
 *   control account instead of the actual bank. This inflated "1000" and
 *   left the real bank sub-account untouched.
 *
 *   Now:
 *   - paymentMethod is required in options
 *   - bankAccountCode is required for bank_transfer / cheque
 *   - Both validated early; no default, no silent fallback
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { rupeesToPaisa } from "../../../utils/moneyUtil.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import {
  getDebitAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import NepaliDate from "nepali-datetime";

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

/**
 * @param {Object} sd - Security deposit document
 *   Must have:  _id, paidDate
 *   Optional:   amountPaisa (or amount), nepaliDate, tenant, property
 *
 * @param {Object} options
 *   Required:
 *     paymentMethod {string}
 *   Optional:
 *     bankAccountCode {string}  - required for bank_transfer / cheque
 *     nepaliMonth     {number}
 *     nepaliYear      {number}
 *     tenantName      {string}
 *     createdBy       {ObjectId}
 *
 * @param {string} [bankAccountCode]
 *   Can be passed as 3rd arg or inside options — 3rd arg takes precedence.
 *
 * @returns {Object} Journal payload
 */
export function buildSecurityDepositJournal(sd, options = {}, bankAccountCode) {
  const {
    paymentMethod,
    nepaliMonth: optNepaliMonth,
    nepaliYear: optNepaliYear,
    tenantName: optTenantName,
    createdBy,
  } = options;

  // ── 1. Validate ─────────────────────────────────────────────────────────
  assertValidPaymentMethod(paymentMethod);

  const resolvedBankCode = bankAccountCode ?? options.bankAccountCode;
  const drAccountCode = getDebitAccountForPayment(
    paymentMethod,
    resolvedBankCode,
  );

  // ── 2. Amount ────────────────────────────────────────────────────────────
  const amountPaisa =
    sd.amountPaisa !== undefined
      ? sd.amountPaisa
      : sd.amount !== undefined
        ? rupeesToPaisa(sd.amount)
        : 0;

  // ── 3. Dates ─────────────────────────────────────────────────────────────
  const transactionDate = sd.paidDate || new Date();
  const nepaliDate = resolveNepaliDateString(sd.nepaliDate, transactionDate);

  let nepaliMonth = optNepaliMonth;
  let nepaliYear = optNepaliYear;
  if (!nepaliMonth || !nepaliYear) {
    const nd = new NepaliDate(transactionDate);
    nepaliMonth = nepaliMonth ?? nd.getMonth() + 1;
    nepaliYear = nepaliYear ?? nd.getYear();
  }

  // ── 4. Description ───────────────────────────────────────────────────────
  const tenantName =
    optTenantName ?? sd?.tenant?.name ?? (sd?.tenant ? "Tenant" : "Unknown");
  const description = `Security deposit received from ${tenantName} for ${nepaliMonth}/${nepaliYear}`;

  // ── 5. Payload ───────────────────────────────────────────────────────────
  return {
    transactionType: "SECURITY_DEPOSIT",
    referenceType: "SecurityDeposit",
    referenceId: sd._id,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy,
    totalAmountPaisa: amountPaisa,
    tenant: sd.tenant,
    property: sd.property,
    entries: [
      {
        accountCode: drAccountCode, // ← specific bank or CASH, never hard-coded
        debitAmountPaisa: amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.SECURITY_DEPOSIT_LIABILITY,
        debitAmountPaisa: 0,
        creditAmountPaisa: amountPaisa,
        description,
      },
    ],
  };
}
