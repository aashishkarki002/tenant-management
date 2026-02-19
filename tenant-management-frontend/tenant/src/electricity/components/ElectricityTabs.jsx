import React from "react";
import { Button } from "@/components/ui/button";

/**
 * Tab definitions: maps display label → activeTab value → meterType key.
 * Keeping this in one place means adding a new type only requires one edit.
 */
const TABS = [
  { label: "All", value: "all", typeKey: null },
  { label: "Units", value: "", typeKey: "unit" },
  { label: "Common Area", value: "Common Area", typeKey: "common_area" },
  { label: "Parking", value: "Parking", typeKey: "parking" },
  { label: "Sub-Meter", value: "Sub-Meter", typeKey: "sub_meter" },
];

/**
 * @param {Object} props
 * @param {string} props.activeTab
 * @param {Function} props.onTabChange
 * @param {number} [props.flaggedCount]
 * @param {Object} [props.countsByType] - { unit, common_area, parking, sub_meter }
 *   Counts come from useSubMeterTypes() so badges reflect actual DB meters.
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
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${isActive
                ? "bg-gray-200 text-black"
                : "bg-transparent text-gray-600 hover:bg-gray-100"
              }`}
          >
            {tab.label}
            {/* Show count badge only when count > 0 */}
            {count != null && count > 0 && (
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${isActive
                    ? "bg-gray-400 text-white"
                    : "bg-gray-200 text-gray-600"
                  }`}
              >
                {count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}