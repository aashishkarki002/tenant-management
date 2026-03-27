/**
 * useUnitOptions.js
 *
 * Thin adapter over the existing useUnits / useOccupiedUnits / useVacantUnits hooks.
 * Owns the client-side filter logic (block, innerBlock) and the shape
 * transformation into UnitCombobox-ready options.
 *
 * Usage:
 *   const { options, loading } = useUnitOptions({ blockId, mode: "vacant" });
 */

import { useMemo } from "react";
import { useUnits, useOccupiedUnits, useVacantUnits } from "@/hooks/use-units";

/**
 * @typedef {{ value: string; label: string; blockName?: string; floor?: string; isOccupied: boolean }} UnitOption
 */

/**
 * @param {Object}  params
 * @param {string}  [params.propertyId]    - Passed to the underlying hook for server-side filtering
 * @param {string}  [params.blockId]       - Client-side filter; pass "all" or undefined to skip
 * @param {string}  [params.innerBlockId]  - Client-side filter by floor/inner block
 * @param {"all"|"occupied"|"vacant"} [params.mode="all"]
 *
 * @returns {{ options: UnitOption[]; loading: boolean; error: string|null }}
 */
export function useUnitOptions({
  propertyId,
  blockId,
  innerBlockId,
  mode = "all",
} = {}) {
  // Pick the right hook based on mode — all three share the same return shape.
  // The fetcher receives propertyId for server-side scoping. blockId is passed
  // too so the server can narrow the query when possible.
  const hookFilters = { propertyId, blockId: undefined }; // block filtered client-side below
  const allResult = useUnits(
    mode === "all" ? hookFilters : { skip: true, ...hookFilters },
  );
  const occupiedResult = useOccupiedUnits(
    mode === "occupied" ? hookFilters : { skip: true, ...hookFilters },
  );
  const vacantResult = useVacantUnits(
    mode === "vacant" ? hookFilters : { skip: true, ...hookFilters },
  );

  const { units, loading, error } =
    mode === "occupied"
      ? occupiedResult
      : mode === "vacant"
        ? vacantResult
        : allResult;

  const options = useMemo(() => {
    if (!Array.isArray(units)) return [];

    return units
      .filter((u) => {
        if (blockId && blockId !== "all") {
          const unitBlockId = u.block?._id ?? u.block;
          if (unitBlockId !== blockId) return false;
        }
        if (innerBlockId) {
          const unitInnerBlockId = u.innerBlock?._id ?? u.innerBlock;
          if (unitInnerBlockId !== innerBlockId) return false;
        }
        return true;
      })
      .map((u) => ({
        value: u._id,
        label: u.name ?? u.unitName ?? u._id,
        blockName: u.block?.name ?? null,
        floor: u.innerBlock?.name ?? null,
        isOccupied: !!u.currentTenant,
      }));
  }, [units, blockId, innerBlockId]);

  return { options, loading, error };
}
