/**
 * nepaliMonthQuarter.js
 *
 * Thin backward-compat wrapper.
 * Source of truth: src/config/fiscalCalendar.js
 *
 * @deprecated  Import getFiscalQuarterMonths directly from config/fiscalCalendar.js
 *              in new code.
 */
export { getFiscalQuarterMonths as getMonthsInQuarter } from "../config/fiscalCalendar.js";
