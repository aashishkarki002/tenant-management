// hooks/useNepaliDate.js
// ─────────────────────────────────────────────────────────────────────────────
// React wrappers around shared Nepali date helpers in `@/utils/nepaliDate`.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { adIsoToNepaliApiFields } from "@/utils/nepaliDate";

/**
 * Convert an AD date string (YYYY-MM-DD) into the three Nepali fields
 * expected by the backend API.
 *
 * @param {string} adDateString  - English date in "YYYY-MM-DD" format.
 *                                 Defaults to today if omitted.
 * @returns {{ nepaliDate: string, nepaliMonth: number, nepaliYear: number }}
 */
export function parseNepaliFields(adDateString) {
  return adIsoToNepaliApiFields(adDateString);
}

/**
 * React hook — returns today's Nepali date fields, memoised until midnight.
 * Use this as the default/fallback in any form that needs to send Nepali date
 * to the backend but doesn't have a date picker (e.g. quick-action buttons).
 */
export function useCurrentNepaliDate() {
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return parseNepaliFields(today);
  }, [
    // Re-derive when the calendar day changes (checked at hook call time)
    new Date().toISOString().slice(0, 10),
  ]);
}
