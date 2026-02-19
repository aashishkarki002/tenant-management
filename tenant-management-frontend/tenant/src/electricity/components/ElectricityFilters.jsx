import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNepaliDate, getMonthOptions } from "../../../plugins/useNepaliDate";

export function ElectricityFilters({
  filterValues,
  onChange,
  allBlocks = [],
  availableInnerBlocks = [],
}) {
  const { blockId, innerBlockId, month, year } = filterValues ?? {};
  const { year: currentYear, month: currentMonth } = useNepaliDate();

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear - 5; y <= currentYear + 1; y++) years.push(y);
    return years;
  }, [currentYear]);

  const selectedMonthName =
    monthOptions.find((m) => m.value === (month ?? currentMonth))?.label ??
    "Baisakh";
  const selectedYear = year ?? currentYear;

  return (
    <Card className="rounded-lg shadow-lg">
      <CardContent className="p-5">
        {/* Filters Row */}
        <div className="flex flex-wrap items-end gap-6">

          {/* Month & Year */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Billing Period
            </label>
            <div className="flex gap-2">
              <Select
                value={String(month ?? currentMonth)}
                onValueChange={(value) => onChange?.("month", Number(value))}
              >
                <SelectTrigger className="w-[130px] h-9 bg-gray-100">
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
                <SelectTrigger className="w-[90px] h-9 bg-gray-100">
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
          </div>

          {/* Building Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Building
            </label>
            <Select
              value={blockId ?? "all"}
              onValueChange={(value) => {
                onChange?.("blockId", value);
                onChange?.("innerBlockId", "");
              }}
            >
              <SelectTrigger className="w-[150px] h-9 bg-gray-100">
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

          {/* Inner Block Filter */}
          {blockId && blockId !== "all" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                Inner Block
              </label>
              <Select
                value={innerBlockId ?? ""}
                onValueChange={(value) => onChange?.("innerBlockId", value)}
              >
                <SelectTrigger className="w-[130px] h-9 bg-gray-100">
                  <SelectValue placeholder="Select inner block" />
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
                      No inner blocks available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Info Text */}
        <div className="flex justify-end mt-4">
          <p className="text-sm md:text-base text-gray-500">
            Showing readings for{" "}
            <span className="font-semibold">
              {selectedMonthName} {selectedYear}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
