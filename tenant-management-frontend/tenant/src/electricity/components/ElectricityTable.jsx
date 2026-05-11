import React from "react";
import { ElectricityTableRow } from "./ElectricityTableRow";
import { ElectricityPagination } from "./ElectricityPagination";
import { isFlagged } from "../utils/electricityCalculations";
import { PAGE_SIZE } from "../utils/electricityConstants";
import { Zap, PlusCircle, Loader2 } from "lucide-react";

const TABS = [
  { label: "All", value: "all", typeKey: null },
  { label: "Units", value: "unit", typeKey: "unit" },
  { label: "Common Area", value: "common_area", typeKey: "common_area" },
  { label: "Parking", value: "parking", typeKey: "parking" },
  { label: "Sub-Meter", value: "sub_meter", typeKey: "sub_meter" },
];

const COLUMNS = [
  { label: "Name", width: "160px" },
  { label: "Type", width: "100px" },
  { label: "Building", width: "130px" },
  { label: "Prev (kWh)", width: "90px" },
  { label: "Curr (kWh)", width: "90px" },
  { label: "Consumption", width: "110px" },
  { label: "Bill Amount", width: "100px" },
  { label: "Status", width: "90px" },
  { label: "Reading Date", width: "110px" },
  { label: "", width: "90px" },
];

export function ElectricityTable({
  loading,
  readings = [],
  activeTab,
  onTabChange,
  currentPage,
  onPageChange,
  onPaymentRecorded,
  onEditReading,
  countsByType = {},
  onAddReading,
}) {
  const filteredData = React.useMemo(() => {
    if (activeTab === "flagged") return readings.filter((r) => isFlagged(r));
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-strong)", margin: 0 }}>
            Meter Readings
          </h3>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "2px" }}>
            {TABS.map((tab) => {
              const count = tab.typeKey ? (countsByType[tab.typeKey] ?? 0) : null;
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onTabChange(tab.value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-md)",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    backgroundColor: isActive ? "var(--color-accent)" : "transparent",
                    color: isActive ? "#fff" : "var(--color-text-sub)",
                    transition: "background-color 0.1s, color 0.1s",
                  }}
                >
                  {tab.label}
                  {count != null && count > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: "99px",
                        backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "var(--color-muted-fill)",
                        color: isActive ? "#fff" : "var(--color-text-sub)",
                        lineHeight: 1.4,
                      }}
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: activeTab === "flagged" ? "var(--color-danger)" : "transparent",
                  color: activeTab === "flagged" ? "#fff" : "var(--color-danger)",
                }}
              >
                Flagged
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "99px",
                    backgroundColor: "var(--color-danger-bg)",
                    color: "var(--color-danger)",
                    lineHeight: 1.4,
                  }}
                >
                  {flaggedCount}
                </span>
              </button>
            )}
          </div>
        </div>

        <span style={{ fontSize: "12px", color: "var(--color-text-sub)" }}>
          {filteredData.length} {filteredData.length === 1 ? "reading" : "readings"}
        </span>
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "auto" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "64px 24px",
              color: "var(--color-text-sub)",
            }}
          >
            <Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "13px", fontWeight: 500 }}>Loading readings…</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-lg)",
                backgroundColor: "var(--color-muted-fill)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Zap style={{ width: "22px", height: "22px", color: "var(--color-text-sub)" }} />
            </div>
            <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-strong)", marginBottom: "6px" }}>
              No readings recorded
            </h4>
            <p style={{ fontSize: "13px", color: "var(--color-text-sub)", marginBottom: "20px", maxWidth: "320px" }}>
              No electricity readings for this billing period. Add your first reading to get started.
            </p>
            {onAddReading && (
              <button
                type="button"
                onClick={onAddReading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  backgroundColor: "var(--color-accent)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <PlusCircle style={{ width: "14px", height: "14px" }} />
                Add First Reading
              </button>
            )}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--color-surface)", position: "sticky", top: 0, zIndex: 1 }}>
                {COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    style={{
                      padding: "9px 14px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "var(--color-text-sub)",
                      borderBottom: "1px solid var(--color-border)",
                      whiteSpace: "nowrap",
                      width: col.width,
                    }}
                  >
                    {col.label}
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
                  onEditReading={onEditReading}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination — pinned to bottom */}
      {filteredData.length > PAGE_SIZE && (
        <div
          style={{
            padding: "0 16px 12px",
            flexShrink: 0,
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <ElectricityPagination
            currentPage={currentPage}
            totalItems={filteredData.length}
            onPageChange={onPageChange}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}
    </div>
  );
}