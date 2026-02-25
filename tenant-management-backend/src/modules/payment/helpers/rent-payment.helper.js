/**
 * rent-payment.helper.js  (FIXED)
 *
 * ROOT BUG in every calculation: used gross rentAmountPaisa for "what is owed".
 * Tenant only pays effectiveRentPaisa = gross - TDS.
 * The same fix was applied to rent.Model.js pre-save hook and rent.domain.js.
 *
 * FIX summary (applies to single-unit AND per-unit breakdown):
 *   effectiveRentPaisa = rentAmountPaisa - (tdsAmountPaisa || 0)
 *   remaining          = effectiveRentPaisa - paidAmountPaisa
 *   paid status        = paidAmountPaisa >= effectiveRentPaisa
 */

import { getAllocationStrategy } from "./payment.allocation.helper.js";
import {
  validateUnitAllocations,
  validatePaymentNotExceeding,
} from "./payment-validation.helper.js";

// ── ID normaliser ─────────────────────────────────────────────────────────────
function resolveUnitId(val) {
  if (val == null) return null;
  if (val._id) return val._id.toString();
  return typeof val === "string" ? val : val.toString();
}

// ── Effective rent helper (single source of truth in this file) ───────────────
function effectiveRent(unit) {
  return (unit.rentAmountPaisa || 0) - (unit.tdsAmountPaisa || 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLY PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply payment to rent — handles both single-unit and multi-unit rents.
 *
 * @param {Object}   rent
 * @param {number}   totalPaymentPaisa
 * @param {Array}    unitAllocations       optional manual allocations
 * @param {Date}     paymentDate
 * @param {ObjectId} receivedBy
 * @param {string}   allocationStrategy    'proportional' | 'fifo' | 'manual'
 * @returns {Array|null} unit allocations used (null for single-unit)
 */
export function applyPaymentToRent(
  rent,
  totalPaymentPaisa,
  unitAllocations = null,
  paymentDate,
  receivedBy,
  allocationStrategy = "proportional",
) {
  validatePaymentNotExceeding(rent, totalPaymentPaisa, unitAllocations);

  if (rent.useUnitBreakdown && rent.unitBreakdown?.length > 0) {
    let allocations = unitAllocations;

    if (!allocations || allocations.length === 0) {
      const strategyFn = getAllocationStrategy(allocationStrategy);
      allocations = strategyFn(rent.unitBreakdown, totalPaymentPaisa);
    }

    validateUnitAllocations(rent.unitBreakdown, allocations, totalPaymentPaisa);

    allocations.forEach(({ unitId, amountPaisa }) => {
      const unitIdStr = resolveUnitId(unitId);
      if (!unitIdStr) return;
      const ub = rent.unitBreakdown.find(
        (u) => resolveUnitId(u.unit) === unitIdStr,
      );
      if (ub) ub.paidAmountPaisa = (ub.paidAmountPaisa || 0) + amountPaisa;
    });

    // Sync root paidAmountPaisa from unit breakdown
    rent.paidAmountPaisa = rent.unitBreakdown.reduce(
      (sum, u) => sum + (u.paidAmountPaisa || 0),
      0,
    );

    rent.lastPaidDate = paymentDate;
    rent.lastPaidBy = receivedBy;

    // Status update handled by pre-save hook — call updateRentStatus here for
    // in-memory accuracy before save (hook will confirm on save)
    updateRentStatus(rent);

    return allocations;
  }

  // Single-unit
  rent.paidAmountPaisa = (rent.paidAmountPaisa || 0) + totalPaymentPaisa;
  rent.lastPaidDate = paymentDate;
  rent.lastPaidBy = receivedBy;
  updateRentStatus(rent);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update rent status based on payment vs effectiveRentPaisa (gross − TDS).
 *
 * FIX: was comparing paidAmountPaisa vs gross rentAmountPaisa.
 * Tenant who pays effectiveRentPaisa was never marked "paid".
 */
export function updateRentStatus(rent) {
  let effectiveDue, totalPaid;

  if (rent.useUnitBreakdown && rent.unitBreakdown?.length > 0) {
    // FIX: sum effectiveRent per unit (gross - TDS), not gross
    effectiveDue = rent.unitBreakdown.reduce(
      (sum, u) => sum + effectiveRent(u),
      0,
    );
    totalPaid = rent.unitBreakdown.reduce(
      (sum, u) => sum + (u.paidAmountPaisa || 0),
      0,
    );
  } else {
    // FIX: effectiveRentPaisa = gross − TDS
    effectiveDue = (rent.rentAmountPaisa || 0) - (rent.tdsAmountPaisa || 0);
    totalPaid = rent.paidAmountPaisa || 0;
  }

  if (totalPaid >= effectiveDue && effectiveDue > 0) rent.status = "paid";
  else if (totalPaid > 0) rent.status = "partially_paid";
  else rent.status = "pending";
}

// ─────────────────────────────────────────────────────────────────────────────
// REMAINING / PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate remaining balance for rent.
 * FIX: returns (gross − TDS) − paid, not gross − paid.
 */
export function calculateRentRemaining(rent) {
  if (rent.useUnitBreakdown && rent.unitBreakdown?.length > 0) {
    return rent.unitBreakdown.reduce(
      (sum, u) => sum + (effectiveRent(u) - (u.paidAmountPaisa || 0)),
      0,
    );
  }
  const effective = (rent.rentAmountPaisa || 0) - (rent.tdsAmountPaisa || 0);
  return effective - (rent.paidAmountPaisa || 0);
}

/** Returns true only when tenant has paid the full effectiveRentPaisa. */
export function isRentFullyPaid(rent) {
  return calculateRentRemaining(rent) <= 0;
}

/**
 * Payment progress as a percentage of effectiveRentPaisa.
 * FIX: denominator is gross − TDS, not gross.
 */
export function getRentPaymentProgress(rent) {
  let effectiveDue, totalPaid;

  if (rent.useUnitBreakdown && rent.unitBreakdown?.length > 0) {
    effectiveDue = rent.unitBreakdown.reduce(
      (sum, u) => sum + effectiveRent(u),
      0,
    );
    totalPaid = rent.unitBreakdown.reduce(
      (sum, u) => sum + (u.paidAmountPaisa || 0),
      0,
    );
  } else {
    effectiveDue = (rent.rentAmountPaisa || 0) - (rent.tdsAmountPaisa || 0);
    totalPaid = rent.paidAmountPaisa || 0;
  }

  if (effectiveDue === 0) return 0;
  return Math.min(100, Math.round((totalPaid / effectiveDue) * 100));
}

/**
 * Per-unit payment details.
 * FIX: remaining and progress now use effectiveRentPaisa per unit.
 */
export function getUnitPaymentDetails(rent) {
  if (!rent.useUnitBreakdown || !rent.unitBreakdown?.length) return null;

  return rent.unitBreakdown.map((unit) => {
    const effective = effectiveRent(unit);
    const paid = unit.paidAmountPaisa || 0;
    const remaining = effective - paid;

    return {
      unitId: unit.unit,
      rentAmountPaisa: unit.rentAmountPaisa || 0,
      tdsAmountPaisa: unit.tdsAmountPaisa || 0,
      effectiveRentPaisa: effective,
      paidAmountPaisa: paid,
      remainingPaisa: remaining,
      progress:
        effective > 0 ? Math.min(100, Math.round((paid / effective) * 100)) : 0,
    };
  });
}
