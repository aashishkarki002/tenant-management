import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Building2 } from "lucide-react";
// ─── Single authoritative Nepali date source ──────────────────────────────────
// getMonthSelectOptions and getYearSelectOptions are pre-built option arrays
// that handle the 0-based ↔ 1-based translation internally. No need for inline
// loop or the plugins/useNepaliDate shim.
import {
  getMonthSelectOptions,
  getYearSelectOptions,
  getCurrentBillingPeriod,
} from "../../../utils/nepaliMonthBridge";
// ─────────────────────────────────────────────────────────────────────────────




export function ElectricityFilters({
  filterValues,
  onChange,
  allBlocks = [],
  availableInnerBlocks = [],
  periodLabel,
}) {
  const { blockId, innerBlockId, month, year } = filterValues ?? {};
  const { nepaliYear: currentYear, nepaliMonth: currentMonth } = getCurrentBillingPeriod();

  // Both option arrays come from the bridge — no inline construction needed.
  // getMonthSelectOptions returns [{ value: 1, label: "Baisakh" }, …, { value: 12, label: "Chaitra" }]
  // getYearSelectOptions returns descending year options from startYear to current year.
  const monthOptions = useMemo(() => getMonthSelectOptions(), []);
  const yearOptions = useMemo(() => getYearSelectOptions(currentYear - 5), [currentYear]);

  return (
    <div className="bg-surface-raised rounded-xl border border-muted-fill px-4 py-3.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">

        {/* Billing Period */}
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-text-sub shrink-0" />
          <span className="text-xs font-bold text-text-sub uppercase tracking-wider whitespace-nowrap">
            Period
          </span>
          <Select
            value={String(month ?? currentMonth)}
            onValueChange={(value) => onChange?.("month", Number(value))}
          >
            <SelectTrigger className="w-[130px] h-9 text-sm bg-muted-fill border-muted-fill
              hover:border-accent transition-colors">
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
            <SelectTrigger className="w-[90px] h-9 text-sm bg-muted-fill border-muted-fill
              hover:border-muted-fill transition-colors">
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

        <div className="w-px h-7 bg-muted-fill hidden sm:block" />

        {/* Building */}
        <div className="flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-text-sub shrink-0" />
          <span className="text-xs font-bold text-text-sub uppercase tracking-wider whitespace-nowrap">
            Building
          </span>
          <Select
            value={blockId ?? "all"}
            onValueChange={(value) => {
              onChange?.("blockId", value);
              onChange?.("innerBlockId", "");
            }}
          >
            <SelectTrigger className="w-[150px] h-9 text-sm bg-muted-fill border-muted-fill
              hover:border-muted-fill transition-colors">
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

        {/* Inner Block — shown only when a specific building is selected */}
        {blockId && blockId !== "all" && (
          <>
            <div className="w-px h-7 bg-muted-fill hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-text-sub uppercase tracking-wider whitespace-nowrap">
                Floor
              </span>
              <Select
                value={innerBlockId ?? ""}
                onValueChange={(value) => onChange?.("innerBlockId", value)}
              >
                <SelectTrigger className="w-[130px] h-9 text-sm bg-muted-fill border-muted-fill
                  hover:border-muted-fill transition-colors">
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
            <div className="ml-auto hidden lg:flex items-center gap-2 px-3 py-1.5 bg-muted-fill rounded-lg border border-muted-fill">
            <span className="text-xs text-text-sub font-medium">Viewing:</span>
            <span className="text-sm font-bold text-text-strong">{periodLabel}</span>
          </div>
        )}

      </div>
    </div>
  );
}