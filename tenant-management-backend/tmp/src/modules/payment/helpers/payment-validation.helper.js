/**
 * Payment Validation Helpers
 *
 * Industry Standard: Validator Pattern
 * Fail-fast validation before any mutations
 */

import mongoose from "mongoose";
import { formatMoneySafe, rupeesToPaisa } from "../../../utils/moneyUtil.js";

/**
 * Validate unit allocations match rent structure
 */
export function validateUnitAllocations(
  unitBreakdown,
  unitAllocations,
  totalPaymentPaisa,
) {
  const allocatedTotal = unitAllocations.reduce(
    (sum, a) => sum + a.amountPaisa,
    0,
  );

  if (allocatedTotal !== totalPaymentPaisa) {
    throw new Error(
      `Unit allocations (${formatMoneySafe(allocatedTotal)}) don't match total payment (${formatMoneySafe(totalPaymentPaisa)})`,
    );
  }

  unitAllocations.forEach(({ unitId, amountPaisa }) => {
    const unitIdStr = unitId.toString();
    const unit = unitBreakdown.find((u) => {
      const uUnit = u.unit;
      if (!uUnit) return false;
      const actualId = uUnit._id ? uUnit._id.toString() : uUnit.toString();
      return actualId === unitIdStr;
    });

    if (!unit) throw new Error(`Unit ${unitId} not found in rent breakdown`);

    // rentAmountPaisa on unitBreakdown is already net of TDS — do NOT subtract
    // tdsAmountPaisa again here or it double-counts the deduction.
    const remaining = (unit.rentAmountPaisa || 0) - (unit.paidAmountPaisa || 0);
    if (amountPaisa > remaining) {
      throw new Error(
        `Payment ${formatMoneySafe(amountPaisa)} exceeds remaining ${formatMoneySafe(remaining)} for unit ${unitId}`,
      );
    }
    if (amountPaisa <= 0) {
      throw new Error(
        `Unit allocation amount must be positive, got ${amountPaisa}`,
      );
    }
  });
}

/**
 * Validate payment allocations structure (rent + CAM + optional late fee).
 *
 * FIX: late fee validation added.
 * FIX: a late-fee-only payload is rejected (late fee requires a rent anchor).
 * Late fee is always subordinate to a rent allocation — it cannot stand alone.
 *
 * @param {Object} allocations
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validatePaymentAllocations(allocations) {
  // At least rent or CAM must be present — late fee alone is not valid
  // because it must be anchored to a rent document
  if (!allocations || (!allocations.rent && !allocations.cam)) {
    return {
      isValid: false,
      error: "At least one allocation (rent or CAM) is required",
    };
  }

  // ── Rent allocation ──────────────────────────────────────────────────────
  if (allocations.rent) {
    if (!allocations.rent.rentId) {
      return {
        isValid: false,
        error: "Rent ID is required when rent allocation is provided",
      };
    }
    if (!mongoose.Types.ObjectId.isValid(allocations.rent.rentId)) {
      return { isValid: false, error: "Invalid rent ID format" };
    }

    const rentAmountPaisa =
      allocations.rent.amountPaisa !== undefined
        ? allocations.rent.amountPaisa
        : allocations.rent.amount
          ? rupeesToPaisa(allocations.rent.amount) // FIX: was Math.round(amount * 100)
          : 0;

    if (!rentAmountPaisa || rentAmountPaisa <= 0) {
      return { isValid: false, error: "Rent amount must be greater than 0" };
    }

    if (allocations.rent.unitAllocations?.length > 0) {
      const unitTotal = allocations.rent.unitAllocations.reduce(
        (sum, ua) => sum + (ua.amountPaisa || 0),
        0,
      );
      if (unitTotal !== rentAmountPaisa) {
        return {
          isValid: false,
          error: `Unit allocations total (${formatMoneySafe(unitTotal)}) doesn't match rent amount (${formatMoneySafe(rentAmountPaisa)})`,
        };
      }
    }
  }

  // ── CAM allocation ───────────────────────────────────────────────────────
  if (allocations.cam) {
    if (!allocations.cam.camId) {
      return {
        isValid: false,
        error: "CAM ID is required when CAM allocation is provided",
      };
    }
    if (!mongoose.Types.ObjectId.isValid(allocations.cam.camId)) {
      return { isValid: false, error: "Invalid CAM ID format" };
    }

    const camAmountPaisa =
      allocations.cam.paidAmountPaisa !== undefined
        ? allocations.cam.paidAmountPaisa
        : allocations.cam.paidAmount
          ? rupeesToPaisa(allocations.cam.paidAmount) // FIX: was Math.round(amount * 100)
          : 0;

    if (!camAmountPaisa || camAmountPaisa <= 0) {
      return { isValid: false, error: "CAM paidAmount must be greater than 0" };
    }
  }

  // ── Late fee allocation (optional, must be anchored to rent) ────────────
  // FIX: late fee validation was entirely absent
  if (allocations.lateFee) {
    if (!allocations.lateFee.rentId) {
      return {
        isValid: false,
        error:
          "Rent ID is required in lateFee allocation (late fee must be anchored to a rent)",
      };
    }
    if (!mongoose.Types.ObjectId.isValid(allocations.lateFee.rentId)) {
      return {
        isValid: false,
        error: "Invalid rent ID format in lateFee allocation",
      };
    }
    if (!allocations.rent) {
      return {
        isValid: false,
        error:
          "Late fee allocation requires a rent allocation in the same payment",
      };
    }
    if (
      allocations.lateFee.rentId.toString() !==
      allocations.rent.rentId.toString()
    ) {
      return {
        isValid: false,
        error: "lateFee.rentId must match rent.rentId",
      };
    }

    const lateFeePaisa =
      allocations.lateFee.amountPaisa !== undefined
        ? allocations.lateFee.amountPaisa
        : allocations.lateFee.amount
          ? rupeesToPaisa(allocations.lateFee.amount)
          : 0;

    if (lateFeePaisa <= 0) {
      return {
        isValid: false,
        error:
          "Late fee amount must be greater than 0 when lateFee allocation is provided",
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate payment doesn't exceed rent balance
 */
