/**
 * rent.domain.js
 *
 * Pure business logic — no DB calls, no side effects.
 * All monetary values are INTEGER PAISA throughout.
 *
 * Late fee design:
 *   - lateFeePaisa is a SEPARATE receivable from rentAmountPaisa
 *   - paidAmountPaisa tracks rent principal payments only
 *   - latePaidAmountPaisa tracks late fee payments only
 *   - Partial late fee payment is not supported (full or nothing)
 */

/**
 * Apply a flat payment to the RENT PRINCIPAL of a rent document.
 * Does not touch latePaidAmountPaisa.
 */
export function applyPaymentToRent(rent, amountPaisa, paymentDate, receivedBy) {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0) {
    throw new Error(
      `Payment amount must be a positive integer (paisa), got: ${amountPaisa}`,
    );
  }

  rent.paidAmountPaisa += amountPaisa;
  rent.lastPaidDate = paymentDate;
  rent.lastPaidBy = receivedBy;

  const effectiveAmountPaisa =
    rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);

  if (rent.paidAmountPaisa === 0) rent.status = "pending";
  else if (rent.paidAmountPaisa >= effectiveAmountPaisa) rent.status = "paid";
  else rent.status = "partially_paid";
}

/**
 * Add a late fee charge to the rent (used by late-fee cron).
 * Accumulates delta into lateFeePaisa and marks lateFeeApplied.
 * Does not touch latePaidAmountPaisa (that is for tenant payments).
 *
 * @param {Object} rent   - Mongoose rent document (mutated)
 * @param {number} deltaFeePaisa - amount to add (paisa)
 * @param {Date}   chargedAt     - when the charge was applied
 */
export function addLateFeeCharge(rent, deltaFeePaisa, chargedAt) {
  if (!Number.isInteger(deltaFeePaisa) || deltaFeePaisa <= 0) {
    throw new Error(
      `Late fee charge must be a positive integer (paisa), got: ${deltaFeePaisa}`,
    );
  }
  rent.lateFeePaisa = (rent.lateFeePaisa || 0) + deltaFeePaisa;
  rent.lateFeeApplied = true;
  rent.lateFeeDate = chargedAt;
}

/**
 * Apply a payment to the LATE FEE portion only.
 * Full payment only — caller must pass exactly the remaining late fee.
 *
 * @param {Object} rent
 * @param {number} amountPaisa   - must equal rent.remainingLateFeePaisa
 * @param {Date}   paymentDate
 * @param {*}      receivedBy
 */
export function applyLateFeePayment(
  rent,
  amountPaisa,
  paymentDate,
  receivedBy,
) {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0) {
    throw new Error(
      `Late fee payment must be a positive integer (paisa), got: ${amountPaisa}`,
    );
  }

  const remainingLateFee =
    (rent.lateFeePaisa || 0) - (rent.latePaidAmountPaisa || 0);

  if (amountPaisa !== remainingLateFee) {
    throw new Error(
      `Late fee requires full payment. ` +
        `Remaining: ${remainingLateFee} paisa, received: ${amountPaisa} paisa.`,
    );
  }

  rent.latePaidAmountPaisa = (rent.latePaidAmountPaisa || 0) + amountPaisa;
  rent.lastPaidDate = paymentDate;
  rent.lastPaidBy = receivedBy;
  rent.lateFeeStatus = "paid";
}

/**
 * Apply a payment distributed across specific units.
 * Updates both per-unit fields and root-level totals.
 */
export function applyPaymentWithUnitBreakdown(
  rent,
  totalAmountPaisa,
  unitPayments,
  paymentDate,
  receivedBy,
) {
  if (!Number.isInteger(totalAmountPaisa) || totalAmountPaisa <= 0) {
    throw new Error(
      `Total amount must be a positive integer (paisa), got: ${totalAmountPaisa}`,
    );
  }
  if (!rent.useUnitBreakdown || !rent.unitBreakdown?.length) {
    throw new Error("Rent does not use unit breakdown");
  }

  const unitSum = unitPayments.reduce((sum, up) => {
    if (!Number.isInteger(up.amountPaisa)) {
      throw new Error(
        `Unit payment must be integer paisa, got: ${up.amountPaisa}`,
      );
    }
    return sum + up.amountPaisa;
  }, 0);

  if (unitSum !== totalAmountPaisa) {
    throw new Error(
      `Unit payments sum (${unitSum}) does not match total (${totalAmountPaisa}) paisa`,
    );
  }

  rent.paidAmountPaisa += totalAmountPaisa;
  rent.lastPaidDate = paymentDate;
  rent.lastPaidBy = receivedBy;

  unitPayments.forEach(({ unitId, amountPaisa }) => {
    const unitEntry = rent.unitBreakdown.find(
      (ub) => ub.unit.toString() === unitId.toString(),
    );
    if (!unitEntry) throw new Error(`Unit ${unitId} not found in breakdown`);

    unitEntry.paidAmountPaisa += amountPaisa;

    const effectiveUnitPaisa =
      unitEntry.rentAmountPaisa - (unitEntry.tdsAmountPaisa || 0);
    if (unitEntry.paidAmountPaisa === 0) unitEntry.status = "pending";
    else if (unitEntry.paidAmountPaisa >= effectiveUnitPaisa)
      unitEntry.status = "paid";
    else unitEntry.status = "partially_paid";
  });

  const effectiveRentPaisa = rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);
  if (rent.paidAmountPaisa === 0) rent.status = "pending";
  else if (rent.paidAmountPaisa >= effectiveRentPaisa) rent.status = "paid";
  else rent.status = "partially_paid";
}

