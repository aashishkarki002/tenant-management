import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ElectricityTabs } from "./ElectricityTabs";
import { ElectricityTableRow } from "./ElectricityTableRow";
import { ElectricityPagination } from "./ElectricityPagination";
import { isFlagged } from "../utils/electricityCalculations";
import { filterReadingsByTab } from "../utils/useSubMeterTypes";
import { PAGE_SIZE } from "../utils/electricityConstants";

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

  return (
    <Card className="rounded-lg shadow-lg mt-4 bg-white">
      <CardContent className="p-5">
        {/* Tabs */}
        <div className="mb-4">
          <ElectricityTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            flaggedCount={flaggedCount}
            countsByType={countsByType}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading…</div>
          ) : filteredData.length === 0 && newRows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No data for this category
            </div>
          ) : (
            <table className="w-full table-auto border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Name",
                    "Type",
                    "Building",
                    "Block",
                    "Prev (kWh)",
                    "Curr (kWh)",
                    "Consumption",
                    "Bill",
                    "Status",
                    "Action",
                    "Receipt",
                    "Reading Date",
                  ].map((col) => (
                    <th
                      key={col}
                      className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
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
          )}
        </div>

        {/* Pagination */}
        {filteredData.length > PAGE_SIZE && (
          <div className="mt-4">
            <ElectricityPagination
              currentPage={currentPage}
              totalItems={filteredData.length}
              onPageChange={onPageChange}
              pageSize={PAGE_SIZE}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
