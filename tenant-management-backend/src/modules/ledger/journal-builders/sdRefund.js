/**
 * sdRefund.builder.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Journal payload builders for all Security Deposit settlement types.
 *
 * SETTLEMENT TYPES:
 *
 *  1. CASH_REFUND — SD fully or partially returned to tenant in cash/bank.
 *       DR  Security Deposit Liability  (2100)  — we owe less now
 *       CR  Bank / Cash                 (1010+) — money leaves our account
 *
 *  2. MAINTENANCE_ADJUSTMENT — SD withheld to cover maintenance/repair costs.
 *     Sub-case A: deducted from SD, recognised as income (revenue).
 *       DR  Security Deposit Liability  (2100)  — liability reduces
 *       CR  Maintenance Revenue         (4300)  — income recognised
 *     Sub-case B: deducted to pay an expense directly (e.g. contractor invoice).
 *       DR  Security Deposit Liability  (2100)  — liability reduces
 *       CR  Maintenance Expense Offset  (5000)  — expense offset / contra
 *
 *  3. RENT_ADJUSTMENT — SD applied to clear outstanding rent arrears.
 *       DR  Security Deposit Liability  (2100)  — liability reduces
 *       CR  Accounts Receivable         (1200)  — tenant's debt clears
 *
 *  4. CAM_ADJUSTMENT — SD applied to clear outstanding CAM dues.
 *       DR  Security Deposit Liability  (2100)  — liability reduces
 *       CR  Accounts Receivable         (1200)  — tenant CAM debt clears
 *
 *  5. ELECTRICITY_ADJUSTMENT — SD applied to clear electricity dues.
 *       DR  Security Deposit Liability  (2100)  — liability reduces
 *       CR  Accounts Receivable         (1200)  — electricity debt clears
 *
 *  6. COMPOUND — multiple adjustments in a single settlement (most common).
 *     Builds multiple DR/CR pairs, one per line item. The sum of all CRs
 *     equals the total DR on 2100.
 *
 * ALL amounts in PAISA (integers). Never rupees.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import {
  getDebitAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import NepaliDate from "nepali-datetime";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All supported adjustment types.
 * Add new types here and wire them in buildSdRefundJournal's router below.
 */
export const SD_ADJUSTMENT_TYPES = {
  CASH_REFUND: "CASH_REFUND",
  MAINTENANCE_ADJUSTMENT: "MAINTENANCE_ADJUSTMENT",
  MAINTENANCE_EXPENSE_OFFSET: "MAINTENANCE_EXPENSE_OFFSET",
  RENT_ADJUSTMENT: "RENT_ADJUSTMENT",
  CAM_ADJUSTMENT: "CAM_ADJUSTMENT",
  ELECTRICITY_ADJUSTMENT: "ELECTRICITY_ADJUSTMENT",
  COMPOUND: "COMPOUND",
};

/**
 * Human-readable labels for UI display.
 */