/**
 * Allocate a total payment between rent principal and late fee.
 *
 * Strategy:
 *   1. Fill remaining rent first (rent is senior to penalty)
 *   2. Any surplus goes to the late fee (if one exists and is outstanding)
 *
 * Caller may provide an explicit split instead by passing
 * { rentPaymentPaisa, lateFeePaymentPaisa } — those are returned unchanged
 * after validation.
 *
 * @param {Object} rent
 * @param {number} totalAmountPaisa
 * @param {Object} [explicitSplit]   - { rentPaymentPaisa, lateFeePaymentPaisa }
 * @returns {{ rentPaymentPaisa: number, lateFeePaymentPaisa: number }}
 */
export function allocatePayment(rent, totalAmountPaisa, explicitSplit = null) {
  const effectiveRentPaisa = rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);
  const remainingRentPaisa = Math.max(
    0,
    effectiveRentPaisa - rent.paidAmountPaisa,
  );
  const remainingLateFeePaisa = Math.max(
    0,
    (rent.lateFeePaisa || 0) - (rent.latePaidAmountPaisa || 0),
  );
  const totalDuePaisa = remainingRentPaisa + remainingLateFeePaisa;

  // ── Manual split ────────────────────────────────────────────────────────
  if (explicitSplit) {
    const { rentPaymentPaisa = 0, lateFeePaymentPaisa = 0 } = explicitSplit;

    if (!Number.isInteger(rentPaymentPaisa) || rentPaymentPaisa < 0) {
      throw new Error(
        `rentPaymentPaisa must be a non-negative integer, got: ${rentPaymentPaisa}`,
      );
    }
    if (!Number.isInteger(lateFeePaymentPaisa) || lateFeePaymentPaisa < 0) {
      throw new Error(
        `lateFeePaymentPaisa must be a non-negative integer, got: ${lateFeePaymentPaisa}`,
      );
    }
    if (rentPaymentPaisa + lateFeePaymentPaisa !== totalAmountPaisa) {
      throw new Error(
        `Explicit split (${rentPaymentPaisa} + ${lateFeePaymentPaisa}) ` +
          `does not equal total (${totalAmountPaisa}) paisa`,
      );
    }
    if (rentPaymentPaisa > remainingRentPaisa) {
      throw new Error(
        `rentPaymentPaisa (${rentPaymentPaisa}) exceeds remaining rent (${remainingRentPaisa}) paisa`,
      );
    }
    if (
      lateFeePaymentPaisa > 0 &&
      lateFeePaymentPaisa !== remainingLateFeePaisa
    ) {
      throw new Error(
        `Late fee requires full payment. ` +
          `Remaining: ${remainingLateFeePaisa} paisa, provided: ${lateFeePaymentPaisa} paisa`,
      );
    }
    return { rentPaymentPaisa, lateFeePaymentPaisa };
  }

  // ── Auto-allocate: rent first, surplus to late fee ──────────────────────
  if (totalAmountPaisa > totalDuePaisa) {
    throw new Error(
      `Payment (${totalAmountPaisa} paisa) exceeds total due ` +
        `(${totalDuePaisa} paisa = ${remainingRentPaisa} rent + ${remainingLateFeePaisa} late fee)`,
    );
  }

  const rentPaymentPaisa = Math.min(totalAmountPaisa, remainingRentPaisa);
  const surplus = totalAmountPaisa - rentPaymentPaisa;

  // Surplus must exactly match the remaining late fee (full-or-nothing rule)
  let lateFeePaymentPaisa = 0;
  if (surplus > 0) {
    if (surplus !== remainingLateFeePaisa) {
      throw new Error(
        `Late fee requires full payment. ` +
          `Remaining late fee: ${remainingLateFeePaisa} paisa, surplus: ${surplus} paisa. ` +
          `Total must be either ${remainingRentPaisa} (rent only) or ` +
          `${totalDuePaisa} (rent + full late fee).`,
      );
    }
    lateFeePaymentPaisa = surplus;
  }

  return { rentPaymentPaisa, lateFeePaymentPaisa };
}

