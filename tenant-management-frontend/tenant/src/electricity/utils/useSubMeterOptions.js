/**
 * useSubMeterOptions.js
 *
 * Fetches SubMeter documents from the backend, grouped by meterType.
 * Used exclusively by ElectricityReadingDialog to populate the
 * Common Area / Parking / Sub-Meter item selects.
 *
 * Industry pattern: separate "reference data" hooks from "transaction data"
 * hooks. useUnits() owns unit/tenant entities; this hook owns sub-meter config
 * entities. They are different DB collections with different lifecycles.
 *
 * Why not reuse useSubMeterTypes?
 *   useSubMeterTypes returns counts for tab badges.
 *   This hook returns the full sub-meter list for populating <Select> options,
 *   filtered by the cascade of propertyId → blockId → innerBlockId.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSubMeters } from "../utils/subMeterApi";

/**
 * @param {string|null} propertyId
 * @returns {{
 *   byType: {
 *     common_area: SubMeter[],
 *     parking:     SubMeter[],
 *     sub_meter:   SubMeter[],
 *   },
 *   loading: boolean,
 *   error: string | null,
 *   refetch: () => void,
 * }}
 */
export function useSubMeterOptions(propertyId) {
  const [allSubMeters, setAllSubMeters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!propertyId) {
      setAllSubMeters([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Single request — backend returns all active sub-meters for the property.
      // We group client-side to avoid 3 round-trips.
      const data = await getSubMeters({ propertyId, activeOnly: true });
      setAllSubMeters(data?.subMeters ?? []);
    } catch (err) {
      console.error("useSubMeterOptions:", err);
      setError(err.message);
      setAllSubMeters([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Group the flat list by meterType.
   * Memoised so consumers only re-render when the list actually changes.
   */
  const byType = useMemo(() => {
    const groups = { common_area: [], parking: [], sub_meter: [] };
    for (const meter of allSubMeters) {
      if (meter.meterType in groups) {
        groups[meter.meterType].push(meter);
      }
    }
    return groups;
  }, [allSubMeters]);

  return { byType, loading, error, refetch: fetchAll };
}

/**
 * Helper: given a byType group and optional block/innerBlock filters,
 * return the filtered subset. Kept pure so it's testable.
 *
 * @param {SubMeter[]} meters
 * @param {{ blockId?: string, innerBlockId?: string }} filters
 * @returns {SubMeter[]}
 */
export function filterSubMeterOptions(meters, { blockId, innerBlockId } = {}) {
  return meters.filter((m) => {
    if (blockId && m.block?._id !== blockId && m.block !== blockId)
      return false;
    if (
      innerBlockId &&
      m.innerBlock?._id !== innerBlockId &&
      m.innerBlock !== innerBlockId
    )
      return false;
    return true;
  });
}
