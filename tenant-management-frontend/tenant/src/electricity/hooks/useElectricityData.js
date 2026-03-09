/**
 * useElectricityData.ts
 *
 * Fetches electricity readings (grouped by meterType) and summary from the API.
 *
 * Controller response shape:
 * {
 *   grouped: {
 *     unit:        { readings, totalAmount, totalUnits, count }
 *     common_area: { readings, totalAmount, totalUnits, count }
 *     parking:     { readings, totalAmount, totalUnits, count }
 *     sub_meter:   { readings, totalAmount, totalUnits, count }
 *   },
 *   summary: { totalReadings, grandTotalAmount, grandTotalUnits }
 * }
 */

import { useState, useEffect, useCallback } from "react";
import { getReadings } from "../utils/electricityApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_GROUPED = {
  unit: { readings: [], totalAmount: 0, totalUnits: 0, count: 0 },
  common_area: { readings: [], totalAmount: 0, totalUnits: 0, count: 0 },
  parking: { readings: [], totalAmount: 0, totalUnits: 0, count: 0 },
  sub_meter: { readings: [], totalAmount: 0, totalUnits: 0, count: 0 },
};

const EMPTY_SUMMARY = {
  totalReadings: 0,
  grandTotalUnits: 0,
  grandTotalAmount: 0,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Industry note on the dependency array pattern used here:
 *
 * The `useCallback` dep array lists individual primitive values (e.g.
 * `filters.nepaliYear`) rather than the `filters` object reference. This is
 * intentional and correct:
 *
 *   - The parent memo-ises `apiFilters` so the reference is already stable,
 *     but listing primitives is a defensive belt-and-suspenders measure.
 *   - If we listed the whole `filters` object, any new object reference
 *     (even with identical values) would create a new callback and trigger
 *     a redundant fetch. Object-level deps are almost always wrong.
 *   - ALL fields used inside `fetchReadings` must appear in the dep array
 *     (see eslint-plugin-react-hooks/exhaustive-deps).
 *
 * Prefer this pattern over useDeepCompareEffect; shallow primitive tracking
 * is cheaper and more explicit.
 */
export function useElectricityData(filters = {}) {
  const [grouped, setGrouped] = useState(EMPTY_GROUPED);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);

  const fetchReadings = useCallback(
    async (overrideFilters) => {
      const params = { ...filters, ...overrideFilters };
      try {
        setLoading(true);
        const data = await getReadings(params);

        if (data?.grouped) {
          setGrouped(data.grouped);
          setSummary(data.summary ?? EMPTY_SUMMARY);
        } else if (data?.readings) {
          // Legacy single-type response — normalise into grouped shape
          const meterType = data.meterType ?? "unit";
          const readings = data.readings ?? [];
          setGrouped({
            ...EMPTY_GROUPED,
            [meterType]: {
              readings,
              totalAmount: readings.reduce(
                (s, r) => s + (Number(r.totalAmount) || 0),
                0,
              ),
              totalUnits: readings.reduce(
                (s, r) => s + (Number(r.unitsConsumed) || 0),
                0,
              ),
              count: readings.length,
            },
          });
          setSummary(data.summary ?? EMPTY_SUMMARY);
        } else {
          setGrouped(EMPTY_GROUPED);
          setSummary(EMPTY_SUMMARY);
        }
      } catch (error) {
        console.error("useElectricityData: fetch failed", error);
        setGrouped(EMPTY_GROUPED);
        setSummary(EMPTY_SUMMARY);
      } finally {
        setLoading(false);
      }
    },
    // Primitive deps — see note above. Keep this list in sync with all
    // filters.* properties accessed inside fetchReadings.
    [
      filters.propertyId,
      filters.blockId,
      filters.innerBlockId,
      filters.unitId,
      filters.tenantId,
      filters.nepaliYear,
      filters.nepaliMonth,
      filters.status,
      filters.meterType,
      filters.searchQuery,
    ],
  );

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  return { grouped, summary, loading, refetch: fetchReadings };
}