/**
 * Validate a proposed RENT PRINCIPAL payment before applying it.
 * Does not validate late fee payments (those go through allocatePayment).
 */
export function validateRentPayment(rent, paymentAmountPaisa) {
  if (!Number.isInteger(paymentAmountPaisa)) {
    return { valid: false, error: "Payment amount must be an integer (paisa)" };
  }
  if (paymentAmountPaisa <= 0) {
    return { valid: false, error: "Payment amount must be positive" };
  }

  const effectiveRentPaisa = rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);
  const remainingPaisa = effectiveRentPaisa - rent.paidAmountPaisa;

  if (paymentAmountPaisa > remainingPaisa) {
    return {
      valid: false,
      error: `Payment (${paymentAmountPaisa / 100} Rs) exceeds remaining rent balance (${remainingPaisa / 100} Rs)`,
      remainingPaisa,
    };
  }

  return {
    valid: true,
    remainingAfterPaymentPaisa: remainingPaisa - paymentAmountPaisa,
    willBePaid: paymentAmountPaisa === remainingPaisa,
  };
}

/**
 * Validate a total payment covering rent + optional late fee.
 * Use this instead of validateRentPayment when the caller sends a combined amount.
 */
export function validateCombinedPayment(
  rent,
  totalAmountPaisa,
  explicitSplit = null,
) {
  if (!Number.isInteger(totalAmountPaisa) || totalAmountPaisa <= 0) {
    return {
      valid: false,
      error: "Payment amount must be a positive integer (paisa)",
    };
  }

  try {
    const split = allocatePayment(rent, totalAmountPaisa, explicitSplit);
    return { valid: true, split };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Calculate the current late fee for a compounding policy.
 * Called by lateFee.cron.js on each daily run when compounding=true.
 *
 * @param {number} overdueAmountPaisa
 * @param {number} effectiveDaysLate   — days past due after grace period
 * @param {number} dailyRatePercent    — e.g. 0.1 for 0.1% per day
 * @returns {number} paisa (integer)
 */
export function calculateCompoundLateFee(
  overdueAmountPaisa,
  effectiveDaysLate,
  dailyRatePercent,
) {
  if (effectiveDaysLate <= 0 || overdueAmountPaisa <= 0) return 0;
  const r = dailyRatePercent / 100;
  return Math.max(
    0,
    Math.round(overdueAmountPaisa * (Math.pow(1 + r, effectiveDaysLate) - 1)),
  );
}

/**
 * Full payment breakdown for reporting/receipts.
 */
export function getRentPaymentBreakdown(rent) {
  const effectiveRentPaisa = rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);
  const remainingRentPaisa = effectiveRentPaisa - rent.paidAmountPaisa;
  const lateFeePaisa = rent.lateFeePaisa || 0;
  const latePaidAmountPaisa = rent.latePaidAmountPaisa || 0;
  const remainingLateFeePaisa = Math.max(0, lateFeePaisa - latePaidAmountPaisa);
  const totalDuePaisa = Math.max(0, remainingRentPaisa) + remainingLateFeePaisa;

  return {
    paisa: {
      gross: rent.rentAmountPaisa,
      tds: rent.tdsAmountPaisa,
      effectiveRent: effectiveRentPaisa,
      paid: rent.paidAmountPaisa,
      remainingRent: remainingRentPaisa,
      lateFee: lateFeePaisa,
      latePaid: latePaidAmountPaisa,
      remainingLateFee: remainingLateFeePaisa,
      totalDue: totalDuePaisa,
    },
    rupees: {
      gross: rent.rentAmountPaisa / 100,
      tds: rent.tdsAmountPaisa / 100,
      effectiveRent: effectiveRentPaisa / 100,
      paid: rent.paidAmountPaisa / 100,
      remainingRent: remainingRentPaisa / 100,
      lateFee: lateFeePaisa / 100,
      latePaid: latePaidAmountPaisa / 100,
      remainingLateFee: remainingLateFeePaisa / 100,
      totalDue: totalDuePaisa / 100,
    },
    status: rent.status,
    lateFeeStatus: rent.lateFeeStatus,
    paymentPercentage:
      effectiveRentPaisa > 0
        ? (rent.paidAmountPaisa / effectiveRentPaisa) * 100
        : 0,
  };
}

export default {
  applyPaymentToRent,
  addLateFeeCharge,
  applyLateFeePayment,
  applyPaymentWithUnitBreakdown,
  allocatePayment,
  validateRentPayment,
  validateCombinedPayment,
  calculateCompoundLateFee,
  getRentPaymentBreakdown,
};
