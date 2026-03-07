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
import { getMonthOptions } from "../../plugins/useNepaliDate";
import { getCurrentNepaliMonthYear } from "@/constants/nepaliMonths";
import { useHeaderSlot } from "../context/HeaderSlotContext";
import { GlobalSearch } from "../components/header";
import { Button } from "@/components/ui/button";
import { PlusIcon, Download, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const METER_TYPE_KEYS = ["unit", "common_area", "parking", "sub_meter"];

const buildDefaultFilterValues = () => {
  const { month, year } = getCurrentNepaliMonthYear();
  return { blockId: "all", innerBlockId: "", month, year };
};

const flattenGrouped = (grouped = {}) =>
  METER_TYPE_KEYS.flatMap((key) => grouped[key]?.readings ?? []);

const countsFromGrouped = (grouped = {}) => ({
  unit: grouped.unit?.count ?? 0,
  common_area: grouped.common_area?.count ?? 0,
  parking: grouped.parking?.count ?? 0,
  sub_meter: grouped.sub_meter?.count ?? 0,
});

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

  const allBlocks = useMemo(() => {
    if (!property || !Array.isArray(property)) return [];
    return property.flatMap((prop) => prop.blocks || []);
  }, [property]);

  const selectedBlock = useMemo(
    () => allBlocks.find((block) => block._id === filterValues.blockId),
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
      propertyId: propertyIdFromBlock || undefined,
      blockId:
        filterValues.blockId && filterValues.blockId !== "all"
          ? filterValues.blockId
          : undefined,
      innerBlockId: filterValues.innerBlockId || undefined,
      nepaliYear: filterValues.year,
      nepaliMonth: filterValues.month,
    }),
    [
      propertyIdFromBlock,
      filterValues.blockId,
      filterValues.innerBlockId,
      filterValues.year,
      filterValues.month,
    ]
  );

  const { grouped, summary, loading, refetch } = useElectricityData(apiFilters);

  const readings = useMemo(() => flattenGrouped(grouped), [grouped]);
  const countsByType = useMemo(() => countsFromGrouped(grouped), [grouped]);

  const { newRows, addNewRow, updateNewRow, removeNewRow, clearNewRows } =
    useNewElectricityRows({
      readings,
      units: Array.isArray(units) ? units : [],
    });

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await api.get("/api/tenant/get-tenants");
        const data = response.data;
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
      if (Array.isArray(tenant.units)) {
        for (const u of tenant.units) {
          const id = u?._id ?? u;
          if (id) map[id] = tenant._id;
        }
      }
    }
    return map;
  }, [tenants]);

  const availableInnerBlocks = useMemo(
    () =>
      Array.isArray(selectedBlock?.innerBlocks) ? selectedBlock.innerBlocks : [],
    [selectedBlock]
  );

  const handleFilterChange = useCallback((field, value) => {
    setFilterValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  const periodLabel = useMemo(() => {
    const monthOptions = getMonthOptions();
    const monthName =
      monthOptions.find((m) => m.value === filterValues.month)?.label ?? "Month";
    return `${monthName} ${filterValues.year}`;
  }, [filterValues.month, filterValues.year]);

  // Header slot — inject search + action buttons into the global header
  useHeaderSlot(
    () => (
      <div className="flex items-center gap-2 w-full">
        <div className="flex-1 max-w-xs">
          <GlobalSearch />
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
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
            className="border-[#DDD6D0] text-[#1C1A18] hover:bg-[#F8F5F2] hover:text-[#3D1414]"
          >
            <Settings className="w-3 h-3" />
            <span className="hidden sm:inline ml-1.5">Submeters</span>
          </Button>
        </div>
      </div>
    ),
    []
  );

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
      [
        summary.totalReadings ?? 0,
        summary.grandTotalUnits ?? 0,
        summary.grandTotalAmount ?? 0,
      ].join(",")
    );
    rows.push("");
    rows.push(
      "Meter Type,Unit/Meter Name,Previous (kWh),Current (kWh),Consumption (kWh),Status,Trend (%)"
    );
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

  const handleSaveReadings = useCallback(async () => {
    const validRows = newRows.filter(
      (row) =>
        row.unitId &&
        row.currentUnit != null &&
        row.currentUnit !== "" &&
        parseFloat(row.currentUnit) >= parseFloat(row.previousUnit || 0)
    );
    if (validRows.length === 0) {
      toast.error(
        "Add at least one valid reading (unit, previous and current reading)."
      );
      return;
    }
    const tenantIdMissing = validRows.find((row) => !unitIdToTenantId[row.unitId]);
    if (tenantIdMissing) {
      toast.error(
        "Selected unit has no tenant. Only units assigned to a tenant can have readings."
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
            previousReading: parseFloat(row.previousUnit || 0),
            nepaliMonth: filterValues.month,
            nepaliYear: filterValues.year,
            nepaliDate: `${filterValues.year}-${filterValues.month}`,
            englishMonth: now.getMonth() + 1,
            englishYear: now.getFullYear(),
            readingDate: now.toISOString(),
          })
        )
      );
      toast.success(`${validRows.length} reading(s) saved.`);
      clearNewRows();
      refetch();
    } catch (err) {
      toast.error(err?.message || "Failed to save readings.");
    } finally {
      setSaving(false);
    }
  }, [
    newRows,
    unitIdToTenantId,
    filterValues.month,
    filterValues.year,
    clearNewRows,
    refetch,
  ]);

  const handleOpenAddReading = useCallback(() => setDialogOpen(true), []);

  return (
    <div className="min-h-screen pb-8" style={{ background: "#F8F5F2" }}>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-4 pt-5">
          {/* 1. Page Title + Actions */}
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

          {/* 2. KPI Cards */}
          <ElectricityKpiCards grouped={grouped} summary={summary} />

          {/* 3. Filters */}
          <ElectricityFilters
            filterValues={filterValues}
            onChange={handleFilterChange}
            allBlocks={allBlocks}
            availableInnerBlocks={availableInnerBlocks}
            periodLabel={periodLabel}
          />

          {/* 4. Consumption Breakdown */}
          <ElectricitySummaryCards grouped={grouped} summary={summary} />

          {/* 5. Insight Widgets */}
          <ElectricityInsights grouped={grouped} />

          {/* 6. Readings Table */}
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
      </form>
    </div>
  );
}
