// hooks/useNepaliDate.js
// ─────────────────────────────────────────────────────────────────────────────
// Provides the current Nepali date broken into the three fields the backend
// expects: nepaliDate (ISO string), nepaliMonth (1-12), nepaliYear (YYYY).
//
// Industry pattern: derive and centralise this conversion in one place so
// every form/dialog that hits a date-sensitive endpoint uses consistent values.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import dateConverter from "nepali-datetime/dateConverter";

/**
 * Convert an AD date string (YYYY-MM-DD) into the three Nepali fields
 * expected by the backend API.
 *
 * @param {string} adDateString  - English date in "YYYY-MM-DD" format.
 *                                 Defaults to today if omitted.
 * @returns {{ nepaliDate: string, nepaliMonth: number, nepaliYear: number }}
 */
export function parseNepaliFields(adDateString) {
  const source = adDateString || new Date().toISOString().slice(0, 10);
  const [enYear, enMonthHuman, enDay] = source.split("-").map(Number);
  // dateConverter uses 0-based month
  const [npYear, npMonth0, npDay] = dateConverter.englishToNepali(
    enYear,
    enMonthHuman - 1,
    enDay,
  );
  const npMonth = npMonth0 + 1; // store 1-based to match DB convention
  const nepaliDate = `${npYear}-${String(npMonth).padStart(2, "0")}-${String(npDay).padStart(2, "0")}`;
  return {
    nepaliDate, // "2081-10-15"  — ISO-like BS string
    nepaliMonth: npMonth, // 1-12
    nepaliYear: npYear, // e.g. 2081
  };
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
