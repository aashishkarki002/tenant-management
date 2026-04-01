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
} from "../../../utils/nepaliMonthBridge";

export function ElectricityFilters({
  filterValues,
  onChange,
  allBlocks = [],
  availableInnerBlocks = [],
}) {
  const { blockId, innerBlockId, month, year } = filterValues ?? {};
  const { nepaliYear: currentYear, nepaliMonth: currentMonth } = getCurrentBillingPeriod();

  const monthOptions = useMemo(() => getMonthSelectOptions(), []);
  const yearOptions = useMemo(() => getYearSelectOptions(currentYear - 5), [currentYear]);

  const triggerStyle = {
    height: "32px",
    fontSize: "13px",
    backgroundColor: "var(--color-muted-fill)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
  };

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: "20px",
        flexWrap: "wrap",
      }}
    >
      {/* Period */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Calendar style={{ width: "13px", height: "13px", color: "var(--color-text-sub)", flexShrink: 0 }} />
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--color-text-sub)",
            whiteSpace: "nowrap",
          }}
        >
          Period
        </span>
        <Select
          value={String(month ?? currentMonth)}
          onValueChange={(v) => onChange?.("month", Number(v))}
        >
          <SelectTrigger style={{ ...triggerStyle, width: "120px" }}>
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
          onValueChange={(v) => onChange?.("year", Number(v))}
        >
          <SelectTrigger style={{ ...triggerStyle, width: "80px" }}>
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

      {/* Divider */}
      <div style={{ width: "1px", height: "18px", backgroundColor: "var(--color-border)" }} />

      {/* Building */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Building2 style={{ width: "13px", height: "13px", color: "var(--color-text-sub)", flexShrink: 0 }} />
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--color-text-sub)",
            whiteSpace: "nowrap",
          }}
        >
          Building
        </span>
        <Select
          value={blockId ?? "all"}
          onValueChange={(v) => {
            onChange?.("blockId", v);
            onChange?.("innerBlockId", "");
          }}
        >
          <SelectTrigger style={{ ...triggerStyle, width: "150px" }}>
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

      {/* Floor — conditional */}
      {blockId && blockId !== "all" && (
        <>
          <div style={{ width: "1px", height: "18px", backgroundColor: "var(--color-border)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: "var(--color-text-sub)",
                whiteSpace: "nowrap",
              }}
            >
              Floor
            </span>
            <Select
              value={innerBlockId ?? ""}
              onValueChange={(v) => onChange?.("innerBlockId", v)}
            >
              <SelectTrigger style={{ ...triggerStyle, width: "130px" }}>
                <SelectValue placeholder="Select floor" />
              </SelectTrigger>
              <SelectContent>
                {availableInnerBlocks.length > 0 ? (
                  availableInnerBlocks.map((ib) => (
                    <SelectItem key={ib._id} value={ib._id}>
                      {ib.name}
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
    </div>
  );
}