/**
 * electricity.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Journal payload builders for electricity charges and payments.
 *
 * buildElectricityChargeJournal   — charge raised against tenant (UNIT meters only)
 *   DR  Accounts Receivable              (ASSET ↑  — tenant owes at custom rate)
 *   CR  Electricity Recoverable (1400)   (ASSET ↓  — NEA cost portion recovered)
 *   CR  Utility Revenue (4100)           (REVENUE ↑ — margin only: custom − NEA rate)
 *
 *   Fallback (neaCostPaisa not set): 2-entry form, full amount to Utility Revenue.
 *
 * buildElectricityPaymentJournal  — payment received from tenant
 *   DR  Cash / Bank sub-account  (ASSET ↑  — money in)
 *   CR  Accounts Receivable      (ASSET ↓  — tenant owes less)
 *
 * buildNeaBillEnergyCostJournal   — NEA energy cost when monthly bill is uploaded
 *   DR  Electricity Recoverable (1400)   (ASSET ↑  — recoverable from tenants)
 *   CR  NEA Payable (2050)               (LIABILITY ↑ — owner owes NEA)
 *
 *   Energy charges are NOT an expense — they are a recoverable asset.
 *   Only demand charges (buildElectricityDemandChargeJournal) hit the P&L.
 *
 * NOTE: NEA cost is NOT posted per unit reading. It is posted when the actual
 * monthly NEA bill is uploaded (neaBill.controller.js), using the real bill amount.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { rupeesToPaisa, paisaToRupees } from "../../../utils/moneyUtil.js";
import { formatNepaliISO, assertNepaliFields } from "../../../utils/nepaliDateHelper.js";
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
 * THREE-ENTRY form (when neaCostPaisa is available):
 *   DR  Accounts Receivable (1200)       totalAmountPaisa  — tenant owes at custom rate
 *   CR  Electricity Recoverable (1400)   neaCostPaisa      — drains the asset created by NEA bill
 *   CR  Utility Revenue (4100)           marginPaisa       — profit = custom rate − NEA rate
 *
 * TWO-ENTRY fallback (neaCostPaisa not set / legacy readings):
 *   DR  Accounts Receivable (1200)       totalAmountPaisa
 *   CR  Utility Revenue (4100)           totalAmountPaisa
 *
 * @param {Object} electricity  — Mongoose document or plain object
 *   Required: _id, readingDate, nepaliDate, nepaliMonth, nepaliYear,
 *             consumption, totalAmountPaisa (or totalAmount), createdBy,
 *             tenant (populated or ObjectId), property
 *   Preferred: neaCostPaisa — NEA cost for this reading (enables 3-entry form)
 *   Expected populated: unit.block.ownershipEntityId
 *
 * @returns {Object} Journal payload for ledgerService.postJournalEntry()
 */
