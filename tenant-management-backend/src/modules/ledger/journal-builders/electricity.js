/**
 * electricity.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Journal payload builders for electricity charges and payments.
 *
 * buildElectricityChargeJournal   — charge raised against tenant
 *   DR  Accounts Receivable    (ASSET ↑  — tenant owes)
 *   CR  Utility Revenue        (REVENUE ↑ — income earned)
 *
 * buildElectricityPaymentJournal  — payment received from tenant
 *   DR  Cash / Bank sub-account  (ASSET ↑  — money in)
 *   CR  Accounts Receivable      (ASSET ↓  — tenant owes less)
 *
 * buildElectricityNeaCostJournal  — NEA cost recognised at time of charge (NEW)
 *   DR  Electricity Expense – NEA  (EXPENSE ↑ — owner's cost from NEA)
 *   CR  NEA Payable                (LIABILITY ↑ — owner owes NEA)
 *
 * Changes in this update:
 *   1. All three builders now carry unit, block, and entityId on the payload
 *      so LedgerEntry documents are fully scoped for per-entity reporting.
 *   2. buildElectricityNeaCostJournal is a new export — was previously an
 *      inline helper in electricity.service.js using string account codes.
 *      Moved here and wired to real ACCOUNT_CODES constants.
 *   3. buildElectricityChargeJournal and buildElectricityPaymentJournal accept
 *      the electricity doc's unit and block references (resolved from the
 *      populated Unit document) and the ownershipEntityId from the Block.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { rupeesToPaisa, paisaToRupees } from "../../../utils/moneyUtil.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import {
  getDebitAccountForPayment,
  assertValidPaymentMethod,
} from "../../../utils/paymentAccountUtils.js";
import NepaliDate from "nepali-datetime";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveNepaliDateString(raw, fallback) {
  if (typeof raw === "string" && raw.length > 0) return raw;
  const base = raw instanceof Date ? raw : fallback;
  return formatNepaliISO(new NepaliDate(base));
}

function resolvePaisa(doc, paisaKey, rupeesKey) {
  if (doc[paisaKey] !== undefined) return doc[paisaKey];
  if (doc[rupeesKey] !== undefined) return rupeesToPaisa(doc[rupeesKey]);
  return 0;
}

/**
 * Resolve unit, block, and entityId from the electricity document.
 *
 * The electricity document carries:
 *   electricity.unit      → Unit ObjectId or populated Unit doc
 *   electricity.unit.block → Block ObjectId or populated Block doc (when populated)
 *   electricity.unit.block.ownershipEntityId → OwnershipEntity ObjectId (when populated)
 *
 * The service populates unit → block → ownershipEntityId before calling
 * these builders. If not populated, we fall back to null gracefully —
 * never throw here, the ledger service handles null entityId (treats as private).
 */
