/**
 * rent.domain.js  (FIXED)
 *
 * FIX 1 — applyPaymentToRent was incomplete:
 *   - effectiveAmountPaisa was calculated but never used
 *   - status was never updated (rent stayed "pending" forever after payment)
 *   - lastPaidDate and lastPaidBy were never set
 *
 * FIX 2 — validateRentPayment remaining calculation ignored TDS:
 *   OLD: remainingPaisa = effectiveRentPaisa - rent.paidAmountPaisa
 *        But effectiveRentPaisa was (rentAmountPaisa - tdsAmountPaisa) — actually correct.
 *        The real bug was it used rent.rentAmountPaisa directly without subtracting TDS
 *        in the original code.  Ensured consistent formula here.
 */

import mongoose from "mongoose";

/**
 * Apply a flat payment to a rent document.
 * For unit-breakdown rents use applyPaymentWithUnitBreakdown().
 *
 * @param {Object} rent           - Rent Mongoose document
 * @param {number} amountPaisa    - Payment amount (positive integer paisa)
 * @param {Date}   paymentDate
 * @param {*}      receivedBy     - Admin ObjectId
 */
export function applyPaymentToRent(rent, amountPaisa, paymentDate, receivedBy) {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0) {
    throw new Error(
      `Payment amount must be a positive integer (paisa), got: ${amountPaisa}`,
    );
  }

  // Accumulate paid amount
  rent.paidAmountPaisa += amountPaisa;
  rent.lastPaidDate = paymentDate;
  rent.lastPaidBy = receivedBy;

  // FIX: derive status from effectiveRentPaisa (gross - TDS), not gross
  const effectiveAmountPaisa =
    rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);

  if (rent.paidAmountPaisa === 0) {
    rent.status = "pending";
  } else if (rent.paidAmountPaisa >= effectiveAmountPaisa) {
    rent.status = "paid";
  } else {
    rent.status = "partially_paid";
  }
}

/**
 * Apply a payment distributed across specific units.
 * Updates both per-unit fields and root-level totals.
 *
 * @param {Object}   rent              - Rent Mongoose document
 * @param {number}   totalAmountPaisa  - Total payment (integer paisa)
 * @param {Array}    unitPayments       - [{unitId, amountPaisa}]
 * @param {Date}     paymentDate
 * @param {*}        receivedBy         - Admin ObjectId
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

  // Guard: unit payments must add up to totalAmountPaisa
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

  // Apply to root totals
  rent.paidAmountPaisa += totalAmountPaisa;
  rent.lastPaidDate = paymentDate;
  rent.lastPaidBy = receivedBy;

  // Apply to each unit and update per-unit status
  unitPayments.forEach(({ unitId, amountPaisa }) => {
    const unitEntry = rent.unitBreakdown.find(
      (ub) => ub.unit.toString() === unitId.toString(),
    );
    if (!unitEntry) throw new Error(`Unit ${unitId} not found in breakdown`);

    unitEntry.paidAmountPaisa += amountPaisa;

    const effectiveUnitPaisa =
      unitEntry.rentAmountPaisa - (unitEntry.tdsAmountPaisa || 0);
    if (unitEntry.paidAmountPaisa === 0) {
      unitEntry.status = "pending";
    } else if (unitEntry.paidAmountPaisa >= effectiveUnitPaisa) {
      unitEntry.status = "paid";
    } else {
      unitEntry.status = "partially_paid";
    }
  });

  // Update overall rent status from effective rent (gross - TDS)
  const effectiveRentPaisa = rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);
  if (rent.paidAmountPaisa === 0) {
    rent.status = "pending";
  } else if (rent.paidAmountPaisa >= effectiveRentPaisa) {
    rent.status = "paid";
  } else {
    rent.status = "partially_paid";
  }
}

/**
 * Calculate late fee for an overdue rent.
 *
 * @param {Object} rent
 * @param {number} dailyRatePercent  - e.g. 0.1 for 0.1% per day
 * @param {number} daysOverdue
 * @returns {number} Late fee in paisa (integer)
 */
