/**
 * rentDeferral.js
 *
 * Journal builders for the upfront-billing + accrual deferral system.
 *
 * Three-journal lifecycle per tenant:
 *
 * Journal 1 — Onboarding (at lease start / admin posting date):
 *   DR 1200 Rent Receivable    totalLeaseRentPaisa   (full lease AR)
 *   DR 1210 CAM Receivable     totalLeaseCamPaisa    (full lease CAM, if > 0)
 *   CR 4000 Rental Income      totalLeaseRentPaisa
 *   CR 4050 CAM Revenue        totalLeaseCamPaisa    (if > 0)
 *
 * Journal 2 — Initial Deferral (same day, immediately after Journal 1):
 *   DR 4000 Rental Income      unearnedRentPaisa     (reduce overstated revenue)
 *   DR 4050 CAM Revenue        unearnedCamPaisa      (if > 0)
 *   CR 2300 Deferred Revenue   (rent + cam)          (unearned liability)
 *
 *   Net effect on Revenue: only first-period earned amount remains.
 *   Net effect on Deferred: all future months' value sits as a liability.
 *
 * Journal 3 — Monthly Recognition (run by month-end cron):
 *   DR 2300 Deferred Revenue   (rent + cam)
 *   CR 4000 Rental Income      earnedRentPaisa
 *   CR 4050 CAM Revenue        earnedCamPaisa        (if > 0)
 *
 * All amounts PAISA (integers). Do NOT pass floats.
 */

import { ACCOUNT_CODES } from "../config/accounts.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

function resolveDate(d) {
  const dt = d instanceof Date ? d : new Date(d ?? Date.now());
  return { txDate: dt, nepaliDate: formatNepaliISO(new NepaliDate(dt)) };
}

/**
 * Journal 1: Onboarding — book full lease receivable + revenue.
 *
 * @param {Object} p
 * @param {ObjectId} p.scheduleId         RentDeferralSchedule._id
 * @param {ObjectId} p.tenantId
 * @param {string}   p.tenantName
 * @param {ObjectId} [p.propertyId]
 * @param {ObjectId} p.entityId
 * @param {number}   p.totalLeaseRentPaisa   Integer
 * @param {number}   [p.totalLeaseCamPaisa]  Integer, default 0
 * @param {Date}     p.postingDate
 * @param {number}   p.nepaliMonth
 * @param {number}   p.nepaliYear
 * @param {ObjectId} [p.createdBy]
 */
export function buildOnboardingJournal({
  scheduleId, tenantId, tenantName, propertyId, entityId,
  totalLeaseRentPaisa, totalLeaseCamPaisa = 0,
  postingDate, nepaliMonth, nepaliYear, createdBy,
}) {
  if (!Number.isInteger(totalLeaseRentPaisa) || totalLeaseRentPaisa <= 0)
    throw new Error(`buildOnboardingJournal: totalLeaseRentPaisa must be positive integer, got ${totalLeaseRentPaisa}`);
  if (!Number.isInteger(totalLeaseCamPaisa) || totalLeaseCamPaisa < 0)
    throw new Error(`buildOnboardingJournal: totalLeaseCamPaisa must be non-negative integer, got ${totalLeaseCamPaisa}`);

  const { txDate, nepaliDate } = resolveDate(postingDate);
  const name = tenantName ?? "Tenant";
  const totalPaisa = totalLeaseRentPaisa + totalLeaseCamPaisa;

  const entries = [
    {
      accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
      debitAmountPaisa: totalLeaseRentPaisa,
      creditAmountPaisa: 0,
      description: `Lease rent receivable — ${name} (full lease term)`,
    },
    {
      accountCode: ACCOUNT_CODES.REVENUE,
      debitAmountPaisa: 0,
      creditAmountPaisa: totalLeaseRentPaisa,
      description: `Lease rental income — ${name} (full term, pre-deferral)`,
    },
  ];

  if (totalLeaseCamPaisa > 0) {
    entries.push(
      {
        accountCode: ACCOUNT_CODES.CAM_RECEIVABLE,
        debitAmountPaisa: totalLeaseCamPaisa,
        creditAmountPaisa: 0,
        description: `Lease CAM receivable — ${name} (full lease term)`,
      },
      {
        accountCode: ACCOUNT_CODES.CAM_REVENUE,
        debitAmountPaisa: 0,
        creditAmountPaisa: totalLeaseCamPaisa,
        description: `Lease CAM income — ${name} (full term, pre-deferral)`,
      },
    );
  }

  return {
    transactionType: "RENT_ONBOARDING",
    referenceType: "RentDeferralSchedule",
    referenceId: scheduleId,
    transactionDate: txDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description: `Lease onboarding — ${name} — full lease AR + income (source: TENANT_ONBOARDING)`,
    createdBy: createdBy ?? null,
    totalAmountPaisa: totalPaisa,
    tenant: tenantId,
    property: propertyId ?? null,
    entityId,
    entries,
  };
}

/**
 * Journal 2: Initial deferral — move unearned revenue to liability.
 * Posted immediately after the onboarding journal (same day, same session).
 *
 * This journal REDUCES Revenue to only the first-period earned amount.
 * All future periods' value moves to Deferred Revenue (2300) as a liability.
 *
 * @param {Object} p
 * @param {ObjectId} p.scheduleId
 * @param {ObjectId} p.tenantId
 * @param {string}   p.tenantName
 * @param {ObjectId} [p.propertyId]
 * @param {ObjectId} p.entityId
 * @param {number}   p.unearnedRentPaisa   Total unearned rent (future periods)
 * @param {number}   [p.unearnedCamPaisa]  Total unearned CAM (future periods)
 * @param {Date}     p.postingDate
 * @param {number}   p.nepaliMonth
 * @param {number}   p.nepaliYear
 * @param {ObjectId} [p.createdBy]
 */
