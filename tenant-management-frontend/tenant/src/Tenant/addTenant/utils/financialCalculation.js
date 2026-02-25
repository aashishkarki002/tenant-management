/**
 * financialCalculation.js  (FIXED)
 *
 * FIX 1 — calculateFinancialTotals was summing pricePerSqft rates across units.
 *   Summing rates is meaningless. What matters is gross rent (sqft × rate) per unit.
 *
 * FIX 2 — No TDS breakdown existed.
 *   This now mirrors the backend's calculateUnitLease() exactly:
 *     tdsPerSqft     = pricePerSqft - pricePerSqft / (1 + tdsRate)   ← reverse method
 *     netRatePerSqft = pricePerSqft - tdsPerSqft
 *     grossMonthly   = pricePerSqft * sqft
 *     tdsMonthly     = tdsPerSqft * sqft
 *     netRent        = netRatePerSqft * sqft                          ← landlord receives
 *     camMonthly     = camRatePerSqft * sqft
 *     totalDue       = netRent + camMonthly                           ← tenant pays monthly
 *
 * All paisa conversions are intentionally NOT done here — this is a display
 * helper. The backend does the authoritative integer-paisa conversion.
 */

// ── Single-unit calculation (mirrors backend calculateUnitLease) ─────────────

/**
 * @param {{ sqft, pricePerSqft, camPerSqft, securityDeposit }} financial
 * @param {number} tdsPercentage  e.g. 10 for 10%
 * @returns {{
 *   sqft, grossMonthly, tdsMonthly, netRent, camMonthly,
 *   totalMonthlyDue, securityDeposit,
 *   tdsPerSqft, netRatePerSqft
 * }}
 */
export function calculateUnitBreakdown(financial, tdsPercentage = 10) {
  const sqft = parseFloat(financial.sqft) || 0;
  const pricePerSqft = parseFloat(financial.pricePerSqft) || 0;
  const camPerSqft = parseFloat(financial.camPerSqft) || 0;
  const securityDeposit = parseFloat(financial.securityDeposit) || 0;
  const tdsRate = tdsPercentage / 100;

  // Reverse TDS method — price/sqft is gross (includes TDS)
  const tdsPerSqft = pricePerSqft - pricePerSqft / (1 + tdsRate);
  const netRatePerSqft = pricePerSqft - tdsPerSqft;

  const grossMonthly = pricePerSqft * sqft;
  const tdsMonthly = tdsPerSqft * sqft;
  const netRent = netRatePerSqft * sqft; // what landlord receives
  const camMonthly = camPerSqft * sqft;
  const totalMonthlyDue = netRent + camMonthly; // what tenant pays each month

  return {
    sqft,
    pricePerSqft,
    camPerSqft,
    securityDeposit,
    tdsPerSqft,
    netRatePerSqft,
    grossMonthly,
    tdsMonthly,
    netRent,
    camMonthly,
    totalMonthlyDue,
  };
}

// ── Aggregate across all units ────────────────────────────────────────────────

/**
 * Calculate aggregated financial totals from unitFinancials map.
 * Returns the same shape as the backend's calculateMultiUnitLease() totals.
 *
 * @param {Object} unitFinancials  - { [unitId]: { sqft, pricePerSqft, camPerSqft, securityDeposit } }
 * @param {number} tdsPercentage
 * @returns {{
 *   totalSqft, grossMonthly, tdsMonthly, netRent,
 *   camMonthly, totalMonthlyDue, totalSecurityDeposit,
 *   weightedPricePerSqft, weightedCamPerSqft
 * }}
 */
export function calculateFinancialTotals(
  unitFinancials = {},
  tdsPercentage = 10,
) {
  const zero = {
    totalSqft: 0,
    grossMonthly: 0,
    tdsMonthly: 0,
    netRent: 0,
    camMonthly: 0,
    totalMonthlyDue: 0,
    totalSecurityDeposit: 0,
  };

  const totals = Object.values(unitFinancials).reduce(
    (acc, financial) => {
      const u = calculateUnitBreakdown(financial, tdsPercentage);
      acc.totalSqft += u.sqft;
      acc.grossMonthly += u.grossMonthly;
      acc.tdsMonthly += u.tdsMonthly;
      acc.netRent += u.netRent;
      acc.camMonthly += u.camMonthly;
      acc.totalMonthlyDue += u.totalMonthlyDue;
      acc.totalSecurityDeposit += u.securityDeposit;
      return acc;
    },
    { ...zero },
  );

  // Weighted average rates (for backward-compat fields sent to backend)
  const weightedPricePerSqft =
    totals.totalSqft > 0 ? totals.grossMonthly / totals.totalSqft : 0;
  const weightedCamPerSqft =
    totals.totalSqft > 0 ? totals.camMonthly / totals.totalSqft : 0;

  return { ...totals, weightedPricePerSqft, weightedCamPerSqft };
}

// ── Kept for backward compat — now delegates to calculateFinancialTotals ──────

/** @deprecated use calculateFinancialTotals */
export const calculateAverageRates = (totals, _unitCount) => ({
  avgPricePerSqft: totals.weightedPricePerSqft ?? 0,
  avgCamPerSqft: totals.weightedCamPerSqft ?? 0,
});

/** @deprecated use calculateFinancialTotals */
export const calculateRentBreakdown = (unitFinancials, tdsPercentage = 10) =>
  calculateFinancialTotals(unitFinancials, tdsPercentage);
