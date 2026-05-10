import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Building2 } from "lucide-react";
import {
  getMonthSelectOptions,
  getYearSelectOptions,
  getCurrentBillingPeriod,
} from "@/utils/nepaliDate";

export function ElectricityFilters({
  filterValues,
  onChange,
  allBlocks = [],
  availableInnerBlocks = [],
}) {
  const { blockId, innerBlockId, month, year } = filterValues ?? {};

  const { nepaliYear: currentYear, nepaliMonth: currentMonth } =
    getCurrentBillingPeriod();

  const monthOptions = useMemo(() => getMonthSelectOptions(), []);
  const yearOptions = useMemo(
    () => getYearSelectOptions(currentYear - 5),
    [currentYear]
  );

  return (
    <div className="flex flex-wrap items-center gap-5 rounded-lg border bg-muted/40 px-4 py-3">

      {/* PERIOD */}
      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />

        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Period
        </span>

        {/* Month */}
        <Select
          value={String(month ?? currentMonth)}
          onValueChange={(v) => onChange?.("month", Number(v))}
        >
          <SelectTrigger className="h-8 w-[120px] text-[13px] bg-muted border rounded-md">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year */}
        <Select
          value={String(year ?? currentYear)}
          onValueChange={(v) => onChange?.("year", Number(v))}
        >
          <SelectTrigger className="h-8 w-[80px] text-[13px] bg-muted border rounded-md">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* DIVIDER */}
      <div className="h-4 w-px bg-border" />

      {/* BUILDING */}
      <div className="flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />

        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Building
        </span>

        <Select
          value={blockId ?? "all"}
          onValueChange={(v) => {
            onChange?.("blockId", v);
            onChange?.("innerBlockId", "");
          }}
        >
          <SelectTrigger className="h-8 w-[150px] text-[13px] bg-muted border rounded-md">
            <SelectValue placeholder="Select building" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buildings</SelectItem>

            {allBlocks.length > 0 ? (
              allBlocks.map((block) => (
                <SelectItem key={block._id} value={block._id}>
                  {block.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-block" disabled>
                No blocks available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* FLOOR (conditional) */}
      {blockId && blockId !== "all" && (
        <>
          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Block
            </span>

            <Select
              value={innerBlockId ?? ""}
              onValueChange={(v) => onChange?.("innerBlockId", v)}
            >
              <SelectTrigger className="h-8 w-[130px] text-[13px] bg-muted border rounded-md">
                <SelectValue placeholder="Select Block" />
              </SelectTrigger>

              <SelectContent>
                {availableInnerBlocks.length > 0 ? (
                  availableInnerBlocks.map((ib) => (
                    <SelectItem key={ib._id} value={ib._id}>
                      {ib.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-block" disabled>
                    No  blocks
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}