/**
 * formDataBuilder.js
 *
 * FIX 1 - securityDepositMode -> securityDepositPaymentMethod
 *   Backend expects:
 *     securityDepositPaymentMethod  ("cash"|"bank_transfer"|"cheque")
 *     securityDepositBankAccountId   (when method is bank_transfer or cheque)
 *     securityDepositBankAccountCode (when method is bank_transfer or cheque)
 *
 * FIX 2 - BANK_GUARANTEE is a document mechanism, not a ledger payment method.
 *   When sdPaymentMethod === "bank_guarantee":
 *     - Upload file under "bank_guarantee" field (already done)
 *     - Do NOT send securityDepositPaymentMethod (no cash/bank journal posted)
 *   When sdPaymentMethod is cash/bank_transfer/cheque:
 *     - Send securityDepositPaymentMethod -> backend posts the journal entry
 *
 * FIX 3 - weighted rates replace the broken avg-of-rates calculation.
 *
 * FIX 4 - Nepali (BS) date fields are now included in FormData.
 *   The backend needs these to correctly compute:
 *     - Rent escalation schedules (nextEscalationNepaliDate)
 *     - Quarterly rent windows (nepaliYear, nepaliMonth, quarter)
 *     - Any other BS-calendar-aware calculations
 *   Without them, the backend was silently re-deriving Nepali dates from the
 *   AD date via its own converter — which can be off by a day at BS month
 *   boundaries and ignores any manual BS-calendar corrections made in the UI.
 *
 *   Naming convention used by the backend:
 *     leaseStartDateNepali, leaseEndDateNepali, dateOfAgreementSignedNepali,
 *     keyHandoverDateNepali, spaceHandoverDateNepali, spaceReturnedDateNepali
 */

import { calculateFinancialTotals } from "./financialCalculation";
import { SECURITY_DEPOSIT_MODES } from "../constants/tenant.constant";

/**
 * Build FormData for tenant creation.
 * @param {Object} values      Formik values
 * @param {string} propertyId
 * @returns {FormData}
 */
export const buildTenantFormData = (values, propertyId) => {
  const formData = new FormData();

  const tdsPercentage = parseFloat(values.tdsPercentage) || 10;
  const totals = calculateFinancialTotals(values.unitFinancials, tdsPercentage);

  // Location
  formData.append("property", propertyId);
  formData.append("block", values.block);
  formData.append("innerBlock", values.innerBlock);

  // Unit lease breakdown (sent as JSON string - FormData can't nest arrays)
  if (values.unitFinancials && Object.keys(values.unitFinancials).length > 0) {
    const unitLeases = values.unitNumber.map((unitId) => {
      const f = values.unitFinancials[unitId] ?? {};
      return {
        unitId,
        leasedSquareFeet: parseFloat(f.sqft) || 0,
        pricePerSqft: parseFloat(f.pricePerSqft) || 0,
        camRatePerSqft: parseFloat(f.camPerSqft) || 0,
        securityDeposit: parseFloat(f.securityDeposit) || 0,
      };
    });
    formData.append("unitLeases", JSON.stringify(unitLeases));
  }

  // Scalar tenant fields — AD (English) dates
  const tenantFields = [
    "name",
    "phone",
    "email",
    "address",
    "status",
    "leaseStartDate",
    "leaseEndDate",
    "dateOfAgreementSigned",
    "keyHandoverDate",
    "spaceHandoverDate",
    "spaceReturnedDate",
    "tdsPercentage",
    "rentPaymentFrequency",
    // NOTE: paymentMethod is ONLY the rent payment method (no bank_guarantee)
    "paymentMethod",
  ];
  tenantFields.forEach((field) => {
    if (values[field] != null && values[field] !== "") {
      formData.append(field, values[field]);
    }
  });

  // FIX 4 — Nepali (BS) date counterparts.
  // These are paired with their AD equivalents above so the backend never has
  // to re-derive them and can trust the user's explicit BS calendar selection.
  const nepaliDateFields = [
    "leaseStartDateNepali",
    "leaseEndDateNepali",
    "dateOfAgreementSignedNepali",
    "keyHandoverDateNepali",
    "spaceHandoverDateNepali",
    "spaceReturnedDateNepali",
  ];
  nepaliDateFields.forEach((field) => {
    if (values[field] != null && values[field] !== "") {
      formData.append(field, values[field]);
    }
  });

  // Aggregated financials (backward-compat fields - backend also reads unitLeases)
  formData.append("leasedSquareFeet", totals.totalSqft.toString());
  formData.append("pricePerSqft", totals.weightedPricePerSqft.toString());
  formData.append("camRatePerSqft", totals.weightedCamPerSqft.toString());
  formData.append("securityDeposit", totals.totalSecurityDeposit.toString());

  // Security deposit payment — only post a journal entry when money actually
  // changes hands. BANK_GUARANTEE is document-only; the backend must NOT post
  // a cash/bank journal entry for it.
  const sdMode = values.sdPaymentMethod;
  if (
    totals.totalSecurityDeposit > 0 &&
    sdMode &&
    sdMode !== SECURITY_DEPOSIT_MODES.BANK_GUARANTEE
  ) {
    formData.append("securityDepositPaymentMethod", sdMode);
    formData.append(
      "securityDepositAmount",
      totals.totalSecurityDeposit.toString(),
    );

    // Bank account fields — required when method is bank_transfer or cheque
    if (
      sdMode === SECURITY_DEPOSIT_MODES.BANK_TRANSFER ||
      sdMode === SECURITY_DEPOSIT_MODES.CHEQUE
    ) {
      if (values.sdBankAccountId) {
        formData.append("securityDepositBankAccountId", values.sdBankAccountId);
      }
      if (values.sdBankAccountCode) {
        formData.append(
          "securityDepositBankAccountCode",
          values.sdBankAccountCode,
        );
      }
    }
  }

  // Bank guarantee photo (document only — no ledger entry)
  if (
    sdMode === SECURITY_DEPOSIT_MODES.BANK_GUARANTEE &&
    values.bankGuaranteePhoto
  ) {
    formData.append("bank_guarantee", values.bankGuaranteePhoto);
  }

  // Cheque details for rent payment method
  if (values.paymentMethod === "cheque") {
    if (values.chequeAmount)
      formData.append("chequeAmount", values.chequeAmount);
    if (values.chequeNumber)
      formData.append("chequeNumber", values.chequeNumber);
  }

  // Documents — mapped to backend upload.fields() names
  const DOCUMENT_FIELD_MAP = {
    photo: "image",
    tenantPhoto: "image",
    leaseAgreement: "pdfAgreement",
    citizenship: "citizenShip",
    bankGuarantee: "bank_guarantee",
    cheque: "cheque",
    companyDocument: "company_docs",
    tds: "tax_certificate",
    other: "other",
  };

  if (values.documents && typeof values.documents === "object") {
    Object.entries(values.documents).forEach(([type, files]) => {
      const fieldName = DOCUMENT_FIELD_MAP[type] || "other";
      if (Array.isArray(files)) {
        files.forEach((file) => formData.append(fieldName, file));
      }
    });
  }

  return formData;
};
