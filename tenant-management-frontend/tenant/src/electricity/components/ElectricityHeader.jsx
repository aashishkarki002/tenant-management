import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useFiscalYear } from "../../../plugins/useNepaliDate";
import ElectricityReadingDialog from "./ElectricityReadingDialog";
import { ArrowDownIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ElectricityHeader({
  onExportReport,
  onAddReading,
  onSaveReadings,
  onSaved,
  hasNewRows = false,
  saving = false,
  allBlocks = [],
  property = [],
}) {
  const { fiscalYearLabel } = useFiscalYear();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">

      {/* Left Section */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Utility Monitoring
        </h1>
        <p className="text-muted-foreground text-sm md:text-base mt-1">
          Units • Common Area • Parking • Sub Meter — {fiscalYearLabel}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Primary CTA */}
        <Button
          type="button"
          className="flex items-center gap-2 bg-orange-900 text-white hover:bg-orange-800 px-4 py-2 rounded-lg"
          onClick={() => setOpen(true)}
        >
          <PlusIcon className="w-4 h-4" />
          Add Reading
        </Button>

        {/* Secondary */}
        <Button
          type="button"
          className="flex items-center gap-2 bg-white text-black border border-gray-300 hover:bg-gray-100 px-4 py-2 rounded-lg"
          onClick={() => navigate("/submeter")}
        >
          <PlusIcon className="w-4 h-4" />
          Add Submeter
        </Button>

        {/* Circular Export Button */}
        <Button
          type="ghost"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 p-0"
          onClick={onExportReport}
        >
          <ArrowDownIcon className="w-5 h-5" />
        </Button>
      </div>

      <ElectricityReadingDialog
        open={open}
        onOpenChange={setOpen}
        allBlocks={allBlocks}
        property={property}
        onSaved={onSaved}
      />
    </div>
  );
}
