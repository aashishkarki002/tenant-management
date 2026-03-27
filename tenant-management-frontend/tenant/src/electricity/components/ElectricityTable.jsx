import React from "react";
import { ElectricityTableRow } from "./ElectricityTableRow";
import { ElectricityPagination } from "./ElectricityPagination";
import { isFlagged } from "../utils/electricityCalculations";
import { PAGE_SIZE } from "../utils/electricityConstants";
import { Zap, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const TABS = [
  { label: "All", value: "all", typeKey: null },
  { label: "Units", value: "unit", typeKey: "unit" },
  { label: "Common Area", value: "common_area", typeKey: "common_area" },
  { label: "Parking", value: "parking", typeKey: "parking" },
  { label: "Sub-Meter", value: "sub_meter", typeKey: "sub_meter" },
];

export function ElectricityTable({
  loading,
  readings = [],
  newRows = [],
  units = [],
  activeTab,
  onTabChange,
  currentPage,
  onPageChange,
  onUpdateNewRow,
  onRemoveNewRow,
  onPaymentRecorded,
  countsByType = {},
  onAddReading,
}) {
  const filteredData = React.useMemo(() => {
    if (activeTab === "flagged") {
      return readings.filter((r) => isFlagged(r));
    }
    return readings;
  }, [readings, activeTab]);

  const flaggedCount = React.useMemo(
    () => readings.filter((r) => isFlagged(r)).length,
    [readings]
  );

  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const COLUMNS = [
    "Name",
    "Type",
    "Building",
    "Prev (kWh)",
    "Curr (kWh)",
    "Consumption",
    "Bill Amount",
    "Status",
    "Reading Date",
    "Actions",
  ];

  return (
    <div className="bg-surface-raised rounded-xl border border-muted-fill overflow-hidden">
      {/* Header bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-muted-fill">
        <h3 className="text-sm font-semibold text-text-strong">Meter Readings</h3>
        <span className="text-xs text-text-sub">
          {filteredData.length} {filteredData.length === 1 ? "reading" : "readings"}
        </span>
      </div>

      <div className="px-5 py-4">
        {/* Tabs */}
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
                    ? "bg-primary text-primary-foreground"
                    : "text-text-sub hover:bg-muted-fill hover:text-text-strong"
                  }`}
              >
                {tab.label}
                {count != null && count > 0 && (
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none
                      ${isActive
                        ? "bg-primary/20 text-primary"
                        : "bg-primary/20 text-primary"
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
                  ? "bg-destructive text-destructive-foreground"
                  : "text-destructive hover:bg-destructive"
                }`}
            >
              Flagged
              <span
                className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none
                  ${activeTab === "flagged"
                    ? "bg-primary/20 text-primary"
                    : "bg-destructive text-destructive-foreground"
                  }`}
              >
                {flaggedCount}
              </span>
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-sub">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading readings...</span>
          </div>
        ) : filteredData.length === 0 && newRows.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted-fill flex items-center justify-center mb-4">
              <Zap className="w-7 h-7 text-text-sub" />
            </div>
            <h4 className="text-base font-semibold text-text-strong mb-1">
              No electricity readings recorded
            </h4>
            <p className="text-sm text-text-sub mb-5 max-w-sm">
              No electricity readings have been recorded for this billing period.
              Start by adding your first reading.
            </p>
            {onAddReading && (
              <Button
                type="button"
                onClick={onAddReading}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 py-2.5"
              >
                <PlusCircle className="w-4 h-4" />
                Add First Reading
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-muted-fill mt-1">
            <table className="w-full table-auto border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-muted-fill">
                  {COLUMNS.map((col) => (
                    <th
                      key={col}
                      className="py-2.5 px-4 text-left text-[10px] font-bold text-text-sub uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-fill">
                {paginatedData.map((record, index) => (
                  <ElectricityTableRow
                    key={record._id ?? index}
                    record={record}
                    index={(currentPage - 1) * PAGE_SIZE + index}
                    onPaymentRecorded={onPaymentRecorded}
                    countsByType={countsByType}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredData.length > PAGE_SIZE && (
          <ElectricityPagination
            currentPage={currentPage}
            totalItems={filteredData.length}
            onPageChange={onPageChange}
            pageSize={PAGE_SIZE}
          />
        )}
      </div>
    </div>
  );
}