export function buildElectricityChargeJournal(electricity) {
  assertNepaliFields({ nepaliYear: electricity.nepaliYear, nepaliMonth: electricity.nepaliMonth });

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

  // NEA cost at NEA rate — if present, enables the recoverable split.
  // marginPaisa = profit = custom rate billing − NEA cost.
  const neaCostPaisa = electricity.neaCostPaisa ?? 0;
  const marginPaisa  = totalAmountPaisa - neaCostPaisa;

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

  // Build entries: 3-entry form when NEA cost is known, 2-entry fallback otherwise.
  let entries;
  if (neaCostPaisa > 0) {
    entries = [
      {
        accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa: totalAmountPaisa,
        creditAmountPaisa: 0,
        description: `Electricity receivable — ${electricity.consumption} units @ Rs.${rateDisplay}`,
      },
      {
        accountCode: ACCOUNT_CODES.ELECTRICITY_RECOVERABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: neaCostPaisa,
        description: `Electricity recoverable — NEA cost (${electricity.consumption} units)`,
      },
      {
        accountCode: ACCOUNT_CODES.UTILITY_REVENUE,
        debitAmountPaisa: marginPaisa < 0 ? -marginPaisa : 0,
        creditAmountPaisa: marginPaisa >= 0 ? marginPaisa : 0,
        description: `Electricity margin — ${electricity.consumption} units @ Rs.${rateDisplay}`,
      },
    ];
  } else {
    // Legacy / no NEA rate set — full amount to revenue (original 2-entry behavior)
    entries = [
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
    ];
  }

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
    unit: unitId,
    block: blockId,
    entityId,
    entries,
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
// 3. Common area / parking / sub-meter expense journal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build journal payload for common area, parking, or sub-meter electricity.
 * These are property-billed readings — no tenant AR, no revenue.
 * The entire cost is an operating expense.
 *
 *   DR  Electricity Expense – Common (5615)   neaCostPaisa (or totalAmountPaisa fallback)
 *   CR  NEA Payable (2050)                    same amount
 *
 * @param {Object} electricity — Mongoose document or plain object
 *   Required: _id, readingDate, nepaliDate, nepaliMonth, nepaliYear,
 *             consumption, neaCostPaisa (preferred) or totalAmountPaisa,
 *             neaRatePerUnitPaisa, createdBy, property
 *   Expected populated: subMeter.block.ownershipEntityId
 */
export function buildElectricityCommonAreaJournal(electricity) {
  const transactionDate = electricity.readingDate || new Date();
  const nepaliDate = resolveNepaliDateString(electricity.nepaliDate, transactionDate);

  // Use NEA cost (actual cost at 12.50/unit) if available, else fall back to totalAmountPaisa
  const expenseAmountPaisa = electricity.neaCostPaisa ?? electricity.totalAmountPaisa;
  const rateDisplay = electricity.neaRatePerUnitPaisa
    ? paisaToRupees(electricity.neaRatePerUnitPaisa)
    : paisaToRupees(electricity.ratePerUnitPaisa ?? 0);

  const meterLabel =
    electricity.meterType === "common_area"
      ? "Common area"
      : electricity.meterType === "parking"
        ? "Parking"
        : "Sub-meter";

  const propertyId = electricity.property?._id ?? electricity.property;

  // For sub-meters, scope comes from subMeter.block (unit is null)
  const subMeter = electricity.subMeter;
  const block =
    (typeof subMeter === "object" && subMeter?.block) ?? electricity.block ?? null;
  const blockId = block?._id ?? block ?? null;
  const entityId =
    block?.ownershipEntityId?._id ??
    block?.ownershipEntityId ??
    electricity.entityId ??
    null;

  const description =
    `${meterLabel} electricity — ${electricity.consumption} units @ Rs.${rateDisplay} ` +
    `(${electricity.nepaliMonth}/${electricity.nepaliYear})`;

  return {
    transactionType: "ELECTRICITY_COMMON_EXPENSE",
    referenceType: "Electricity",
    referenceId: electricity._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: electricity.nepaliMonth,
    nepaliYear: electricity.nepaliYear,
    description,
    createdBy: electricity.createdBy,
    totalAmountPaisa: expenseAmountPaisa,
    property: propertyId,
    block: blockId,
    entityId,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ELECTRICITY_EXPENSE_COMMON,
        debitAmountPaisa: expenseAmountPaisa,
        creditAmountPaisa: 0,
        description: `${meterLabel} electricity cost — ${electricity.consumption} units @ Rs.${rateDisplay}`,
      },
      {
        accountCode: ACCOUNT_CODES.NEA_PAYABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: expenseAmountPaisa,
        description: `NEA payable — ${electricity.nepaliMonth}/${electricity.nepaliYear}`,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. NEA demand charge journal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build journal payload for the fixed monthly NEA demand charge.
 * Called when a NEA bill is uploaded/finalized and demandChargePaisa > 0.
 *
 *   DR  Electricity Demand Charge Expense (5616)   demandChargePaisa
 *   CR  NEA Payable (2050)                         demandChargePaisa
 *
 * @param {Object} neaBill — NeaBill Mongoose document or plain object
 *   Required: _id, demandChargePaisa, nepaliMonth, nepaliYear, uploadedBy
 * @param {ObjectId|null} entityId — OwnershipEntity for this property
 */
export function buildElectricityDemandChargeJournal(neaBill, entityId) {
  const transactionDate = neaBill.billDate || new Date();
  const nepaliDate =
    typeof neaBill.nepaliDate === "string"
      ? neaBill.nepaliDate
      : `${neaBill.nepaliYear}-${String(neaBill.nepaliMonth).padStart(2, "0")}-01`;

  const description =
    `NEA demand charge — ${neaBill.nepaliMonth}/${neaBill.nepaliYear}` +
    ` (Rs.${paisaToRupees(neaBill.demandChargePaisa)})`;

  return {
    transactionType: "ELECTRICITY_DEMAND_CHARGE",
    referenceType: "NeaBill",
    referenceId: neaBill._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: neaBill.nepaliMonth,
    nepaliYear: neaBill.nepaliYear,
    description,
    createdBy: neaBill.uploadedBy,
    totalAmountPaisa: neaBill.demandChargePaisa,
    property: neaBill.property?._id ?? neaBill.property,
    entityId,
    entries: [
      {
        accountCode: ACCOUNT_CODES.ELECTRICITY_DEMAND_CHARGE_EXPENSE,
        debitAmountPaisa: neaBill.demandChargePaisa,
        creditAmountPaisa: 0,
        description: `NEA demand charge — ${neaBill.nepaliMonth}/${neaBill.nepaliYear}`,
      },
      {
        accountCode: ACCOUNT_CODES.NEA_PAYABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: neaBill.demandChargePaisa,
        description: `NEA payable — demand charge ${neaBill.nepaliMonth}/${neaBill.nepaliYear}`,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. NEA bill payment journal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build journal payload for paying the NEA bill (owner → NEA).
 *
 *   DR  NEA Payable (2050)   totalAmountPaisa   ← clears the liability
 *   CR  Cash / Bank          totalAmountPaisa   ← money exits
 *
 * @param {Object} neaBill — NeaBill document
 * @param {Object} paymentData
 *   Required: paymentMethod, paymentDate, createdBy
 *   Optional: bankAccountCode (required for bank_transfer / cheque)
 * @param {ObjectId|null} entityId
 */
export function buildNeaBillPaymentJournal(neaBill, paymentData, entityId) {
  assertValidPaymentMethod(paymentData.paymentMethod);

  const drAccountCode = ACCOUNT_CODES.NEA_PAYABLE; // DR: clears liability
  const crAccountCode = getDebitAccountForPayment(
    paymentData.paymentMethod,
    paymentData.bankAccountCode,
  );

  const transactionDate = paymentData.paymentDate
    ? new Date(paymentData.paymentDate)
    : new Date();
  const nepaliDate = resolveNepaliDateString(
    paymentData.nepaliDate,
    transactionDate,
  );
  const amountPaisa = neaBill.totalAmountPaisa;

  const description = `NEA bill payment — ${neaBill.nepaliMonth}/${neaBill.nepaliYear} (Rs.${paisaToRupees(amountPaisa)})`;

  return {
    transactionType: "NEA_PAYMENT",
    referenceType: "NeaBill",
    referenceId: neaBill._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: neaBill.nepaliMonth,
    nepaliYear: neaBill.nepaliYear,
    description,
    createdBy: paymentData.createdBy,
    totalAmountPaisa: amountPaisa,
    property: neaBill.property?._id ?? neaBill.property,
    entityId,
    entries: [
      {
        accountCode: drAccountCode,
        debitAmountPaisa: amountPaisa,
        creditAmountPaisa: 0,
        description,
      },
      {
        accountCode: crAccountCode,
        debitAmountPaisa: 0,
        creditAmountPaisa: amountPaisa,
        description,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. NEA bill energy cost journal  (posted when monthly NEA bill is uploaded)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build journal payload for the energy (unit-consumption) portion of the
 * monthly NEA bill. Called in neaBill.controller.js when the bill is uploaded.
 *
 * Amount = neaBill.totalAmountPaisa − neaBill.demandChargePaisa
 * (demand charge is posted separately via buildElectricityDemandChargeJournal)
 *
 * CORRECT ACCOUNTING — energy charges are a RECOVERABLE ASSET, NOT an expense:
 *
 *   DR  Electricity Recoverable (1400)   energyChargePaisa   ← ASSET ↑
 *   CR  NEA Payable (2050)               energyChargePaisa   ← LIABILITY ↑
 *
 *   DR  Electricity Demand Charge (5616) demandChargePaisa   ← EXPENSE ↑
 *   CR  NEA Payable (2050)               demandChargePaisa   ← LIABILITY ↑
 *   ──────────────────────────────────────────────────────────────────────
 *   Total NEA Payable = totalAmountPaisa  ✓  (matches payNeaBill DR)
 *
 * Balance sheet impact:
 *   Assets   ↑  Electricity Recoverable = energyChargePaisa
 *   Liabilities ↑ NEA Payable           = totalAmountPaisa
 *   Equity   ↓  only by demandChargePaisa (retained earnings unaffected by energy)
 *
 * The asset drains when tenants are billed (buildElectricityChargeJournal):
 *   DR  AR (1200)     totalAmountPaisa at custom rate
 *   CR  1400          neaCostPaisa     ← asset drains
 *   CR  Revenue 4100  marginPaisa      ← only the margin hits P&L
 *
 * Idempotent: ledgerService guards on (entityId, transactionType, referenceType, referenceId).
 *
 * @param {Object} neaBill  — NeaBill Mongoose document or plain object
 *   Required: _id, totalAmountPaisa, demandChargePaisa, nepaliMonth, nepaliYear, uploadedBy
 * @param {ObjectId|null} entityId — OwnershipEntity for this property
 */
export function buildNeaBillEnergyCostJournal(neaBill, entityId) {
  const transactionDate = neaBill.billDate || new Date();
  const nepaliDate =
    typeof neaBill.nepaliDate === "string"
      ? neaBill.nepaliDate
      : `${neaBill.nepaliYear}-${String(neaBill.nepaliMonth).padStart(2, "0")}-01`;

  // Energy charge = total bill minus demand charge component
  const energyChargePaisa =
    neaBill.totalAmountPaisa - (neaBill.demandChargePaisa ?? 0);

  const description =
    `NEA energy recoverable — ${neaBill.nepaliMonth}/${neaBill.nepaliYear}` +
    ` (Rs.${paisaToRupees(energyChargePaisa)})`;

  return {
    transactionType: "NEA_BILL_ENERGY_COST",
    referenceType: "NeaBill",
    referenceId: neaBill._id,
    transactionDate,
    nepaliDate,
    nepaliMonth: neaBill.nepaliMonth,
    nepaliYear: neaBill.nepaliYear,
    description,
    createdBy: neaBill.uploadedBy,
    totalAmountPaisa: energyChargePaisa,
    property: neaBill.property?._id ?? neaBill.property,
    entityId,
    entries: [
      {
        // CORRECTED: energy is a recoverable ASSET, not an expense.
        // Old code used ELECTRICITY_EXPENSE_NEA (5610) which incorrectly reduced
        // retained earnings and caused P&L to overstate expenses.
        accountCode: ACCOUNT_CODES.ELECTRICITY_RECOVERABLE,
        debitAmountPaisa: energyChargePaisa,
        creditAmountPaisa: 0,
        description: `Electricity recoverable — NEA energy ${neaBill.nepaliMonth}/${neaBill.nepaliYear}`,
      },
      {
        accountCode: ACCOUNT_CODES.NEA_PAYABLE,
        debitAmountPaisa: 0,
        creditAmountPaisa: energyChargePaisa,
        description: `NEA payable — energy ${neaBill.nepaliMonth}/${neaBill.nepaliYear}`,
      },
    ],
  };
}
