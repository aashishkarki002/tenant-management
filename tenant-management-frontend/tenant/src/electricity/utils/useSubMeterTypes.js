/**
 * useSubMeterTypes.js
 *
 * Fetches all sub-meters for a property and exposes grouped counts per
 * meterType — drives the tab badge counts in ElectricityTabs.
 *
 * Industry pattern: a "lookup" hook that fetches reference/configuration data
 * separately from the transaction data hook (useElectricityData).
 * This keeps concerns separated and allows the tab bar to show counts even
 * before the user switches to a tab.
 *
 * Usage:
 *   const { subMeters, countsByType, loading } = useSubMeterTypes(propertyId);
 */

import { useState, useEffect, useCallback } from "react";
import { getSubMeters } from "../utils/subMeterApi";

/** Maps meterType values (DB) to display tab keys (UI) */
export const METER_TYPE_TO_TAB = {
  unit: "", // "Units" tab
  common_area: "Common Area",
  parking: "Parking",
  sub_meter: "Sub-Meter",
};

/** Maps UI tab key → DB meterType for API queries */
export const TAB_TO_METER_TYPE = {
  "": "unit",
  "Common Area": "common_area",
  Parking: "parking",
  "Sub-Meter": "sub_meter",
};

const DEFAULT_COUNTS = {
  unit: 0,
  common_area: 0,
  parking: 0,
  sub_meter: 0,
};

/**
 * @param {string|null} propertyId
 * @returns {{
 *   subMeters: Array,
 *   countsByType: typeof DEFAULT_COUNTS,
 *   loading: boolean,
 *   error: string|null,
 *   refetch: Function
 * }}
 */
export function useSubMeterTypes(propertyId) {
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

      // Build per-type counts for tab badges
      const counts = { ...DEFAULT_COUNTS };
      for (const meter of list) {
        if (meter.meterType in counts) {
          counts[meter.meterType] += 1;
        }
      }
      setCountsByType(counts);
    } catch (err) {
      console.error("useSubMeterTypes:", err);
      setError(err.message);
      setSubMeters([]);
      setCountsByType({ ...DEFAULT_COUNTS });
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchSubMeters();
  }, [fetchSubMeters]);

  return { subMeters, countsByType, loading, error, refetch: fetchSubMeters };
}

/**
 * Pure helper — filters a readings array by the active tab.
 *
 * Rules:
 *   "all"        → return everything
 *   "flagged"    → handled upstream by isFlagged() — pass through unchanged
 *   everything else → match record.meterType to TAB_TO_METER_TYPE[activeTab]
 *
 * @param {Array}  readings
 * @param {string} activeTab - value from ElectricityTabs
 * @returns {Array}
 */
export function filterReadingsByTab(readings, activeTab) {
  if (activeTab === "all" || activeTab === "flagged") return readings;

  const meterType = TAB_TO_METER_TYPE[activeTab];
  if (!meterType) return readings; // unknown tab — show all

  return readings.filter((r) => r.meterType === meterType);
}
