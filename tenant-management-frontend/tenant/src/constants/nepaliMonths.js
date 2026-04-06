/**
 * Nepali calendar months (Bikram Sambat) — re-exported from shared util.
 */
import { getNepaliMonthOptions, getCurrentNepaliMonthYear } from "@/utils/nepaliDate";

export const NEPALI_MONTHS = getNepaliMonthOptions({ lang: "en" });

export { getCurrentNepaliMonthYear };
