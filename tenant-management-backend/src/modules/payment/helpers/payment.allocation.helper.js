/**
 * payment.allocation.helper.js
 *
 * All allocation strategies for distributing payments across units.
 * Industry patterns: proportional (QuickBooks), FIFO (lease accounting), manual.
 */

import { rupeesToPaisa } from "../../../utils/moneyUtil.js";

/**
 * Allocate payment proportionally across units based on remaining amounts.
 * Industry Use: QuickBooks, Stripe Invoicing
 */
export function allocatePaymentProportionally(
  unitBreakdown,
  totalPaymentPaisa,
) {
  const totalRemainingPaisa = unitBreakdown.reduce((sum, unit) => {
    const remaining = (unit.rentAmountPaisa || 0) - (unit.paidAmountPaisa || 0);
    return sum + Math.max(0, remaining);
  }, 0);

  if (totalRemainingPaisa === 0) {
    throw new Error("No remaining balance to allocate payment");
  }

  let remainingToAllocate = totalPaymentPaisa;
  const allocations = [];
  // Only include units with a remaining balance
  const unpaidUnits = unitBreakdown.filter(
    (u) => (u.rentAmountPaisa || 0) - (u.paidAmountPaisa || 0) > 0,
  );

  unpaidUnits.forEach((unit, index) => {
    const unitRemaining =
      (unit.rentAmountPaisa || 0) - (unit.paidAmountPaisa || 0);

    let allocation;
    if (index === unpaidUnits.length - 1) {
      // Last unpaid unit absorbs any rounding dust
      allocation = remainingToAllocate;
    } else {
      allocation = Math.round(
        (unitRemaining / totalRemainingPaisa) * totalPaymentPaisa,
      );
      allocation = Math.min(allocation, unitRemaining);
    }

    if (allocation > 0) {
      allocations.push({ unitId: unit.unit, amountPaisa: allocation });
      remainingToAllocate -= allocation;
    }
  });

  return allocations;
}

/**
 * Allocate payment FIFO — oldest units paid first.
 * Industry Use: Property management software, lease accounting
 */
export function allocatePaymentFIFO(unitBreakdown, totalPaymentPaisa) {
  let remainingPayment = totalPaymentPaisa;
  const allocations = [];

  // Original array order is assumed to be insertion order (oldest first).
  // Add `.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))`
  // if your schema includes a per-unit createdAt.
  for (const unit of unitBreakdown) {
    if (remainingPayment <= 0) break;

    const unitRemaining =
      (unit.rentAmountPaisa || 0) - (unit.paidAmountPaisa || 0);
    if (unitRemaining <= 0) continue;

    const allocateToUnit = Math.min(remainingPayment, unitRemaining);
    allocations.push({ unitId: unit.unit, amountPaisa: allocateToUnit });
    remainingPayment -= allocateToUnit;
  }

  return allocations;
}

/**
 * Pass through manually-specified allocations, normalising amount → amountPaisa.
 * Industry Use: All payment systems for special arrangements
 *
 * FIX: was Math.round(amount * 100) — replaced with rupeesToPaisa() for
 * Banker's Rounding consistency across the codebase.
 */
export function allocatePaymentManually(manualAllocations) {
  return manualAllocations.map((allocation) => ({
    unitId: allocation.unitId,
    amountPaisa:
      allocation.amountPaisa !== undefined
        ? allocation.amountPaisa
        : rupeesToPaisa(allocation.amount || 0), // FIX: was Math.round(amount * 100)
  }));
}

/**
 * Calculate unit payment summary.
 */
export function calculateUnitPaymentSummary(unitBreakdown) {
  const summary = unitBreakdown.reduce(
    (acc, unit) => {
      acc.totalDuePaisa += unit.rentAmountPaisa || 0;
      acc.totalPaidPaisa += unit.paidAmountPaisa || 0;
      acc.totalTdsPaisa += unit.tdsAmountPaisa || 0;
      return acc;
    },
    { totalDuePaisa: 0, totalPaidPaisa: 0, totalTdsPaisa: 0 },
  );

  summary.totalRemainingPaisa = summary.totalDuePaisa - summary.totalPaidPaisa;
  return summary;
}

/**
 * Return the allocation function for a given strategy name.
 */
export function getAllocationStrategy(strategyType = "proportional") {
  const strategies = {
    proportional: allocatePaymentProportionally,
    fifo: allocatePaymentFIFO,
    manual: allocatePaymentManually,
  };
  return strategies[strategyType] || strategies.proportional;
}
