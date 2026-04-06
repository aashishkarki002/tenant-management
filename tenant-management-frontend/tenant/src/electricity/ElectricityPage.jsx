import React, { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import useProperty from "../hooks/use-property";
import { useUnits } from "../hooks/use-units";
import { useElectricityData } from "./hooks/useElectricityData";
import { useNewElectricityRows } from "./hooks/useNewElectricityRows";
import { ElectricityKpiCards } from "./components/ElectricityKpiCards";
import { ElectricityFilters } from "./components/ElectricityFilters";
import { ElectricitySummaryCards } from "./components/ElectricitySummaryCards";
import { ElectricityInsights } from "./components/ElectricityInsights";
import { ElectricityTable } from "./components/ElectricityTable";
import ElectricityReadingDialog from "./components/ElectricityReadingDialog";
import {
  getConsumption,
  formatConsumption,
  getTrendPercent,
  deriveElectricityMetrics,
} from "./utils/electricityCalculations";
import {
  getCurrentBillingPeriod,
  labelForPeriod,
} from "@/utils/nepaliDate";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, Download, Settings, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

function buildDefaultFilterValues() {
  const { nepaliYear, nepaliMonth } = getCurrentBillingPeriod();
  return { blockId: "all", innerBlockId: "", month: nepaliMonth, year: nepaliYear };
}

export default function ElectricityPage() {
  const { property } = useProperty();
  const { units } = useUnits({ occupied: true });
  const navigate = useNavigate();

  const [filterValues, setFilterValues] = useState(buildDefaultFilterValues);
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Derived property data ────────────────────────────────────────────────

  const allBlocks = useMemo(() => {
    if (!property || !Array.isArray(property)) return [];
    return property.flatMap((prop) => prop.blocks ?? []);
  }, [property]);

  const selectedBlock = useMemo(
    () => allBlocks.find((b) => b._id === filterValues.blockId),
    [allBlocks, filterValues.blockId]
  );

  const propertyIdFromBlock = useMemo(() => {
    if (!filterValues.blockId || filterValues.blockId === "all") return undefined;
    if (!property || !Array.isArray(property)) return undefined;
    for (const prop of property) {
      if (prop.blocks?.some((b) => b._id === filterValues.blockId)) return prop._id;
    }
    return undefined;
  }, [filterValues.blockId, property]);

  const apiFilters = useMemo(
    () => ({
      propertyId: propertyIdFromBlock ?? undefined,
      blockId: filterValues.blockId && filterValues.blockId !== "all" ? filterValues.blockId : undefined,
      innerBlockId: filterValues.innerBlockId || undefined,
      nepaliYear: filterValues.year,
      nepaliMonth: filterValues.month,
      meterType: activeTab === "all" ? undefined : activeTab,
      searchQuery: searchQuery.trim() || undefined,
    }),
    [
      propertyIdFromBlock,
      filterValues.blockId,
      filterValues.innerBlockId,
      filterValues.year,
      filterValues.month,
      activeTab,
      searchQuery,
    ]
  );

  const { grouped, summary, loading, refetch } = useElectricityData(apiFilters);

  const { readings, countsByType } = useMemo(
    () => deriveElectricityMetrics(grouped, activeTab),
    [grouped, activeTab]
  );

  const { newRows, updateNewRow, removeNewRow } = useNewElectricityRows({
    readings,
    units: Array.isArray(units) ? units : [],
  });

  const availableInnerBlocks = useMemo(
    () => (Array.isArray(selectedBlock?.innerBlocks) ? selectedBlock.innerBlocks : []),
    [selectedBlock]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleFilterChange = useCallback((field, value) => {
    setFilterValues((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  const periodLabel = useMemo(
    () => labelForPeriod({ nepaliYear: filterValues.year, nepaliMonth: filterValues.month }),
    [filterValues.month, filterValues.year]
  );

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExportReport = useCallback(() => {
    if (!readings.length) {
      toast.error("No readings to export.");
      return;
    }
    const escapeCsv = (val) => {
      const s = String(val ?? "");
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows = [];
    rows.push("Electricity Report", periodLabel, "");
    rows.push("Total Readings,Total Consumption (kWh),Total Amount (Rs)");
    rows.push(
      [summary.totalReadings ?? 0, summary.grandTotalUnits ?? 0, summary.grandTotalAmount ?? 0].join(",")
    );
    rows.push("");
    rows.push("Meter Type,Unit/Meter Name,Previous (kWh),Current (kWh),Consumption (kWh),Status,Trend (%)");

    readings.forEach((record, index) => {
      const name =
        record.unit?.name ?? record.unit?.unitName ?? record.subMeter?.name ?? `Row ${index + 1}`;
      const prev = Number(record.previousReading) || 0;
      const curr = Number(record.currentReading) || 0;
      const consumption = Number(record.unitsConsumed) || getConsumption(record);
      const status = record.status || "pending";
      const trend = getTrendPercent(consumption, prev);
      const trendSign = parseFloat(trend) > 0 ? "+" : "";
      rows.push(
        [
          escapeCsv(record.meterType ?? "unit"),
          escapeCsv(name),
          prev > 0 ? prev.toFixed(1) : "",
          curr > 0 ? curr.toFixed(1) : "",
          consumption > 0 ? formatConsumption(consumption) : "",
          status,
          prev > 0 ? `${trendSign}${trend}` : "",
        ].join(",")
      );
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `electricity-report-${periodLabel.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported.");
  }, [readings, summary, periodLabel]);

  // ── Header slot ───────────────────────────────────────────────────────────

  useHeaderSlot(
    () => (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
        <div style={{ flex: 1, maxWidth: "400px", position: "relative" }}>
          <Search
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "14px",
              height: "14px",
              color: "var(--color-text-sub)",
              pointerEvents: "none",
            }}
          />
          <Input
            type="text"
            placeholder="Search by unit, area, or status…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ height: "34px", paddingLeft: "32px", paddingRight: searchQuery ? "32px" : "12px", fontSize: "13px" }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-sub)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X style={{ width: "13px", height: "13px" }} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
          <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
            <PlusIcon style={{ width: "12px", height: "12px" }} />
            <span className="hidden sm:inline" style={{ marginLeft: "6px" }}>Add Reading</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExportReport}>
            <Download style={{ width: "12px", height: "12px" }} />
            <span className="hidden sm:inline" style={{ marginLeft: "6px" }}>Export</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/submeter")}>
            <Settings style={{ width: "12px", height: "12px" }} />
            <span className="hidden sm:inline" style={{ marginLeft: "6px" }}>Submeters</span>
          </Button>
        </div>
      </div>
    ),
    [searchQuery, handleExportReport, navigate]
  );

  const handleOpenAddReading = useCallback(() => setDialogOpen(true), []);

  // ── Render ────────────────────────────────────────────────────────────────
  //
  // Layout strategy:
  //   The page fills the remaining viewport height (100dvh minus header height).
  //   The upper section (KPIs + filters + summary + insights) has a fixed natural
  //   height. The table below is flex: 1, so it takes all remaining space and
  //   scrolls internally — the user never needs to scroll the page itself.

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",           // fills the content area below the app header
        minHeight: 0,
        backgroundColor: "var(--color-background)",
      }}
    >
      <ElectricityReadingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        allBlocks={allBlocks}
        property={property}
        onSaved={refetch}
      />

      {/* ── Fixed upper section ──────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: "16px 20px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {/* Page title row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--color-text-strong)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Electricity
            </h1>
            <p style={{ fontSize: "13px", color: "var(--color-text-sub)", marginTop: "2px" }}>
              Consumption, billing and meter readings
            </p>
          </div>
          {periodLabel && (
            <div
              style={{
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                padding: "6px 14px",
                textAlign: "right",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--color-text-sub)",
                  marginBottom: "2px",
                }}
              >
                Current Period
              </p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-strong)" }}>
                {periodLabel}
              </p>
            </div>
          )}
        </div>

        {/* KPIs */}
        <ElectricityKpiCards grouped={grouped} summary={summary} />

        {/* Filters */}
        <ElectricityFilters
          filterValues={filterValues}
          onChange={handleFilterChange}
          allBlocks={allBlocks}
          availableInnerBlocks={availableInnerBlocks}
        />

        {/* Summary */}
        <ElectricitySummaryCards grouped={grouped} summary={summary} />

        {/* Insights — full-width row below summary */}
        <ElectricityInsights grouped={grouped} />

        {/* Search result banner */}
        {searchQuery && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "8px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Search style={{ width: "13px", height: "13px", color: "var(--color-text-sub)" }} />
              <p style={{ fontSize: "13px", color: "var(--color-text-body)" }}>
                <span style={{ fontWeight: 700 }}>{readings.length}</span> result
                {readings.length !== 1 ? "s" : ""} for{" "}
                <span style={{ fontWeight: 600, color: "var(--color-accent)" }}>"{searchQuery}"</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                fontSize: "12px",
                cursor: "pointer",
                color: "var(--color-text-sub)",
                textDecoration: "underline",
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── Table — fills all remaining height, scrolls internally ─────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: "0 20px 16px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ElectricityTable
          loading={loading}
          readings={readings}
          newRows={newRows}
          units={Array.isArray(units) ? units : []}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onUpdateNewRow={updateNewRow}
          onRemoveNewRow={removeNewRow}
          onPaymentRecorded={refetch}
          countsByType={countsByType}
          onAddReading={handleOpenAddReading}
        />
      </div>
    </div>
  );
}