/**
 * rentTotal.helper.js
 *
 * Single source of truth for rent totals across all callers
 * (service layer, email templates, API responses).
 *
 * Late fee is a SEPARATE receivable from rent principal:
 *   - remainingRentPaisa  = (gross − TDS) − paidAmountPaisa
 *   - remainingLateFeePaisa = lateFeePaisa − latePaidAmountPaisa
 *   - totalDuePaisa       = remainingRentPaisa + remainingLateFeePaisa
 *
 * Neither remainingRentPaisa nor remainingLateFeePaisa ever bleeds into
 * the other — they are independently tracked and independently journaled.
 */

/**
 * @param {Object} rent  Mongoose Rent document or plain object
 * @returns {{
 *   rentAmountPaisa:        number,   gross rent (before TDS)
 *   tdsAmountPaisa:         number,   TDS withheld by tenant → govt
 *   effectiveRentPaisa:     number,   what landlord actually receives (gross − TDS)
 *   paidAmountPaisa:        number,   rent principal received so far
 *   remainingRentPaisa:     number,   rent still owed
 *   lateFeePaisa:           number,   total late fee charged
 *   latePaidAmountPaisa:    number,   late fee already received
 *   remainingLateFeePaisa:  number,   late fee still owed
 *   totalDuePaisa:          number,   remainingRent + remainingLateFee
 *
 *   // kept for backward compat — same as remainingRentPaisa
 *   remainingAmountPaisa:   number,
 * }}
 */
export function calculateRentTotals(rent) {
  if (!rent) throw new Error("Rent object is required");

  let rentAmountPaisa;
  let tdsAmountPaisa;
  let paidAmountPaisa;

  // ── Unit-breakdown path ───────────────────────────────────────────────────
  if (
    rent.useUnitBreakdown &&
    Array.isArray(rent.unitBreakdown) &&
    rent.unitBreakdown.length > 0
  ) {
    rentAmountPaisa = rent.unitBreakdown.reduce(
      (s, u) => s + (Math.round(Number(u.rentAmountPaisa)) || 0),
      0,
    );
    tdsAmountPaisa = rent.unitBreakdown.reduce(
      (s, u) => s + (Math.round(Number(u.tdsAmountPaisa)) || 0),
      0,
    );
    paidAmountPaisa = rent.unitBreakdown.reduce(
      (s, u) => s + (Math.round(Number(u.paidAmountPaisa)) || 0),
      0,
    );
  } else {
    // ── Flat rent path — bypass getters to read raw integer paisa ──────────
    const getRaw = (field) => {
      if (rent.get && typeof rent.get === "function") {
        return rent.get(field, null, { getters: false }) || 0;
      }
      return Math.round(Number(rent[field])) || 0;
    };
    rentAmountPaisa = getRaw("rentAmountPaisa");
    tdsAmountPaisa = getRaw("tdsAmountPaisa");
    paidAmountPaisa = getRaw("paidAmountPaisa");
  }

  // Late fee fields — always bypass getter (getter converts to rupees)
  const getRawRoot = (field) => {
    if (rent.get && typeof rent.get === "function") {
      return rent.get(field, null, { getters: false }) || 0;
    }
    return Math.round(Number(rent[field])) || 0;
  };

  const lateFeePaisa = getRawRoot("lateFeePaisa");
  const latePaidAmountPaisa = getRawRoot("latePaidAmountPaisa");

  // ── Derived values ────────────────────────────────────────────────────────
  const effectiveRentPaisa = rentAmountPaisa - tdsAmountPaisa;
  const remainingRentPaisa = effectiveRentPaisa - paidAmountPaisa;
  const remainingLateFeePaisa = Math.max(0, lateFeePaisa - latePaidAmountPaisa);
  const totalDuePaisa = Math.max(0, remainingRentPaisa) + remainingLateFeePaisa;

  return {
    rentAmountPaisa,
    tdsAmountPaisa,
    effectiveRentPaisa,
    paidAmountPaisa,
    remainingRentPaisa,
    lateFeePaisa,
    latePaidAmountPaisa,
    remainingLateFeePaisa,
    totalDuePaisa,

    // backward-compat alias
    remainingAmountPaisa: remainingRentPaisa,
  };
}
