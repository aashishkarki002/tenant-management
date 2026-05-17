// Helper functions for AccountingPage filter labels and draft validation.
// Extracted here to satisfy react-refresh/only-export-components — only
// non-component named exports may live in the same file as a component.
import { NEPALI_MONTH_NAMES, QUARTER_LABELS } from "../utils/nepaliCalendar";

export function buildCompareLabel(granularity, { year, quarter, month } = {}) {
    if (granularity === "year" && year)
        return `FY ${year}/${String(year + 1).slice(2)}`;
    if (granularity === "quarter" && quarter && year)
        return `Q${quarter} · ${QUARTER_LABELS[quarter]} · FY ${year}`;
    if (granularity === "month" && month && year)
        return `${NEPALI_MONTH_NAMES[month - 1]} ${month <= 3 ? year + 1 : year}`;
    return null;
}

export function isValidDraft(granularity, { year, quarter, month }) {
    if (granularity === "year") return !!year;
    if (granularity === "quarter") return !!quarter && !!year;
    if (granularity === "month") return !!month && !!year;
    return false;
}
