import React from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon, Download, Settings } from "lucide-react";
import { useFiscalYear } from "../../../plugins/useNepaliDate";
import ElectricityReadingDialog from "./ElectricityReadingDialog";
import { useNavigate } from "react-router-dom";

export function ElectricityHeader({
  onExportReport,
  onSaved,
  allBlocks = [],
  property = [],
  dialogOpen = false,
  setDialogOpen,
}) {
  const { fiscalYearLabel } = useFiscalYear();
  const navigate = useNavigate();

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        {/* Title */}
        <div>
          <p
            className="text-[11px] font-semibold tracking-[0.16em] uppercase mb-1"
            style={{ color: "#AFA097" }}
          >
            Sallyan House &bull; {fiscalYearLabel}
          </p>

        </div>

        {/* Actions — visible on the page (redundant with header slot for mobile) */}

      </div>

      <ElectricityReadingDialog
        open={dialogOpen}
        onOpenChange={(open) => setDialogOpen?.(open)}
        allBlocks={allBlocks}
        property={property}
        onSaved={onSaved}
      />
    </>
  );
}