function resolveScope(electricity) {
  const unitId = electricity.unit?._id ?? electricity.unit ?? null;

  // block may be nested on the populated unit, or top-level on the doc
  const block =
    electricity.unit?.block ?? // populated path: unit.block
    electricity.block ?? // flat path if service attaches it directly
    null;

  const blockId = block?._id ?? block ?? null;

  // ownershipEntityId lives on the Block document
  const entityId =
    block?.ownershipEntityId?._id ??
    block?.ownershipEntityId ??
    electricity.entityId ?? // fallback if service passes it directly
    null;

  return { unitId, blockId, entityId };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Charge journal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build journal payload for an electricity charge raised against a tenant.
 *
 * @param {Object} electricity  — Mongoose document or plain object
 *   Required: _id, readingDate, nepaliDate, nepaliMonth, nepaliYear,
 *             consumption, totalAmountPaisa (or totalAmount), createdBy,
 *             tenant (populated or ObjectId), property
 *   Expected populated: unit.block.ownershipEntityId
 *
 * @returns {Object} Journal payload for ledgerService.postJournalEntry()
 */
export function buildElectricityChargeJournal(electricity) {
  const transactionDate = electricity.readingDate || new Date();
  const nepaliDate = resolveNepaliDateString(
    electricity.nepaliDate,
    transactionDate,
  );
  const totalAmountPaisa = resolvePaisa(
    electricity,
    "totalAmountPaisa",
    "totalAmount",
  );
  const ratePerUnitPaisa = resolvePaisa(
    electricity,
    "ratePerUnitPaisa",
    "ratePerUnit",
  );
  const rateDisplay = paisaToRupees(ratePerUnitPaisa);

  const tenantName = electricity?.tenant?.name;
  const tenantId = electricity.tenant?._id ?? electricity.tenant;
  const propertyId = electricity.property?._id ?? electricity.property;

  const { unitId, blockId, entityId } = resolveScope(electricity);

  const description = [
    `Electricity charge for ${electricity.nepaliMonth}/${electricity.nepaliYear}`,
    `${electricity.consumption} units`,
    tenantName ? `from ${tenantName}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return {
    transactionType: "ELECTRICITY_CHARGE",
    referenceType: "Electricity",
    referenceId: electricity._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: electricity.nepaliMonth,
    nepaliYear: electricity.nepaliYear,
    description,
    createdBy: electricity.createdBy,
    totalAmountPaisa,
    tenant: tenantId,
    property: propertyId,
    unit: unitId, // ← NEW: scoped to unit
    block: blockId, // ← NEW: scoped to block (building)
    entityId, // ← NEW: scoped to ownership entity
    entries: [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: totalAmountPaisa,
        creditAmountPaisa: 0,
        description: `Electricity receivable — ${electricity.consumption} units @ Rs.${rateDisplay}`,
      },
      {
        accountCode: ACCOUNT_CODES.UTILITY_REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: totalAmountPaisa,
        description: `Electricity revenue — ${electricity.consumption} units @ Rs.${rateDisplay}`,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Payment journal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build journal payload for an electricity payment received from a tenant.
 *
 * @param {Object} paymentData
 *   Required: electricityId, amountPaisa (or amount), paymentDate,
 *             nepaliDate, createdBy, paymentMethod
 *   Optional: bankAccountCode — required for bank_transfer / cheque
 *
 * @param {Object} electricity
 *   Required: tenant, property, nepaliMonth, nepaliYear
 *   Expected populated: unit.block.ownershipEntityId
 *
 * @param {string} [bankAccountCode]  — 3rd arg takes precedence over paymentData.bankAccountCode
 *
 * @returns {Object} Journal payload
 */
export function buildElectricityPaymentJournal(
  paymentData,
  electricity,
  bankAccountCode,
) {
  const resolvedBankCode = bankAccountCode ?? paymentData.bankAccountCode;

  assertValidPaymentMethod(paymentData.paymentMethod);

  const drAccountCode = getDebitAccountForPayment(
    paymentData.paymentMethod,
    resolvedBankCode,
  );

  const transactionDate = paymentData.paymentDate || new Date();
  const nepaliDate = resolveNepaliDateString(
    paymentData.nepaliDate,
    transactionDate,
  );
  const amountPaisa = resolvePaisa(paymentData, "amountPaisa", "amount");

  const nepaliMonth = electricity.nepaliMonth;
  const nepaliYear = electricity.nepaliYear;
  const tenantName = electricity?.tenant?.name;
  const tenantId = electricity.tenant?._id ?? electricity.tenant;
  const propertyId = electricity.property?._id ?? electricity.property;

  const { unitId, blockId, entityId } = resolveScope(electricity);

  const description = [
    `Electricity payment — ${nepaliMonth}/${nepaliYear}`,
    tenantName ? `from ${tenantName}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    transactionType: "ELECTRICITY_PAYMENT",
    referenceType: "Electricity",
    referenceId: paymentData.electricityId,
    transactionDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description,
    createdBy: paymentData.createdBy,
    totalAmountPaisa: amountPaisa,
    tenant: tenantId,
    property: propertyId,
    unit: unitId, // ← NEW
    block: blockId, // ← NEW
    entityId, // ← NEW
    entries: [
      {
        accountCode: drAccountCode,
        debitAmountPaisa: amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: amountPaisa,
        description,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. NEA cost journal  (NEW)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build journal payload for the owner's NEA electricity cost.
 * Posted at the same time as the charge journal, in the same session.
 *
 * This is what creates the margin in P&L:
 *   Electricity Revenue  (CR from charge journal)   Rs 2,000
 *   Electricity Expense  (DR from this journal)     Rs 1,500
 *   ───────────────────────────────────────────────────────
 *   Net margin                                       Rs   500
 *
 * Only called when electricity.neaCostPaisa is set (i.e. NEA rate was
 * configured at time of reading). The service guards this before calling.
 *
 * @param {Object} electricity
 *   Required: _id, neaCostPaisa, neaRatePerUnitPaisa, consumption,
 *             nepaliMonth, nepaliYear, readingDate, nepaliDate,
 *             createdBy, property
 *   Expected populated: unit.block.ownershipEntityId
 *
 * @returns {Object} Journal payload
 */
export function buildElectricityNeaCostJournal(electricity) {
  const transactionDate = electricity.readingDate || new Date();
  const nepaliDate = resolveNepaliDateString(
    electricity.nepaliDate,
    transactionDate,
  );
  const neaCostPaisa = electricity.neaCostPaisa;
  const neaRateDisplay = electricity.neaRatePerUnitPaisa
    ? paisaToRupees(electricity.neaRatePerUnitPaisa)
    : "?";

  const propertyId = electricity.property?._id ?? electricity.property;
  const { unitId, blockId, entityId } = resolveScope(electricity);

  const description =
    `NEA electricity cost — ${electricity.consumption} units @ Rs.${neaRateDisplay} ` +
    `(${electricity.nepaliMonth}/${electricity.nepaliYear})`;

  return {
    transactionType: "ELECTRICITY_NEA_COST",
    referenceType: "Electricity",
    referenceId: electricity._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: electricity.nepaliMonth,
    nepaliYear: electricity.nepaliYear,
    description,
    createdBy: electricity.createdBy,
    totalAmountPaisa: neaCostPaisa,
    property: propertyId,
    unit: unitId, // ← scoped to unit
    block: blockId, // ← scoped to block
    entityId, // ← scoped to ownership entity
    entries: [
      {
        // DR  Electricity Expense – NEA  (expense rises — owner pays NEA)
        accountCode: ACCOUNT_CODES.ELECTRICITY_EXPENSE_NEA,
        debitAmountPaisa: neaCostPaisa,
        creditAmountPaisa: 0,
        description: `NEA cost — ${electricity.consumption} units @ Rs.${neaRateDisplay}`,
      },
      {
        // CR  NEA Payable  (liability rises — owner owes NEA)
        accountCode: ACCOUNT_CODES.NEA_PAYABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: neaCostPaisa,
        description: `NEA payable — ${electricity.nepaliMonth}/${electricity.nepaliYear}`,
      },
    ],
  };
}