export function buildInitialDeferralJournal({
  scheduleId, tenantId, tenantName, propertyId, entityId,
  unearnedRentPaisa, unearnedCamPaisa = 0,
  postingDate, nepaliMonth, nepaliYear, createdBy,
}) {
  if (!Number.isInteger(unearnedRentPaisa) || unearnedRentPaisa < 0)
    throw new Error(`buildInitialDeferralJournal: unearnedRentPaisa must be non-negative integer`);
  if (!Number.isInteger(unearnedCamPaisa) || unearnedCamPaisa < 0)
    throw new Error(`buildInitialDeferralJournal: unearnedCamPaisa must be non-negative integer`);

  const totalUnearned = unearnedRentPaisa + unearnedCamPaisa;
  if (totalUnearned <= 0) throw new Error("buildInitialDeferralJournal: nothing to defer (totalUnearned = 0)");

  const { txDate, nepaliDate } = resolveDate(postingDate);
  const name = tenantName ?? "Tenant";
  const entries = [];

  if (unearnedRentPaisa > 0) {
    entries.push({
      accountCode: ACCOUNT_CODES.REVENUE,
      debitAmountPaisa: unearnedRentPaisa,
      creditAmountPaisa: 0,
      description: `Initial deferral — unearned rent income — ${name}`,
    });
  }

  if (unearnedCamPaisa > 0) {
    entries.push({
      accountCode: ACCOUNT_CODES.CAM_REVENUE,
      debitAmountPaisa: unearnedCamPaisa,
      creditAmountPaisa: 0,
      description: `Initial deferral — unearned CAM income — ${name}`,
    });
  }

  entries.push({
    accountCode: ACCOUNT_CODES.DEFERRED_RENT_REVENUE,
    debitAmountPaisa: 0,
    creditAmountPaisa: totalUnearned,
    description: `Deferred revenue — unearned lease income — ${name}`,
  });

  return {
    transactionType: "RENT_DEFERRAL_INITIAL",
    referenceType: "RentDeferralSchedule",
    referenceId: scheduleId,
    transactionDate: txDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description: `Initial deferral — unearned lease income — ${name} (source: TENANT_ONBOARDING)`,
    createdBy: createdBy ?? null,
    totalAmountPaisa: totalUnearned,
    tenant: tenantId,
    property: propertyId ?? null,
    entityId,
    entries,
  };
}

/**
 * Journal 3: Monthly recognition — earn one period from the deferred balance.
 * Posted by the month-end cron for each pending period.
 *
 * @param {Object} p
 * @param {ObjectId} p.periodId        Period subdoc _id (idempotency key)
 * @param {ObjectId} p.tenantId
 * @param {string}   p.tenantName
 * @param {ObjectId} [p.propertyId]
 * @param {ObjectId} p.entityId
 * @param {number}   p.earnedRentPaisa
 * @param {number}   [p.earnedCamPaisa]
 * @param {number}   p.nepaliMonth
 * @param {number}   p.nepaliYear
 * @param {Date}     [p.recognitionDate]   Defaults to now
 * @param {ObjectId} [p.createdBy]
 */
export function buildDeferralRecognitionJournal({
  periodId, tenantId, tenantName, propertyId, entityId,
  earnedRentPaisa, earnedCamPaisa = 0,
  nepaliMonth, nepaliYear, recognitionDate, createdBy,
}) {
  if (!Number.isInteger(earnedRentPaisa) || earnedRentPaisa < 0)
    throw new Error(`buildDeferralRecognitionJournal: earnedRentPaisa must be non-negative integer`);
  if (!Number.isInteger(earnedCamPaisa) || earnedCamPaisa < 0)
    throw new Error(`buildDeferralRecognitionJournal: earnedCamPaisa must be non-negative integer`);

  const totalEarned = earnedRentPaisa + earnedCamPaisa;
  if (totalEarned <= 0) throw new Error("buildDeferralRecognitionJournal: nothing to recognize (totalEarned = 0)");

  const { txDate, nepaliDate } = resolveDate(recognitionDate);
  const name = tenantName ?? "Tenant";

  const entries = [
    {
      accountCode: ACCOUNT_CODES.DEFERRED_RENT_REVENUE,
      debitAmountPaisa: totalEarned,
      creditAmountPaisa: 0,
      description: `Recognition — deferred income earned ${nepaliMonth}/${nepaliYear} — ${name}`,
    },
  ];

  if (earnedRentPaisa > 0) {
    entries.push({
      accountCode: ACCOUNT_CODES.REVENUE,
      debitAmountPaisa: 0,
      creditAmountPaisa: earnedRentPaisa,
      description: `Rental income recognised ${nepaliMonth}/${nepaliYear} — ${name}`,
    });
  }

  if (earnedCamPaisa > 0) {
    entries.push({
      accountCode: ACCOUNT_CODES.CAM_REVENUE,
      debitAmountPaisa: 0,
      creditAmountPaisa: earnedCamPaisa,
      description: `CAM income recognised ${nepaliMonth}/${nepaliYear} — ${name}`,
    });
  }

  return {
    transactionType: "RENT_DEFERRAL_RECOGNITION",
    referenceType: "RentDeferralSchedule",
    referenceId: periodId, // period subdoc _id — unique idempotency key per period
    transactionDate: txDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    description: `Deferral recognition — ${name} — ${nepaliMonth}/${nepaliYear} (source: MONTH_END_CRON)`,
    createdBy: createdBy ?? null,
    totalAmountPaisa: totalEarned,
    tenant: tenantId,
    property: propertyId ?? null,
    entityId,
    entries,
  };
}