export function validatePaymentNotExceeding(
  rent,
  paymentPaisa,
  unitAllocations = null,
) {
  if (rent.useUnitBreakdown && rent.unitBreakdown?.length > 0) {
    if (unitAllocations && unitAllocations.length > 0) {
      validateUnitAllocations(
        rent.unitBreakdown,
        unitAllocations,
        paymentPaisa,
      );
    } else {
      const totalRemaining = rent.unitBreakdown.reduce((sum, unit) => {
        return (
          sum +
          ((unit.rentAmountPaisa || 0) - (unit.paidAmountPaisa || 0)) +
          (unit.lateFeePaisa || 0)
        );
      }, 0);
      if (paymentPaisa > totalRemaining) {
        throw new Error(
          `Payment ${formatMoneySafe(paymentPaisa)} exceeds remaining balance ${formatMoneySafe(totalRemaining)}`,
        );
      }
    }
  } else {
    const remaining =
      (rent.rentAmountPaisa || 0) -
      (rent.paidAmountPaisa || 0) +
      (rent.lateFeePaisa || 0);
    if (paymentPaisa > remaining) {
      throw new Error(
        `Payment ${formatMoneySafe(paymentPaisa)} exceeds remaining balance ${formatMoneySafe(remaining)}`,
      );
    }
  }
}

/**
 * Validate CAM payment doesn't exceed remaining balance
 */
export function validateCamPaymentNotExceeding(cam, paymentPaisa) {
  const amountPaisa = cam.amountPaisa ?? 0;
  const paidAmountPaisa = cam.paidAmountPaisa ?? 0;
  const remainingPaisa = amountPaisa - paidAmountPaisa;

  if (paymentPaisa > remainingPaisa) {
    throw new Error(
      `CAM payment ${formatMoneySafe(paymentPaisa)} exceeds remaining balance ${formatMoneySafe(remainingPaisa)} (CAM total: ${formatMoneySafe(amountPaisa)}, already paid: ${formatMoneySafe(paidAmountPaisa)})`,
    );
  }
}

/**
 * Validate all paisa values are integers
 */
export function validatePaisaIntegrity(data, fields) {
  fields.forEach((field) => {
    const value = data[field];
    if (value !== undefined && value !== null && !Number.isInteger(value)) {
      throw new Error(`${field} must be an integer (paisa), got: ${value}`);
    }
  });
}
