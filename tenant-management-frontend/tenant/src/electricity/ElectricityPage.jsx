import React, { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import useProperty from "../hooks/use-property";
import { useUnits } from "../hooks/use-units";
import { useElectricityData } from "./hooks/useElectricityData";
import { useNewElectricityRows } from "./hooks/useNewElectricityRows";
import { useNeaBill } from "./hooks/useNeaBill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ElectricityKpiCards } from "./components/ElectricityKpiCards";
import { ElectricityFilters } from "./components/ElectricityFilters";
import { ElectricitySummaryCards } from "./components/ElectricitySummaryCards";
import { ElectricityInsights } from "./components/ElectricityInsights";
import { ElectricityTable } from "./components/ElectricityTable";
import { NeaBillSection } from "./components/NeaBillSection";

import ElectricityReadingDialog from "./components/ElectricityReadingDialog";
import NeaBillUploadDialog from "./components/NeaBillUploadDialog";

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

import {
  Plus,
  Download,
  Settings,
  Search,
  X,
  FileUp,
} from "lucide-react";

function buildDefaultFilterValues() {
  const { nepaliYear, nepaliMonth } = getCurrentBillingPeriod();

  return {
    blockId: "all",
    innerBlockId: "",
    month: nepaliMonth,
    year: nepaliYear,
  };
}

export default function ElectricityPage() {
  const navigate = useNavigate();

  const { property } = useProperty();
  const { units } = useUnits({ occupied: true });

  const [filterValues, setFilterValues] = useState(
    buildDefaultFilterValues
  );

  const [activeTab, setActiveTab] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReading, setEditingReading] = useState(null);

  const [neaBillDialogOpen, setNeaBillDialogOpen] =
    useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // ─────────────────────────────────────────────────────────
  // Derived Data
  // ─────────────────────────────────────────────────────────

  const allBlocks = useMemo(() => {
    if (!Array.isArray(property)) return [];

    return property.flatMap((prop) => prop.blocks || []);
  }, [property]);

  const selectedBlock = useMemo(() => {
    return allBlocks.find(
      (block) => block._id === filterValues.blockId
    );
  }, [allBlocks, filterValues.blockId]);

  const propertyIdFromBlock = useMemo(() => {
    if (
      !filterValues.blockId ||
      filterValues.blockId === "all"
    ) {
      return undefined;
    }

    if (!Array.isArray(property)) return undefined;

    for (const prop of property) {
      const exists = prop.blocks?.some(
        (block) => block._id === filterValues.blockId
      );

      if (exists) {
        return prop._id;
      }
    }

    return undefined;
  }, [filterValues.blockId, property]);

  const apiFilters = useMemo(() => {
    return {
      propertyId: propertyIdFromBlock,
      blockId:
        filterValues.blockId !== "all"
          ? filterValues.blockId
          : undefined,

      innerBlockId:
        filterValues.innerBlockId || undefined,

      nepaliYear: filterValues.year,
      nepaliMonth: filterValues.month,

      meterType:
        activeTab === "all" ? undefined : activeTab,

      searchQuery:
        searchQuery.trim() || undefined,
    };
  }, [
    propertyIdFromBlock,
    filterValues,
    activeTab,
    searchQuery,
  ]);

  const firstPropertyId = useMemo(() => {
    if (!Array.isArray(property) || property.length === 0) {
      return null;
    }

    return property[0]?._id || null;
  }, [property]);

  const {
    grouped,
    summary,
    loading,
    refetch,
  } = useElectricityData(apiFilters);

  const {
    bills: neaBills,
    loading: neaBillsLoading,
    paying: neaBillPaying,
    fetchBills: fetchNeaBills,
    payBill: payNeaBill,
  } = useNeaBill(firstPropertyId);

  useEffect(() => {
    if (firstPropertyId) {
      fetchNeaBills();
    }
  }, [firstPropertyId, fetchNeaBills]);

  const currentNeaBill = useMemo(() => {
    if (!neaBills.length) return null;

    return (
      neaBills.find(
        (bill) =>
          bill.nepaliYear === filterValues.year &&
          bill.nepaliMonth === filterValues.month
      ) || null
    );
  }, [neaBills, filterValues]);

  const { readings, countsByType } = useMemo(() => {
    return deriveElectricityMetrics(
      grouped,
      activeTab
    );
  }, [grouped, activeTab]);

  const {
    newRows,
    updateNewRow,
    removeNewRow,
  } = useNewElectricityRows({
    readings,
    units: Array.isArray(units) ? units : [],
  });

  const availableInnerBlocks = useMemo(() => {
    return Array.isArray(selectedBlock?.innerBlocks)
      ? selectedBlock.innerBlocks
      : [];
  }, [selectedBlock]);

  // ─────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────

  const handleFilterChange = useCallback(
    (field, value) => {
      setFilterValues((prev) => ({
        ...prev,
        [field]: value,
      }));

      setCurrentPage(1);
    },
    []
  );

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  const handleOpenAddReading = useCallback(() => {
    setEditingReading(null);
    setDialogOpen(true);
  }, []);

  const handleEditReading = useCallback((record) => {
    setEditingReading(record);
    setDialogOpen(true);
  }, []);

  const periodLabel = useMemo(() => {
    return labelForPeriod({
      nepaliYear: filterValues.year,
      nepaliMonth: filterValues.month,
    });
  }, [filterValues]);

  // ─────────────────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────────────────

  const handleExportReport = useCallback(() => {
    if (!readings.length) {
      toast.error("No readings to export.");
      return;
    }

    const escapeCsv = (value) => {
      const str = String(value || "");

      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }

      return str;
    };

    const rows = [];

    rows.push("Electricity Report", periodLabel, "");

    rows.push(
      "Total Readings,Total Consumption (kWh),Total Amount (Rs)"
    );

    rows.push(
      [
        summary.totalReadings || 0,
        summary.grandTotalUnits || 0,
        summary.grandTotalAmount || 0,
      ].join(",")
    );

    rows.push("");

    rows.push(
      "Meter Type,Unit Name,Previous,Current,Consumption,Status,Trend"
    );

    readings.forEach((record, index) => {
      const name =
        record.unit?.name ||
        record.unit?.unitName ||
        record.subMeter?.name ||
        `Row ${index + 1}`;

      const previous =
        Number(record.previousReading) || 0;

      const current =
        Number(record.currentReading) || 0;

      const consumption =
        Number(record.unitsConsumed) ||
        getConsumption(record);

      const trend = getTrendPercent(
        consumption,
        previous
      );

      const trendSign =
        parseFloat(trend) > 0 ? "+" : "";

      rows.push(
        [
          escapeCsv(record.meterType || "unit"),
          escapeCsv(name),
          previous || "",
          current || "",
          formatConsumption(consumption),
          record.status || "pending",
          `${trendSign}${trend}`,
        ].join(",")
      );
    });

    const csv = rows.join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = `electricity-report-${periodLabel}.csv`;

    a.click();

    URL.revokeObjectURL(url);

    toast.success("Report exported.");
  }, [readings, summary, periodLabel]);

  // ─────────────────────────────────────────────────────────
  // Header Slot
  // ─────────────────────────────────────────────────────────

  useHeaderSlot(
    () => (
      <div className="flex w-full items-center gap-2">
        {/* Search */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

          <Input
            type="text"
            placeholder="Search by unit, area, or status..."
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
            className="h-9 pl-9 pr-9 text-sm"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button
           
            onClick={handleOpenAddReading}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              Add Reading
            </span>
          </Button>

 <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          More
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setNeaBillDialogOpen(true)}>
          NEA Bill
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleExportReport}>
          Export
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => navigate("/submeter")}>
          Submeters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
        </div>
      </div>
    ),
    [searchQuery, handleExportReport, navigate]
  );

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Dialogs */}
      <ElectricityReadingDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingReading(null);
          }
        }}
        allBlocks={allBlocks}
        property={property}
        editingReading={editingReading}
        onSaved={refetch}
      />

      <NeaBillUploadDialog
        open={neaBillDialogOpen}
        onOpenChange={setNeaBillDialogOpen}
        propertyId={firstPropertyId}
        onUploaded={fetchNeaBills}
      />

      {/* Top Section */}
      <div className="flex shrink-0 flex-col gap-3 px-5 pb-3 pt-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Electricity
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Consumption, billing and meter readings
            </p>
          </div>

          {periodLabel && (
            <div className="rounded-md border bg-muted/40 px-4 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Current Period
              </p>

              <p className="text-sm font-bold">
                {periodLabel}
              </p>
            </div>
          )}
        </div>

        {/* KPI */}
        <ElectricityKpiCards
          grouped={grouped}
          summary={summary}
        />

        {/* Filters */}
        <ElectricityFilters
          filterValues={filterValues}
          onChange={handleFilterChange}
          allBlocks={allBlocks}
          availableInnerBlocks={
            availableInnerBlocks
          }
        />

        {/* Summary */}
        <ElectricitySummaryCards
          grouped={grouped}
          summary={summary}
        />

        {/* Insights */}
        <ElectricityInsights
          grouped={grouped}
          neaBill={currentNeaBill}
        />

        {/* NEA Bill + Meter Readings — two-tab module */}
        <NeaBillSection
          bill={currentNeaBill}
          bills={neaBills}
          grouped={grouped}
          loading={neaBillsLoading}
          onPay={payNeaBill}
          paying={neaBillPaying}
          onUpload={() => setNeaBillDialogOpen(true)}
        />

        {/* Search Banner */}
        {searchQuery && (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />

              <p className="text-sm">
                <span className="font-bold">
                  {readings.length}
                </span>{" "}
                result
                {readings.length !== 1
                  ? "s"
                  : ""}{" "}
                for{" "}
                <span className="font-semibold text-primary">
                  "{searchQuery}"
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-muted-foreground underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-4">
        <ElectricityTable
          loading={loading}
          readings={readings}
          newRows={newRows}
          units={
            Array.isArray(units) ? units : []
          }
          activeTab={activeTab}
          onTabChange={handleTabChange}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onUpdateNewRow={updateNewRow}
          onRemoveNewRow={removeNewRow}
          onPaymentRecorded={refetch}
          onEditReading={handleEditReading}
          countsByType={countsByType}
          onAddReading={handleOpenAddReading}
        />
      </div>
    </div>
  );
}