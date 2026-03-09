import React, { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import useProperty from "../hooks/use-property";
import { useUnits } from "../hooks/use-units";
import api from "../../plugins/axios";
import { useElectricityData } from "./hooks/useElectricityData";
import { useNewElectricityRows } from "./hooks/useNewElectricityRows";
import { ElectricityHeader } from "./components/ElectricityHeader";
import { ElectricityKpiCards } from "./components/ElectricityKpiCards";
import { ElectricityFilters } from "./components/ElectricityFilters";
import { ElectricitySummaryCards } from "./components/ElectricitySummaryCards";
import { ElectricityInsights } from "./components/ElectricityInsights";
import { ElectricityTable } from "./components/ElectricityTable";
import { createReading } from "./utils/electricityApi";
import {
  getConsumption,
  formatConsumption,
  getTrendPercent,
} from "./utils/electricityCalculations";
import { PAGE_SIZE } from "./utils/electricityConstants";
// ─── Single authoritative Nepali date source ──────────────────────────────────
// All date helpers flow through nepaliMonthBridge. Never import from
// plugins/useNepaliDate or @/constants/nepaliMonths inside this module tree.
import {
  getCurrentBillingPeriod,
  labelForPeriod,
} from "../../utils/nepaliMonthBridge";
// ─────────────────────────────────────────────────────────────────────────────
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, Download, Settings, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";


// ─── Constants ────────────────────────────────────────────────────────────────

const METER_TYPE_KEYS = ["unit", "common_area", "parking", "sub_meter"];

/**
 * Default filter = current Nepali billing month.
 * Uses the bridge so there's exactly one place that knows "what is now?".
 */
function buildDefaultFilterValues() {
  const { nepaliYear, nepaliMonth } = getCurrentBillingPeriod();
  return { blockId: "all", innerBlockId: "", month: nepaliMonth, year: nepaliYear };
}

function countsFromGrouped(grouped) {
  return {
    unit: grouped.unit?.count ?? 0,
    common_area: grouped.common_area?.count ?? 0,
    parking: grouped.parking?.count ?? 0,
    sub_meter: grouped.sub_meter?.count ?? 0,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ElectricityPage() {
  const { property } = useProperty();
  const { units } = useUnits({ occupied: true });
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [filterValues, setFilterValues] = useState(buildDefaultFilterValues);
  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Derived property data ─────────────────────────────────────────────────

  const allBlocks = useMemo(() => {
    if (!property || !Array.isArray(property)) return [];
    return property.flatMap((prop) => prop.blocks ?? []);
  }, [property]);

  const selectedBlock = useMemo(
    () => (allBlocks)
      .find((b) => b._id === filterValues.blockId),
    [allBlocks, filterValues.blockId],
  );

  const propertyIdFromBlock = useMemo(() => {
    if (!filterValues.blockId || filterValues.blockId === "all") return undefined;
    if (!property || !Array.isArray(property)) return undefined;
    for (const prop of property) {
      if (prop.blocks?.some((b) => b._id === filterValues.blockId)) return prop._id;
    }
    return undefined;
  }, [filterValues.blockId, property]);

  // ─── API filter — stable primitive values so the hook dep array is stable ──

  const apiFilters = useMemo(
    () => ({
      propertyId: propertyIdFromBlock ?? undefined,
      blockId:
        filterValues.blockId && filterValues.blockId !== "all"
          ? filterValues.blockId
          : undefined,
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
    ],
  );

  const { grouped, summary, loading, refetch } = useElectricityData(apiFilters);

  // ─── Flatten readings for the table ───────────────────────────────────────

  const readings = useMemo(() => {
    if (activeTab === "all") {
      return METER_TYPE_KEYS.flatMap((key) => grouped[key]?.readings ?? []);
    }
    return grouped[activeTab]?.readings ?? [];
  }, [grouped, activeTab]);

  const countsByType = useMemo(() => countsFromGrouped(grouped), [grouped]);

  const { newRows, addNewRow, updateNewRow, removeNewRow, clearNewRows } =
    useNewElectricityRows({
      readings,
      units: Array.isArray(units) ? units : [],
    });

  // ─── Tenants (for unitId → tenantId mapping during save) ──────────────────

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await api.get("/api/tenant/get-tenants");
        const data = res.data;
        if (data?.tenants)
          setTenants(Array.isArray(data.tenants) ? data.tenants : []);
      } catch (err) {
        console.error("Error fetching tenants:", err);
      }
    };
    fetchTenants();
  }, []);

  const unitIdToTenantId = useMemo(() => {
    const map = {};
    for (const tenant of tenants) {
      for (const u of tenant.units ?? []) {
        const id = typeof u === "object" ? u._id : u;
        if (id) map[id] = tenant._id;
      }
    }
    return map;
  }, [tenants]);

  const availableInnerBlocks = useMemo(
    () => (Array.isArray(selectedBlock?.innerBlocks) ? selectedBlock.innerBlocks : []),
    [selectedBlock],
  );

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleFilterChange = useCallback((field, value) => {
    setFilterValues((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  /**
   * Human-readable label derived from the bridge — single authoritative source.
   * e.g. "Mangsir 2081"
   */
  const periodLabel = useMemo(
    () => labelForPeriod({ nepaliYear: filterValues.year, nepaliMonth: filterValues.month }),
    [filterValues.month, filterValues.year],
  );

  // ─── Export ───────────────────────────────────────────────────────────────

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
      [summary.totalReadings ?? 0, summary.grandTotalUnits ?? 0, summary.grandTotalAmount ?? 0].join(","),
    );
    rows.push("");
    rows.push("Meter Type,Unit/Meter Name,Previous (kWh),Current (kWh),Consumption (kWh),Status,Trend (%)");

    readings.forEach((record, index) => {
      const name =
        record.unit?.name ??
        record.unit?.unitName ??
        record.subMeter?.name ??
        `Row ${index + 1}`;
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
        ].join(","),
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

  // ─── Header slot ──────────────────────────────────────────────────────────

  useHeaderSlot(
    () => (
      <div className="flex items-center gap-2 w-full">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[#AFA097]" />
          <Input
            type="text"
            placeholder="Search by unit, area, or status…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-9 text-sm rounded-lg border border-[#DDD6D0]
                       bg-[#F8F5F2] text-[#1C1A18] placeholder:text-[#C8BDB6]
                       outline-none transition-colors
                       focus:border-[#AFA097] focus:ring-2 focus:ring-[#3D1414]/10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AFA097] hover:text-[#3D1414] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportReport}
            className="border-[#DDD6D0] text-[#1C1A18] bg-white hover:bg-[#F8F5F2] hover:text-[#3D1414]"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Export</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="hover:opacity-90"
            style={{ background: "#3D1414", color: "#F0DADA" }}
          >
            <PlusIcon className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Add Reading</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/submeter")}
            className="border-[#DDD6D0] text-[#1C1A18] bg-white hover:bg-[#F8F5F2] hover:text-[#3D1414]"
          >
            <Settings className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Submeters</span>
          </Button>
        </div>
      </div>
    ),
    [searchQuery, handleExportReport, navigate],
  );

  // ─── Save inline rows ──────────────────────────────────────────────────────

  const handleSaveReadings = useCallback(async () => {
    const validRows = newRows.filter(
      (row) =>
        row.unitId &&
        row.currentUnit != null &&
        row.currentUnit !== "" &&
        parseFloat(row.currentUnit) >= parseFloat(row.previousUnit || "0"),
    );
    if (validRows.length === 0) {
      toast.error("Add at least one valid reading (unit, previous and current reading).");
      return;
    }
    const tenantIdMissing = validRows.find((row) => !unitIdToTenantId[row.unitId]);
    if (tenantIdMissing) {
      toast.error(
        "Selected unit has no tenant. Only units assigned to a tenant can have readings.",
      );
      return;
    }
    const now = new Date();
    setSaving(true);
    try {
      await Promise.all(
        validRows.map((row) =>
          createReading({
            meterType: "unit",
            tenantId: unitIdToTenantId[row.unitId],
            unitId: row.unitId,
            currentReading: parseFloat(row.currentUnit),
            previousReading: parseFloat(row.previousUnit || "0"),
            nepaliMonth: filterValues.month,
            nepaliYear: filterValues.year,
            nepaliDate: `${filterValues.year}-${String(filterValues.month).padStart(2, "0")}`,
            englishMonth: now.getMonth() + 1,
            englishYear: now.getFullYear(),
            readingDate: now.toISOString(),
          }),
        ),
      );
      toast.success(`${validRows.length} reading(s) saved.`);
      clearNewRows();
      refetch();
    } catch (err) {
      toast.error(err?.message || "Failed to save readings.");
    } finally {
      setSaving(false);
    }
  }, [newRows, unitIdToTenantId, filterValues.month, filterValues.year, clearNewRows, refetch]);

  const handleOpenAddReading = useCallback(() => setDialogOpen(true), []);

  // ─── Render ───────────────────────────────────────────────────────────────
  //
  // Industry note: do NOT wrap a whole page in <form>. <form> is for
  // discrete submit interactions. Using onSubmit={e => e.preventDefault()}
  // on a top-level wrapper is a smell — it makes every <button> a potential
  // accidental submitter and breaks accessibility/screen-reader semantics.
  // Inline-row saving is handled via an explicit onClick handler.

  return (
    <div className="min-h-screen pb-8" style={{ background: "#F8F5F2" }}>
      <div className="space-y-4 pt-5 px-4 sm:px-5">

        <ElectricityHeader
          onExportReport={handleExportReport}
          onAddReading={addNewRow}
          onSaveReadings={handleSaveReadings}
          onSaved={refetch}
          hasNewRows={newRows.length > 0}
          saving={saving}
          property={property}
          allBlocks={allBlocks}
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
        />

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#1C1A18] tracking-tight">
              Electricity Dashboard
            </h1>
            <p className="text-sm text-[#948472] mt-1">
              Monitor consumption, track billing, and manage meter readings across all properties
            </p>
          </div>
          {periodLabel && (
            <div className="bg-white rounded-lg border border-[#E8E4E0] px-4 py-2 shadow-sm">
              <p className="text-xs text-[#948472] font-medium uppercase tracking-wide">
                Current Period
              </p>
              <p className="text-base font-bold text-[#1C1A18] mt-0.5">{periodLabel}</p>
            </div>
          )}
        </div>

        {/* KPIs reflect whatever period the filter is set to */}
        <ElectricityKpiCards grouped={grouped} summary={summary} periodLabel={periodLabel} />

        <ElectricityFilters
          filterValues={filterValues}
          onChange={handleFilterChange}
          allBlocks={allBlocks}
          availableInnerBlocks={availableInnerBlocks}
          periodLabel={periodLabel}
        />

        <ElectricitySummaryCards grouped={grouped} summary={summary} />

        <ElectricityInsights grouped={grouped} />

        {searchQuery && (
          <div className="bg-white rounded-lg border border-[#E8E4E0] px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#948472]" />
              <p className="text-sm text-[#1C1A18]">
                Found <span className="font-bold">{readings.length}</span> result
                {readings.length !== 1 ? "s" : ""} for{" "}
                <span className="font-semibold text-[#3D1414]">"{searchQuery}"</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-[#948472] hover:text-[#3D1414] underline underline-offset-2 transition-colors"
            >
              Clear search
            </button>
          </div>
        )}

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