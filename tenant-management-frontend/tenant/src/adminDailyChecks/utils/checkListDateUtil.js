/**
 * checklistDateUtils.js
 *
 * Date formatting helpers for the checklist history UI.
 */

import {
  tryParseNepaliISO,
  formatNepaliDisplayNoComma,
  NEPALI_MONTH_NAMES,
  NEPALI_MONTH_SHORT,
} from "@/utils/nepaliDate";

/**
 * "2082-09-14" → "14 Poush 2082"
 * Used as the main date heading in history cards.
 */
export function formatNepaliDateLong(nepaliDate) {
  const parsed = tryParseNepaliISO(nepaliDate);
  if (!parsed) return "Unknown date";
  return formatNepaliDisplayNoComma(parsed);
}

/**
 * "2082-09-14" → "14 Pou 2082"
 * Compact version for tight spaces.
 */
export function formatNepaliDateShort(nepaliDate) {
  const parsed = tryParseNepaliISO(nepaliDate);
  if (!parsed) return "—";
  const { year, month, day } = parsed;
  const monthName = NEPALI_MONTH_SHORT[month - 1] ?? "???";
  return `${day} ${monthName} ${year}`;
}

/**
 * "2082-09-14" → "Poush 2082"
 * Month + year only, for section headers.
 */
export function formatNepaliMonthYear(nepaliDate) {
  const parsed = tryParseNepaliISO(nepaliDate);
  if (!parsed) return "—";
  const { year, month } = parsed;
  return `${NEPALI_MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * ISO string or Date → "Mon, 27 Jan 2026"
 * English date shown as secondary label below Nepali date.
 */
export function formatEnglishDate(dateInput) {
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * ISO string or Date → "10:30 AM"
 */
export function formatTime(dateInput) {
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/**
 * Returns true if two nepaliDate strings share the same month+year.
 */
export function isSameNepaliMonth(dateA, dateB) {
  const a = tryParseNepaliISO(dateA);
  const b = tryParseNepaliISO(dateB);
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month;
}
