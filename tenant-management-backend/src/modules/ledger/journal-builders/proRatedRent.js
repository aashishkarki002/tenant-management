/**
 * proRatedRent.js
 *
 * Builds journal payloads for pro-rated final rent/CAM charges
 * when a tenant vacates mid-month.
 *
 * Pro-rate formula:
 *   proRatedPaisa = Math.round((daysOccupied / totalDaysInMonth) * monthlyPaisa)
 *
 * Journals:
 *
 *   PRO-RATED RENT:
 *     DR  Accounts Receivable  (1200)  proRatedRentPaisa
 *     CR  Rental Income        (4000)  proRatedRentPaisa
 *
 *   PRO-RATED CAM:
 *     DR  Accounts Receivable  (1200)  proRatedCamPaisa
 *     CR  CAM Revenue          (4050)  proRatedCamPaisa
 *
 * All amounts in PAISA (integers).
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

/**
 * Calculate pro-rated amount for a partial month.
 *
 * @param {number} monthlyPaisa    Full monthly amount in paisa
 * @param {number} daysOccupied    Days the tenant occupied (1 → vacateDay)
 * @param {number} totalDaysInMonth Total days in the billing month
 * @returns {number} Pro-rated paisa (integer, rounded)
 */
export function calculateProRatedPaisa(monthlyPaisa, daysOccupied, totalDaysInMonth) {
  if (!Number.isInteger(monthlyPaisa) || monthlyPaisa <= 0) {
    throw new Error(`monthlyPaisa must be a positive integer, got ${monthlyPaisa}`);
  }
  if (daysOccupied < 1 || daysOccupied > totalDaysInMonth) {
    throw new Error(
      `daysOccupied (${daysOccupied}) must be between 1 and ${totalDaysInMonth}`,
    );
  }
  return Math.round((daysOccupied / totalDaysInMonth) * monthlyPaisa);
}

/**
 * Build pro-rated rent charge journal.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.vacateSettlementId  VacateSettlement._id
 * @param {string|ObjectId} params.tenantId
 * @param {string}          params.tenantName
 * @param {string|ObjectId} params.propertyId
 * @param {number}          params.proRatedRentPaisa
 * @param {number}          params.nepaliMonth          Final month (1–12)
 * @param {number}          params.nepaliYear
 * @param {number}          params.daysOccupied
 * @param {number}          params.totalDaysInMonth
 * @param {Date}            params.vacateDate
 * @param {string|ObjectId} params.createdBy
 * @param {string|ObjectId} params.entityId
 *
 * @returns {Object} Journal payload
 */
export function buildProRatedRentJournal({
  vacateSettlementId,
  tenantId,
  tenantName,
  propertyId,
  proRatedRentPaisa,
  nepaliMonth,
  nepaliYear,
  daysOccupied,
  totalDaysInMonth,
  vacateDate,
  createdBy,
  entityId,
}) {
  if (!Number.isInteger(proRatedRentPaisa) || proRatedRentPaisa <= 0) {
    throw new Error(`proRatedRentPaisa must be a positive integer, got ${proRatedRentPaisa}`);
  }

  const txDate   = vacateDate instanceof Date ? vacateDate : new Date(vacateDate);
  const nepaliDate = formatNepaliISO(new NepaliDate(txDate));
  const name     = tenantName ?? "Tenant";

  return {
    transactionType: "RENT_CHARGE_PRORATED",
    referenceType:   "VacateSettlement",
    referenceId:     vacateSettlementId,
    transactionDate: txDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description: `Pro-rated rent (${daysOccupied}/${totalDaysInMonth} days) for ${name} — final month ${nepaliMonth}/${nepaliYear}`,
    createdBy,
    totalAmountPaisa: proRatedRentPaisa,
    tenant:   tenantId,
    property: propertyId,
    entityId,
    entries: [
      {
        accountCode:       ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa:  proRatedRentPaisa,
        creditAmountPaisa: 0,
        description: `Pro-rated rent receivable from ${name}`,
      },
      {
        accountCode:       ACCOUNT_CODES.REVENUE,
        debitAmountPaisa:  0,
        creditAmountPaisa: proRatedRentPaisa,
        description: `Pro-rated rental income from ${name}`,
      },
    ],
  };
}

/**
 * Build pro-rated CAM charge journal.
 *
 * @param {Object} params  (same as buildProRatedRentJournal but with proRatedCamPaisa)
 * @returns {Object} Journal payload
 */
export function buildProRatedCamJournal({
  vacateSettlementId,
  tenantId,
  tenantName,
  propertyId,
  proRatedCamPaisa,
  nepaliMonth,
  nepaliYear,
  daysOccupied,
  totalDaysInMonth,
  vacateDate,
  createdBy,
  entityId,
}) {
  if (!Number.isInteger(proRatedCamPaisa) || proRatedCamPaisa <= 0) {
    throw new Error(`proRatedCamPaisa must be a positive integer, got ${proRatedCamPaisa}`);
  }

  const txDate     = vacateDate instanceof Date ? vacateDate : new Date(vacateDate);
  const nepaliDate = formatNepaliISO(new NepaliDate(txDate));
  const name       = tenantName ?? "Tenant";

  return {
    transactionType: "CAM_CHARGE_PRORATED",
    referenceType:   "VacateSettlement",
    referenceId:     vacateSettlementId,
    transactionDate: txDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description: `Pro-rated CAM (${daysOccupied}/${totalDaysInMonth} days) for ${name} — final month ${nepaliMonth}/${nepaliYear}`,
    createdBy,
    totalAmountPaisa: proRatedCamPaisa,
    tenant:   tenantId,
    property: propertyId,
    entityId,
    entries: [
      {
        accountCode:       ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        debitAmountPaisa:  proRatedCamPaisa,
        creditAmountPaisa: 0,
        description: `Pro-rated CAM receivable from ${name}`,
      },
      {
        accountCode:       ACCOUNT_CODES.CAM_REVENUE,
        debitAmountPaisa:  0,
        creditAmountPaisa: proRatedCamPaisa,
        description: `Pro-rated CAM income from ${name}`,
      },
    ],
  };
}
