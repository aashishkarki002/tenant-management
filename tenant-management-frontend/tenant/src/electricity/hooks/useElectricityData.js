/**
 * Fetches electricity readings (grouped by meterType) and summary from the API.
 *
 * Controller response shape (no meterType filter):
 * {
 *   grouped: {
 *     unit:        { readings, totalAmount, totalUnits, count }
 *     common_area: { readings, totalAmount, totalUnits, count }
 *     parking:     { readings, totalAmount, totalUnits, count }
 *     sub_meter:   { readings, totalAmount, totalUnits, count }
 *   },
 *   summary: { totalReadings, grandTotalAmount, grandTotalUnits }
 * }
 *
 * Returns { grouped, summary, loading, refetch }.
 */

import { useState, useEffect, useCallback } from "react";
import { getReadings } from "../utils/electricityApi";

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
          // Grouped response — standard path (no meterType filter sent)
          setGrouped(data.grouped);
          setSummary(data.summary ?? EMPTY_SUMMARY);
        } else if (data?.readings) {
          // Flat response — meterType filter was supplied; rebuild a single bucket
          const meterType = data.meterType ?? "unit";
          const readings = data.readings ?? [];
          setGrouped({
            ...EMPTY_GROUPED,
            [meterType]: {
              readings,
              totalAmount: readings.reduce(
                (s, r) => s + (r.totalAmount ?? 0),
                0,
              ),
              totalUnits: readings.reduce(
                (s, r) => s + (r.unitsConsumed ?? 0),
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
        console.error("Error fetching electricity data:", error);
        setGrouped(EMPTY_GROUPED);
        setSummary(EMPTY_SUMMARY);
      } finally {
        setLoading(false);
      }
    },
    [
      filters.propertyId,
      filters.blockId,
      filters.innerBlockId,
      filters.unitId,
      filters.tenantId,
      filters.nepaliYear,
      filters.nepaliMonth,
      filters.status,
    ],
  );

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  return { grouped, summary, loading, refetch: fetchReadings };
}
