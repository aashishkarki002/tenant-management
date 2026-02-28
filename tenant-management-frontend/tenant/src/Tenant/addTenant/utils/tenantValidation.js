/**
 * tenantValidation.js
 *
 * FIX — validatePaymentMethod was checking:
 *   values.paymentMethod === PAYMENT_METHODS.BANK_GUARANTEE
 *
 * That is always false because BANK_GUARANTEE is only valid for the SECURITY
 * DEPOSIT payment (sdPaymentMethod), not the rent payment method.
 * This caused the bank-guarantee photo upload to never be validated.
 *
 * Corrected:
 *   - Rent payment method (paymentMethod): cash | bank_transfer | cheque | mobile_wallet
 *   - SD payment method  (sdPaymentMethod): cash | bank_transfer | cheque | bank_guarantee
 */

import {
  PAYMENT_METHODS,
  SECURITY_DEPOSIT_MODES,
} from "../constants/tenant.constant";

export const validateLeaseDetails = (values) => {
  const errors = [];

  if (values.leaseStartDate && values.leaseEndDate) {
    if (new Date(values.leaseEndDate) < new Date(values.leaseStartDate)) {
      errors.push("Lease end date must be after lease start date");
    }
  }

  return errors;
};

export const validatePaymentMethod = (values) => {
  const errors = [];

  // ── Rent payment method ────────────────────────────────────────────────────
  // BANK_GUARANTEE is never valid here — it only applies to security deposits.
  if (values.paymentMethod === "bank_guarantee") {
    errors.push(
      "Bank guarantee is not a valid rent payment method. Use it only for the security deposit.",
    );
  }

  if (values.paymentMethod === PAYMENT_METHODS.CHEQUE) {
    if (!values.chequeAmount || !values.chequeNumber) {
      errors.push(
        "Please provide cheque amount and cheque number for rent payment",
      );
    }
  }

  // ── Security deposit payment method ───────────────────────────────────────
  // FIX: was using values.paymentMethod === PAYMENT_METHODS.BANK_GUARANTEE
  //      which is always false because BANK_GUARANTEE is only for sdPaymentMethod.
  if (
    values.sdPaymentMethod === SECURITY_DEPOSIT_MODES.BANK_GUARANTEE &&
    !values.bankGuaranteePhoto
  ) {
    errors.push(
      "Please upload the bank guarantee document for the security deposit",
    );
  }

  return errors;
};

export const validateUnits = (values) => {
  const errors = [];

  if (
    !values.unitNumber ||
    !Array.isArray(values.unitNumber) ||
    values.unitNumber.length === 0
  ) {
    errors.push("Please select at least one unit");
    return errors;
  }

  // SD via bank guarantee = document only, no cash amount required
  const isBankGuarantee =
    values.sdPaymentMethod === SECURITY_DEPOSIT_MODES.BANK_GUARANTEE;

  const missingFinancials = values.unitNumber.filter((unitId) => {
    const unitFinancial = values.unitFinancials?.[unitId];
    return (
      !unitFinancial ||
      !unitFinancial.sqft ||
      !unitFinancial.pricePerSqft ||
      !unitFinancial.camPerSqft ||
      (!isBankGuarantee && !unitFinancial.securityDeposit)
    );
  });

  if (missingFinancials.length > 0) {
    errors.push("Please fill in all financial details for all selected units");
  }

  return errors;
};

export const validateTenantForm = (values) => {
  const errors = [
    ...validateLeaseDetails(values),
    ...validatePaymentMethod(values),
    ...validateUnits(values),
  ];

  if (values.unitNumber?.length > 0) {
    // SD via bank guarantee = no cash security deposit amount required per unit
    const isBankGuarantee =
      values.sdPaymentMethod === SECURITY_DEPOSIT_MODES.BANK_GUARANTEE;

    values.unitNumber.forEach((unitId, index) => {
      const financial = values.unitFinancials?.[unitId];

      if (!financial) {
        errors.push(`Financial details missing for unit ${index + 1}`);
        return;
      }

      if (!financial.sqft || parseFloat(financial.sqft) <= 0) {
        errors.push(`Invalid square footage for unit ${index + 1}`);
      }

      if (!financial.pricePerSqft || parseFloat(financial.pricePerSqft) < 0) {
        errors.push(`Invalid price per sqft for unit ${index + 1}`);
      }

      if (!financial.camPerSqft || parseFloat(financial.camPerSqft) < 0) {
        errors.push(`Invalid CAM rate for unit ${index + 1}`);
      }

      // Security deposit validation — skipped when deposit is covered by bank guarantee
      if (!isBankGuarantee) {
        if (
          !financial.securityDeposit ||
          parseFloat(financial.securityDeposit) < 0
        ) {
          errors.push(`Invalid security deposit for unit ${index + 1}`);
        }
      }
    });
  }

  return errors;
};
