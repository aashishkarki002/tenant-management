import { useState, useEffect, useCallback, useMemo } from "react";
import { getSubMeters } from "../utils/subMeterApi";

const DEFAULT_COUNTS = {
  unit: 0,
  common_area: 0,
  parking: 0,
  sub_meter: 0,
};

/**
 * Unified sub-meter hook:
 * - provides full list for table/tab logic
 * - provides counts for tab badges
 * - provides grouped options for selection UIs
 *
 * @param {string|null} propertyId
 * @returns {{
 *   subMeters: Array,
 *   countsByType: typeof DEFAULT_COUNTS,
 *   byType: {
 *     common_area: Array,
 *     parking: Array,
 *     sub_meter: Array,
 *   },
 *   loading: boolean,
 *   error: string|null,
 *   refetch: () => Promise<void>
 * }}
 */
export function useSubMeters(propertyId) {
  const [subMeters, setSubMeters] = useState([]);
  const [countsByType, setCountsByType] = useState(DEFAULT_COUNTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSubMeters = useCallback(async () => {
    if (!propertyId) {
      setSubMeters([]);
      setCountsByType({ ...DEFAULT_COUNTS });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getSubMeters({ propertyId, activeOnly: true });
      const list = data?.subMeters ?? [];
      setSubMeters(list);

      const counts = { ...DEFAULT_COUNTS };
      for (const meter of list) {
        if (meter?.meterType in counts) counts[meter.meterType] += 1;
      }
      setCountsByType(counts);
    } catch (err) {
      console.error("useSubMeters:", err);
      setError(err?.message || "Failed to fetch sub-meters");
      setSubMeters([]);
      setCountsByType({ ...DEFAULT_COUNTS });
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchSubMeters();
  }, [fetchSubMeters]);

  const byType = useMemo(() => {
    const groups = {
      common_area: [],
      parking: [],
      sub_meter: [],
    };
    for (const meter of subMeters) {
      if (meter?.meterType in groups) groups[meter.meterType].push(meter);
    }
    return groups;
  }, [subMeters]);

  return { subMeters, countsByType, byType, loading, error, refetch: fetchSubMeters };
}

/**
 * Filter readings by active tab.
 * "all" and "flagged" are special tabs and should not trim by meter type here.
 *
 * @param {Array} readings
 * @param {string} activeTab
 * @returns {Array}
 */
export function filterReadingsByTab(readings = [], activeTab) {
  if (activeTab === "all" || activeTab === "flagged") return readings;
  return readings.filter((reading) => reading?.meterType === activeTab);
}

/**
 * Filter sub-meter options by block/inner block.
 *
 * @param {Array} meters
 * @param {{ blockId?: string, innerBlockId?: string }} filters
 * @returns {Array}
 */
export function filterSubMeterOptions(meters = [], { blockId, innerBlockId } = {}) {
  return meters.filter((meter) => {
    if (blockId && meter.block?._id !== blockId && meter.block !== blockId) return false;
    if (
      innerBlockId &&
      meter.innerBlock?._id !== innerBlockId &&
      meter.innerBlock !== innerBlockId
    )
      return false;
    return true;
  });
}
