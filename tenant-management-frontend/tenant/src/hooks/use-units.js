import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  fetchUnits,
  fetchOccupiedUnits,
  fetchVacantUnits,
} from "./unit.service";

/**
 * @typedef {Object} UseUnitsResult
 * @property {Unit[]  | null} units
 * @property {boolean}        loading
 * @property {string  | null} error
 * @property {()=>void}       refetch
 */

/**
 * Base hook — all unit-fetching hooks are built on this.
 * Accepts a fetcher function so each derived hook controls
 * exactly what it fetches without duplicating state/effect logic.
 *
 * @param {Function}  fetcher      - One of the service functions
 * @param {Object}    [filters]    - { propertyId, blockId }
 * @returns {UseUnitsResult}
 */
function useUnitBase(fetcher, filters = {}) {
  const { propertyId, blockId } = filters;

  const [units, setUnits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // A counter we can increment to force a re-fetch (refetch pattern).
  const [tick, setTick] = useState(0);
  const refetch = () => setTick((t) => t + 1);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetcher({ propertyId, blockId }, controller.signal)
      .then((data) => {
        setUnits(data);
      })
      .catch((err) => {
        // AbortError fires on cleanup — not a real error, ignore it.
        if (err.name === "AbortError" || err.code === "ERR_CANCELED") return;

        console.error("[useUnits]", err);
        setError(err.message);
        setUnits([]);
        toast.error("Failed to fetch units. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    // Cleanup: cancel in-flight request on unmount or dep change.
    return () => controller.abort();
  }, [propertyId, blockId, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  // `fetcher` is a module-level reference — stable, intentionally omitted from deps.

  return { units, loading, error, refetch };
}

// ─────────────────────────────────────────────
// PUBLIC HOOKS
// ─────────────────────────────────────────────

/**
 * All units (occupied + vacant).
 *
 * @param {{ propertyId?: string; blockId?: string }} [filters]
 * @returns {UseUnitsResult}
 *
 * @example
 * const { units, loading } = useUnits({ propertyId: "abc123" });
 */
export function useUnits(filters = {}) {
  return useUnitBase(fetchUnits, filters);
}

/**
 * Only occupied units — units with an active lease.
 *
 * @param {{ propertyId?: string; blockId?: string }} [filters]
 * @returns {UseUnitsResult}
 *
 * @example
 * const { units, loading } = useOccupiedUnits({ propertyId: "abc123" });
 */
export function useOccupiedUnits(filters = {}) {
  return useUnitBase(fetchOccupiedUnits, filters);
}

/**
 * Only vacant units — units with no active lease.
 *
 * @param {{ propertyId?: string; blockId?: string }} [filters]
 * @returns {UseUnitsResult}
 *
 * @example
 * const { units, loading } = useVacantUnits({ blockId: "xyz456" });
 */
export function useVacantUnits(filters = {}) {
  return useUnitBase(fetchVacantUnits, filters);
}
