import React from "react";
import { Button } from "@/components/ui/button";

/**
 * Tab definitions — maps display label to activeTab key and meterType.
 *
 * Industry note: tab values must NEVER be empty strings — falsy values
 * cause silent bugs in conditional checks (e.g. `if (activeTab)` skips "unit").
 * Use explicit string keys that match what filterReadingsByTab expects.
 */
const TABS = [
  { label: "All", value: "all", typeKey: null },
  { label: "Units", value: "unit", typeKey: "unit" },
  { label: "Common Area", value: "common_area", typeKey: "common_area" },
  { label: "Parking", value: "parking", typeKey: "parking" },
  { label: "Sub-Meter", value: "sub_meter", typeKey: "sub_meter" },
];

/**
 * @param {Object} props
 * @param {string} props.activeTab         — one of the tab values above
 * @param {Function} props.onTabChange
 * @param {number}  [props.flaggedCount]
 * @param {Object}  [props.countsByType]   — { unit, common_area, parking, sub_meter }
 */
export function ElectricityTabs({
  activeTab,
  onTabChange,
  flaggedCount = 0,
  countsByType = {},
}) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {TABS.map((tab) => {
        const count = tab.typeKey ? (countsByType[tab.typeKey] ?? 0) : null;
        const isActive = activeTab === tab.value;

        return (
          <Button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5
              ${isActive ? "bg-gray-200 text-black" : "bg-transparent text-gray-600 hover:bg-gray-100"}`}
          >
            {tab.label}
            {count != null && count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold
                ${isActive ? "bg-gray-400 text-white" : "bg-gray-200 text-gray-600"}`}>
                {count}
              </span>
            )}
          </Button>
        );
      })}

      {/* Flagged tab — only rendered when there are flagged readings */}
      {flaggedCount > 0 && (
        <Button
          type="button"
          onClick={() => onTabChange("flagged")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5
            ${activeTab === "flagged" ? "bg-red-100 text-red-700" : "bg-transparent text-red-500 hover:bg-red-50"}`}
        >
          ⚑ Flagged
          <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold
            ${activeTab === "flagged" ? "bg-red-300 text-white" : "bg-red-100 text-red-600"}`}>
            {flaggedCount}
          </span>
        </Button>
      )}
    </div>
  );
}