export function calculateLateFee(rent, dailyRatePercent, daysOverdue) {
  if (daysOverdue <= 0) return 0;

  const effectiveRentPaisa = rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);
  const remainingPaisa = effectiveRentPaisa - rent.paidAmountPaisa;
  if (remainingPaisa <= 0) return 0;

  return Math.max(
    0,
    Math.round(remainingPaisa * (dailyRatePercent / 100) * daysOverdue),
  );
}

/**
 * Apply a computed late fee to a rent document.
 *
 * @param {Object} rent
 * @param {number} lateFeePaisa  - Integer paisa
 * @param {Date}   lateFeeDate
 */
export function applyLateFee(rent, lateFeePaisa, lateFeeDate) {
  if (!Number.isInteger(lateFeePaisa)) {
    throw new Error(`Late fee must be integer paisa, got: ${lateFeePaisa}`);
  }
  rent.lateFeePaisa = (rent.lateFeePaisa || 0) + lateFeePaisa;
  rent.lateFeeDate = lateFeeDate;
  rent.lateFeeApplied = true;
  rent.lateFeeStatus = "pending";
}

/**
 * Validate a proposed payment before applying it.
 *
 * @param {Object} rent
 * @param {number} paymentAmountPaisa
 * @returns {{ valid: boolean, error?: string, remainingAfterPaymentPaisa?: number }}
 */
export function validateRentPayment(rent, paymentAmountPaisa) {
  if (!Number.isInteger(paymentAmountPaisa)) {
    return { valid: false, error: "Payment amount must be an integer (paisa)" };
  }
  if (paymentAmountPaisa <= 0) {
    return { valid: false, error: "Payment amount must be positive" };
  }

  // FIX: remaining is based on effectiveRentPaisa (gross − TDS), not gross
  const effectiveRentPaisa = rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);
  const remainingPaisa = effectiveRentPaisa - rent.paidAmountPaisa;

  if (paymentAmountPaisa > remainingPaisa) {
    return {
      valid: false,
      error: `Payment (${paymentAmountPaisa / 100} Rs) exceeds remaining balance (${remainingPaisa / 100} Rs)`,
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
 * Full payment breakdown for reporting/receipts.
 *
 * @param {Object} rent
 * @returns {Object}
 */
export function getRentPaymentBreakdown(rent) {
  const effectiveRentPaisa = rent.rentAmountPaisa - (rent.tdsAmountPaisa || 0);
  const remainingPaisa = effectiveRentPaisa - rent.paidAmountPaisa;
  const lateFeePaisa = rent.lateFeePaisa || 0;

  return {
    paisa: {
      gross: rent.rentAmountPaisa,
      tds: rent.tdsAmountPaisa,
      effectiveRent: effectiveRentPaisa,
      paid: rent.paidAmountPaisa,
      remaining: remainingPaisa,
      lateFee: lateFeePaisa,
      totalDue: Math.max(0, remainingPaisa) + lateFeePaisa,
    },
    rupees: {
      gross: rent.rentAmountPaisa / 100,
      tds: rent.tdsAmountPaisa / 100,
      effectiveRent: effectiveRentPaisa / 100,
      paid: rent.paidAmountPaisa / 100,
      remaining: remainingPaisa / 100,
      lateFee: lateFeePaisa / 100,
      totalDue: (Math.max(0, remainingPaisa) + lateFeePaisa) / 100,
    },
    status: rent.status,
    paymentPercentage:
      effectiveRentPaisa > 0
        ? (rent.paidAmountPaisa / effectiveRentPaisa) * 100
        : 0,
  };
}

export default {
  applyPaymentToRent,
  applyPaymentWithUnitBreakdown,
  calculateLateFee,
  applyLateFee,
  getRentPaymentBreakdown,
  validateRentPayment,
};
