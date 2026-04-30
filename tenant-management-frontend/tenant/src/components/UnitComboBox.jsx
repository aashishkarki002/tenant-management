/**
 * UnitCombobox.jsx
 *
 * Searchable unit picker built on shadcn <Command> + <Popover>.
 * Replaces plain <Select> when unit count exceeds ~15.
 *
 * Props:
 *   options           — from useUnitOptions()
 *   value             — selected unit _id (controlled)
 *   onChange          — (unitId: string) => void
 *   placeholder       — trigger button text when nothing selected
 *   disabled          — disables the trigger
 *   loading           — shows skeleton state while units are fetching
 *   showOccupancyBadge — show Occupied / Vacant pill per option (use in Maintenance, hide in Add Tenant)
 *   className         — extra classes on the trigger button
 */

import { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Home, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

// ─── Occupancy badge ──────────────────────────────────────────────────────────

function OccupancyBadge({ isOccupied }) {
  return (
    <span
      className="ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={
        isOccupied
          ? {
            backgroundColor: "var(--color-warning-bg)",
            color: "var(--color-warning)",
            border: "1px solid var(--color-warning-border)",
          }
          : {
            backgroundColor: "var(--color-success-bg)",
            color: "var(--color-success)",
            border: "1px solid var(--color-success-border)",
          }
      }
    >
      {isOccupied ? "Occupied" : "Vacant"}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   options: Array<{ value: string; label: string; blockName?: string; floor?: string; isOccupied: boolean }>;
 *   value: string;
 *   onChange: (value: string) => void;
 *   placeholder?: string;
 *   disabled?: boolean;
 *   loading?: boolean;
 *   showOccupancyBadge?: boolean;
 *   className?: string;
 * }} props
 */

export function UnitCombobox({
  options = [],
  value,
  onChange,
  placeholder = "Select unit…",
  disabled = false,
  loading = false,
  showOccupancyBadge = false,
  className,
}) {
  console.log("UnitCombobox props:", {
    options,
    value,
    loading,
    disabled,
  });
  const [open, setOpen] = useState(false);
  console.log("open:", open)

  const selected = useMemo(() => {
    const found = options.find((o) => o.value === value) ?? null;
    console.log("Selected computed:", { value, found });
    return found;
  }, [options, value]);

  // Command's built-in filter works on the `value` prop of CommandItem.
  // Since we use the unit _id as value (needed for onSelect), we override
  // the filter to match against the human-readable label + metadata instead.
  const commandFilter = useCallback(
    (itemValue, search) => {
      const opt = options.find((o) => o.value.toLowerCase() === itemValue.toLowerCase());
      if (!opt) return 0;
      const haystack = [opt.label, opt.blockName, opt.floor]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase()) ? 1 : 0;
    },
    [options], // ← re-create when options change
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* ── Trigger ── */}
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          onClick={() => console.log("BUTTON CLICKED")}
          className={cn(
            "w-full justify-between font-normal h-9 text-sm px-3",
            "border-border bg-surface hover:bg-surface-raised",
            "transition-colors duration-150",
            !selected && "text-muted-foreground",
            className,

          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin opacity-50" />
            ) : (
              <Home className="w-3.5 h-3.5 shrink-0 opacity-40" />
            )}
            <span className="truncate">
              {loading ? "Loading units…" : (selected?.label ?? placeholder)}
            </span>
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 opacity-40 ml-2" />
        </Button>
      </PopoverTrigger>

      {/* ── Dropdown ── */}
      <PopoverContent
        className="z-[9999] w-[300px] p-0 bg-white border shadow-lg"
        side="bottom"
        align="start"
        sideOffset={6}
      >
        <Command filter={commandFilter}>
          <CommandInput placeholder="Search..." />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>No results</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={(val) => {
                    console.log("SELECTED:", val);
                    onChange(val);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}