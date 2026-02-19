import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useFiscalYear } from "../../../plugins/useNepaliDate";
import ElectricityReadingDialog from "./ElectricityReadingDialog";

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

      {/* Right Section */}
      <div className="flex flex-wrap items-center gap-3">

        <Button
          type="button"
          variant="outline"
          className="flex items-center gap-2"
          onClick={onExportReport}
        >
          <PlusIcon className="w-4 h-4" />
          Export Report
        </Button>

        <Button
          type="button"
          className="flex items-center gap-2"
          onClick={() => setOpen(true)}
        >
          <PlusIcon className="w-4 h-4" />
          Add Reading
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
