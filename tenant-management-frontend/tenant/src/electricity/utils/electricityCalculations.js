/**
 * Electricity consumption and trend helpers.
 */

/**
 * Get consumption from a record (either stored or prev/curr difference).
 * @param {{ consumption?: number, previousReading?: number, currentReading?: number }} record
 * @returns {number}
 */
export function getConsumption(record) {
  if (record.consumption != null && !Number.isNaN(record.consumption)) {
    return Number(record.consumption);
  }
  const prev = Number(record.previousReading) || 0;
  const curr = Number(record.currentReading) || 0;
  return curr - prev;
}

/**
 * Check if record is flagged (high usage) based on consumption threshold.
 * @param {Object} record
 * @param {number} threshold
 * @returns {boolean}
 */
export function isFlagged(record, threshold = 200) {
  return getConsumption(record) > threshold;
}

/**
 * Trend percentage: (consumption / previousReading - 1) * 100.
 * @param {number} consumption
 * @param {number} previousReading
 * @returns {string} e.g. "+5.2" or "0.0"
 */
export function getTrendPercent(consumption, previousReading) {
  if (!previousReading || previousReading <= 0) return "0.0";
  const ratio = consumption / previousReading;
  return (((ratio - 1) * 100)).toFixed(1);
}

/**
 * Format consumption for display (one decimal).
 * @param {number} value
 * @returns {string}
 */
export function formatConsumption(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Derive electricity view metrics from grouped API data.
 * Keeps hook/store data raw and centralizes UI-ready derivations.
 * @param {Object} grouped
 * @param {string} activeTab
 * @returns {{ readings: Array, countsByType: Object }}
 */
export function deriveElectricityMetrics(grouped = {}, activeTab = "all") {
  const meterTypeKeys = ["unit", "common_area", "parking", "sub_meter"];

  const countsByType = {
    unit: grouped.unit?.count ?? 0,
    common_area: grouped.common_area?.count ?? 0,
    parking: grouped.parking?.count ?? 0,
    sub_meter: grouped.sub_meter?.count ?? 0,
  };

  const readings =
    activeTab === "all"
      ? meterTypeKeys.flatMap((key) => grouped[key]?.readings ?? [])
      : grouped[activeTab]?.readings ?? [];

  return { readings, countsByType };
}
