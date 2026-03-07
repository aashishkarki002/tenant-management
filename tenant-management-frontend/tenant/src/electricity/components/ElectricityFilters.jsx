import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Building2 } from "lucide-react";
import { useNepaliDate, getMonthOptions } from "../../../plugins/useNepaliDate";

export function ElectricityFilters({
  filterValues,
  onChange,
  allBlocks = [],
  availableInnerBlocks = [],
  periodLabel,
}) {
  const { blockId, innerBlockId, month, year } = filterValues ?? {};
  const { year: currentYear, month: currentMonth } = useNepaliDate();

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear - 5; y <= currentYear + 1; y++) years.push(y);
    return years;
  }, [currentYear]);

  return (
    <div className="bg-white rounded-xl border border-[#E8E4E0] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Billing Period */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#948472] shrink-0" />
          <span className="text-xs font-semibold text-[#948472] uppercase tracking-wide whitespace-nowrap">
            Period
          </span>
          <Select
            value={String(month ?? currentMonth)}
            onValueChange={(value) => onChange?.("month", Number(value))}
          >
            <SelectTrigger className="w-[120px] h-8 text-sm bg-[#F8F5F2] border-[#E8E4E0]">
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
          <Select
            value={String(year ?? currentYear)}
            onValueChange={(value) => onChange?.("year", Number(value))}
          >
            <SelectTrigger className="w-[80px] h-8 text-sm bg-[#F8F5F2] border-[#E8E4E0]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-px h-6 bg-[#E8E4E0] hidden sm:block" />

        {/* Building */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#948472] shrink-0" />
          <span className="text-xs font-semibold text-[#948472] uppercase tracking-wide whitespace-nowrap">
            Building
          </span>
          <Select
            value={blockId ?? "all"}
            onValueChange={(value) => {
              onChange?.("blockId", value);
              onChange?.("innerBlockId", "");
            }}
          >
            <SelectTrigger className="w-[140px] h-8 text-sm bg-[#F8F5F2] border-[#E8E4E0]">
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

        {/* Inner Block — conditional */}
        {blockId && blockId !== "all" && (
          <>
            <div className="w-px h-6 bg-[#E8E4E0] hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#948472] uppercase tracking-wide whitespace-nowrap">
                Floor
              </span>
              <Select
                value={innerBlockId ?? ""}
                onValueChange={(value) => onChange?.("innerBlockId", value)}
              >
                <SelectTrigger className="w-[120px] h-8 text-sm bg-[#F8F5F2] border-[#E8E4E0]">
                  <SelectValue placeholder="Select floor" />
                </SelectTrigger>
                <SelectContent>
                  {availableInnerBlocks.length > 0 ? (
                    availableInnerBlocks.map((innerBlock) => (
                      <SelectItem key={innerBlock._id} value={innerBlock._id}>
                        {innerBlock.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-inner-block" disabled>
                      No inner blocks
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Period summary — pushed to the right */}
        {periodLabel && (
          <div className="ml-auto hidden md:block">
            <p className="text-xs text-[#948472]">
              Showing:{" "}
              <span className="font-semibold text-[#1C1A18]">{periodLabel}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
