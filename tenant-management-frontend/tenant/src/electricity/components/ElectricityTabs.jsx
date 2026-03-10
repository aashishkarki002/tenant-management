import React from "react";

const TABS = [
  { label: "All", value: "all", typeKey: null },
  { label: "Units", value: "unit", typeKey: "unit" },
  { label: "Common Area", value: "common_area", typeKey: "common_area" },
  { label: "Parking", value: "parking", typeKey: "parking" },
  { label: "Sub-Meter", value: "sub_meter", typeKey: "sub_meter" },
];

export function ElectricityTabs({
  activeTab,
  onTabChange,
  flaggedCount = 0,
  countsByType = {},
}) {
  return (
    <div className="flex gap-1 mb-4 flex-wrap border-b border-muted-fill pb-3">
      {TABS.map((tab) => {
        const count = tab.typeKey ? (countsByType[tab.typeKey] ?? 0) : null;
        const isActive = activeTab === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5
              ${isActive
                ? "bg-accent text-white"
                : "text-text-sub hover:bg-muted-fill hover:text-text-strong"
              }`}
          >
            {tab.label}
            {count != null && count > 0 && (
              <span
                className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none
                  ${isActive
                    ? "bg-white/20 text-white"
                    : "bg-muted-fill text-text-sub"
                  }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}

      {flaggedCount > 0 && (
        <button
          type="button"
          onClick={() => onTabChange("flagged")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5
            ${activeTab === "flagged"
              ? "bg-danger text-white"
              : "text-danger hover:bg-danger-bg"
            }`}
        >
          Flagged
          <span
            className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none
              ${activeTab === "flagged"
                ? "bg-white/20 text-white"
                : "bg-danger-bg text-danger"
              }`}
          >
            {flaggedCount}
          </span>
        </button>
      )}
    </div>
  );
}
