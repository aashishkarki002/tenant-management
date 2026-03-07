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
    <div className="flex gap-1 mb-4 flex-wrap border-b border-[#F0EDE9] pb-3">
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
                ? "bg-[#3D1414] text-white"
                : "text-[#948472] hover:bg-[#F0EDE9] hover:text-[#625848]"
              }`}
          >
            {tab.label}
            {count != null && count > 0 && (
              <span
                className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none
                  ${isActive
                    ? "bg-white/20 text-white"
                    : "bg-[#F0EDE9] text-[#948472]"
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
              ? "bg-red-600 text-white"
              : "text-red-500 hover:bg-red-50"
            }`}
        >
          Flagged
          <span
            className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none
              ${activeTab === "flagged"
                ? "bg-white/20 text-white"
                : "bg-red-100 text-red-600"
              }`}
          >
            {flaggedCount}
          </span>
        </button>
      )}
    </div>
  );
}
