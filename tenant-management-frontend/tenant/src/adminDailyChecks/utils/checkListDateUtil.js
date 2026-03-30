/**
 * checklistDateUtils.js
 *
 * All date formatting helpers for the checklist history UI.
 * Keeps date logic out of components.
 */

const NEPALI_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

const NEPALI_MONTHS_SHORT = [
  "Bai",
  "Jes",
  "Ash",
  "Shr",
  "Bha",
  "Ash",
  "Kar",
  "Man",
  "Pou",
  "Mag",
  "Fal",
  "Cha",
];

/**
 * "2082-09-14" → { year: 2082, month: 9, day: 14 }
 */
function parseNepaliISO(nepaliDate) {
  if (!nepaliDate || typeof nepaliDate !== "string") return null;
  const parts = nepaliDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  return { year, month, day };
}

/**
 * "2082-09-14" → "14 Poush 2082"
 * Used as the main date heading in history cards.
 */
export function formatNepaliDateLong(nepaliDate) {
  const parsed = parseNepaliISO(nepaliDate);
  if (!parsed) return "Unknown date";
  const { year, month, day } = parsed;
  const monthName = NEPALI_MONTHS[month - 1] ?? "Unknown";
  return `${day} ${monthName} ${year}`;
}

/**
 * "2082-09-14" → "14 Pou 2082"
 * Compact version for tight spaces.
 */
export function formatNepaliDateShort(nepaliDate) {
  const parsed = parseNepaliISO(nepaliDate);
  if (!parsed) return "—";
  const { year, month, day } = parsed;
  const monthName = NEPALI_MONTHS_SHORT[month - 1] ?? "???";
  return `${day} ${monthName} ${year}`;
}

/**
 * "2082-09-14" → "Poush 2082"
 * Month + year only, for section headers.
 */
export function formatNepaliMonthYear(nepaliDate) {
  const parsed = parseNepaliISO(nepaliDate);
  if (!parsed) return "—";
  const { year, month } = parsed;
  return `${NEPALI_MONTHS[month - 1]} ${year}`;
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
 * Used to show/hide month separators in the list.
 */
export function isSameNepaliMonth(dateA, dateB) {
  const a = parseNepaliISO(dateA);
  const b = parseNepaliISO(dateB);
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month;
}
