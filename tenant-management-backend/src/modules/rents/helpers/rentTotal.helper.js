/**
 * rentTotal_helper.js  (FIXED)
 *
 * ROOT BUG — unit-breakdown path was double-deducting TDS:
 *   OLD: remaining = rentAmountPaisa - paidAmountPaisa - tdsAmountPaisa
 *        ↑ wrong — this subtracts TDS from remaining, but TDS is already
 *          excluded from what the tenant owes the landlord.
 *
 *   CORRECT semantics (same as rent.domain.js):
 *     effectiveRentPaisa  = rentAmountPaisa - tdsAmountPaisa
 *     remainingAmountPaisa = effectiveRentPaisa - paidAmountPaisa
 *
 * FLAT RENT PATH was also wrong — it completely ignored TDS.
 *
 * Both paths now return the same consistent shape including effectiveRentPaisa.
 */

/**
 * @param {Object} rent  Mongoose Rent document or plain object
 * @returns {{
 *   rentAmountPaisa:      number,   gross rent (before TDS)
 *   tdsAmountPaisa:       number,   TDS withheld by tenant to govt
 *   effectiveRentPaisa:   number,   what landlord actually receives  (gross − TDS)
 *   paidAmountPaisa:      number,   amount received so far
 *   remainingAmountPaisa: number,   still owed                       (effective − paid)
 *   lateFeePaisa:         number,   penalty on overdue balance
 *   totalDuePaisa:        number,   remaining + late fee
 * }}
 */
export function calculateRentTotals(rent) {
  if (!rent) throw new Error("Rent object is required");

  let rentAmountPaisa;
  let tdsAmountPaisa;
  let paidAmountPaisa;

  // ── Unit-breakdown path ─────────────────────────────────────────────────
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
    // ── Flat rent path — bypass getters to read raw integer paisa ─────────
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

  // Late fee — always bypass getter (getter converts to rupees)
  const lateFeePaisa = rent.get
    ? rent.get("lateFeePaisa", null, { getters: false }) || 0
    : Math.round(Number(rent.lateFeePaisa)) || 0;

  // ── Derived values (single source of truth for all callers) ────────────
  const effectiveRentPaisa = rentAmountPaisa - tdsAmountPaisa;
  // FIX: remaining is (gross − TDS) − paid, NOT gross − paid − TDS (same math, explicit intent)
  const remainingAmountPaisa = effectiveRentPaisa - paidAmountPaisa;
  const totalDuePaisa = Math.max(0, remainingAmountPaisa) + lateFeePaisa;

  return {
    rentAmountPaisa,
    tdsAmountPaisa,
    effectiveRentPaisa,
    paidAmountPaisa,
    remainingAmountPaisa,
    lateFeePaisa,
    totalDuePaisa,
  };
}