export const SD_ADJUSTMENT_LABELS = {
  CASH_REFUND: "Cash / Bank Refund",
  MAINTENANCE_ADJUSTMENT: "Maintenance Deduction (Revenue)",
  MAINTENANCE_EXPENSE_OFFSET: "Maintenance Deduction (Expense Offset)",
  RENT_ADJUSTMENT: "Applied to Rent Arrears",
  CAM_ADJUSTMENT: "Applied to CAM Dues",
  ELECTRICITY_ADJUSTMENT: "Applied to Electricity Dues",
  COMPOUND: "Compound Settlement",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function resolveNepaliDate(date) {
  const d = date instanceof Date ? date : new Date(date ?? Date.now());
  return formatNepaliISO(new NepaliDate(d));
}

function resolveNepaliMonthYear(date) {
  const d = date instanceof Date ? date : new Date(date ?? Date.now());
  const nd = new NepaliDate(d);
  return { nepaliMonth: nd.getMonth() + 1, nepaliYear: nd.getYear() };
}

function validatePaisa(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `${fieldName} must be a non-negative integer (paisa). Got: ${value}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE-ITEM BUILDERS
// Each returns one or more { accountCode, debitAmountPaisa, creditAmountPaisa,
// description } tuples that contribute to the compound journal.
// ─────────────────────────────────────────────────────────────────────────────

function buildCashRefundEntries(item, tenantName) {
  assertValidPaymentMethod(item.paymentMethod);
  const crAccount = getDebitAccountForPayment(
    item.paymentMethod,
    item.bankAccountCode,
  );
  const desc = `SD refund (${item.paymentMethod}) to ${tenantName}`;
  return [
    {
      accountCode: ACCOUNT_CODES.SECURITY_DEPOSIT_LIABILITY,
      debitAmountPaisa: item.amountPaisa,
      creditAmountPaisa: 0,
      description: desc,
    },
    {
      accountCode: crAccount,
      debitAmountPaisa: 0,
      creditAmountPaisa: item.amountPaisa,
      description: desc,
    },
  ];
}

function buildMaintenanceAdjustmentEntries(item, tenantName) {
  // Deducted from SD, credited as maintenance revenue
  const desc =
    item.description ??
    `SD withheld — maintenance deduction for ${tenantName}: ${item.note ?? ""}`;
  return [
    {
      accountCode: ACCOUNT_CODES.SECURITY_DEPOSIT_LIABILITY,
      debitAmountPaisa: item.amountPaisa,
      creditAmountPaisa: 0,
      description: desc,
    },
    {
      accountCode: ACCOUNT_CODES.MAINTENANCE_REVENUE, // "4300"
      debitAmountPaisa: 0,
      creditAmountPaisa: item.amountPaisa,
      description: desc,
    },
  ];
}

function buildMaintenanceExpenseOffsetEntries(item, tenantName) {
  // Deducted from SD to pay a contractor — offsets an existing expense
  const desc =
    item.description ??
    `SD withheld — contractor expense offset for ${tenantName}: ${item.note ?? ""}`;
  return [
    {
      accountCode: ACCOUNT_CODES.SECURITY_DEPOSIT_LIABILITY,
      debitAmountPaisa: item.amountPaisa,
      creditAmountPaisa: 0,
      description: desc,
    },
    {
      accountCode: ACCOUNT_CODES.EXPENSE, // "5000" — contra against existing expense
      debitAmountPaisa: 0,
      creditAmountPaisa: item.amountPaisa,
      description: desc,
    },
  ];
}

function buildReceivableAdjustmentEntries(item, tenantName, label) {
  // SD clears a tenant receivable (rent / CAM / electricity)
  const desc =
    item.description ?? `SD applied to ${label} dues for ${tenantName}`;
  return [
    {
      accountCode: ACCOUNT_CODES.SECURITY_DEPOSIT_LIABILITY,
      debitAmountPaisa: item.amountPaisa,
      creditAmountPaisa: 0,
      description: desc,
    },
    {
      accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, // "1200"
      debitAmountPaisa: 0,
      creditAmountPaisa: item.amountPaisa,
      description: desc,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE-ITEM ROUTER
// ─────────────────────────────────────────────────────────────────────────────

function buildEntriesForItem(item, tenantName) {
  validatePaisa(item.amountPaisa, `item(${item.type}).amountPaisa`);

  switch (item.type) {
    case SD_ADJUSTMENT_TYPES.CASH_REFUND:
      return buildCashRefundEntries(item, tenantName);

    case SD_ADJUSTMENT_TYPES.MAINTENANCE_ADJUSTMENT:
      return buildMaintenanceAdjustmentEntries(item, tenantName);

    case SD_ADJUSTMENT_TYPES.MAINTENANCE_EXPENSE_OFFSET:
      return buildMaintenanceExpenseOffsetEntries(item, tenantName);

    case SD_ADJUSTMENT_TYPES.RENT_ADJUSTMENT:
      return buildReceivableAdjustmentEntries(item, tenantName, "rent");

    case SD_ADJUSTMENT_TYPES.CAM_ADJUSTMENT:
      return buildReceivableAdjustmentEntries(item, tenantName, "CAM");

    case SD_ADJUSTMENT_TYPES.ELECTRICITY_ADJUSTMENT:
      return buildReceivableAdjustmentEntries(item, tenantName, "electricity");

    default:
      throw new Error(`Unknown SD adjustment type: ${item.type}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC BUILDER — buildSdRefundJournal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the complete journal payload for a security deposit settlement.
 *
 * @param {Object} sd         - Populated SD document (must have _id, amountPaisa,
 *                              tenant { name }, property)
 * @param {Object} settlement - Settlement instruction
 *   @param {string}   settlement.refundId          - SdRefund document _id (for referenceId)
 *   @param {Date}     [settlement.refundDate]       - Settlement date (default: now)
 *   @param {string}   [settlement.createdBy]        - Admin ObjectId
 *   @param {Object[]} settlement.lineItems          - One or more line items
 *     Each line item:
 *       @param {string}  type               - SD_ADJUSTMENT_TYPES key
 *       @param {number}  amountPaisa        - Amount for this line (integer)
 *       @param {string}  [paymentMethod]    - Required for CASH_REFUND
 *       @param {string}  [bankAccountCode]  - Required for bank_transfer / cheque
 *       @param {string}  [note]             - Free-text annotation
 *       @param {string}  [description]      - Override description
 * @param {string|ObjectId} entityId         - OwnershipEntity the SD belongs to
 *
 * @returns {Object} Journal payload for ledgerService.postJournalEntry()
 */
export function buildSdRefundJournal(sd, settlement, entityId) {
  if (!entityId) {
    throw new Error("buildSdRefundJournal: entityId is required");
  }
  if (!settlement?.lineItems?.length) {
    throw new Error(
      "buildSdRefundJournal: lineItems must be a non-empty array",
    );
  }

  const tenantName = sd?.tenant?.name ?? "Tenant";
  const refundDate = settlement.refundDate
    ? new Date(settlement.refundDate)
    : new Date();

  const nepaliDate = resolveNepaliDate(refundDate);
  const { nepaliMonth, nepaliYear } = resolveNepaliMonthYear(refundDate);

  // Build entries from all line items
  const allEntries = settlement.lineItems.flatMap((item) =>
    buildEntriesForItem(item, tenantName),
  );

  // Validate the journal balances
  const totalDebit = allEntries.reduce(
    (s, e) => s + (e.debitAmountPaisa || 0),
    0,
  );
  const totalCredit = allEntries.reduce(
    (s, e) => s + (e.creditAmountPaisa || 0),
    0,
  );
  if (totalDebit !== totalCredit) {
    throw new Error(
      `SD refund journal does not balance: DR ${totalDebit} vs CR ${totalCredit} paisa`,
    );
  }

  const isCompound = settlement.lineItems.length > 1;
  const primaryType = isCompound
    ? SD_ADJUSTMENT_TYPES.COMPOUND
    : settlement.lineItems[0].type;

  const description = isCompound
    ? `Security deposit settlement for ${tenantName} — ${settlement.lineItems.length} adjustments`
    : `${SD_ADJUSTMENT_LABELS[primaryType] ?? primaryType} for ${tenantName}`;

  return {
    transactionType: `SD_REFUND_${primaryType}`,
    referenceType: "SdRefund",
    referenceId: settlement.refundId,
    transactionDate: refundDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: settlement.createdBy,
    totalAmountPaisa: totalDebit,
    entityId,
    tenant: sd.tenant?._id ?? sd.tenant,
    property: sd.property,
    entries: allEntries,
  };
}
