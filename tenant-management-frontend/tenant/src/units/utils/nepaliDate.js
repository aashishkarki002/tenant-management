import { getTodayNepali, NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";

export function getNepaliDate() {
  const t = getTodayNepali();
  return `${NEPALI_MONTH_NAMES[t.month - 1]} ${t.day}, ${t.year}`;
}
