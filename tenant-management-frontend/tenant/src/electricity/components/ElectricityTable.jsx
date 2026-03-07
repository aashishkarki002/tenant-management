import React from "react";
import { ElectricityTabs } from "./ElectricityTabs";
import { ElectricityTableRow } from "./ElectricityTableRow";
import { ElectricityPagination } from "./ElectricityPagination";
import { isFlagged } from "../utils/electricityCalculations";
import { filterReadingsByTab } from "../utils/useSubMeterTypes";
import { PAGE_SIZE } from "../utils/electricityConstants";
import { Zap, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    const byTab = filterReadingsByTab(readings, activeTab);
    if (activeTab === "flagged") return byTab.filter((r) => isFlagged(r));
    return byTab;
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
    <div className="bg-white rounded-xl border border-[#E8E4E0] overflow-hidden">
      {/* Header bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#F0EDE9]">
        <h3 className="text-sm font-semibold text-[#1C1A18]">Meter Readings</h3>
        <span className="text-xs text-[#948472]">
          {filteredData.length} {filteredData.length === 1 ? "reading" : "readings"}
        </span>
      </div>

      <div className="px-5 py-4">
        {/* Tabs */}
        <ElectricityTabs
          activeTab={activeTab}
          onTabChange={onTabChange}
          flaggedCount={flaggedCount}
          countsByType={countsByType}
        />

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[#948472]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading readings...</span>
          </div>
        ) : filteredData.length === 0 && newRows.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F0EDE9] flex items-center justify-center mb-4">
              <Zap className="w-7 h-7 text-[#948472]" />
            </div>
            <h4 className="text-base font-semibold text-[#1C1A18] mb-1">
              No electricity readings recorded
            </h4>
            <p className="text-sm text-[#948472] mb-5 max-w-sm">
              No electricity readings have been recorded for this billing period.
              Start by adding your first reading.
            </p>
            {onAddReading && (
              <Button
                type="button"
                onClick={onAddReading}
                className="flex items-center gap-2 bg-[#3D1414] text-white hover:bg-[#2D0E0E] rounded-lg px-5 py-2.5"
              >
                <PlusCircle className="w-4 h-4" />
                Add First Reading
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E8E4E0] mt-1">
            <table className="w-full table-auto border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#FAFAF8]">
                  {COLUMNS.map((col) => (
                    <th
                      key={col}
                      className="py-2.5 px-4 text-left text-[10px] font-bold text-[#948472] uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE9]">
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
