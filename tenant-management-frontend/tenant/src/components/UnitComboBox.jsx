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
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  // Command's built-in filter works on the `value` prop of CommandItem.
  // Since we use the unit _id as value (needed for onSelect), we override
  // the filter to match against the human-readable label + metadata instead.
  const commandFilter = (itemValue, search) => {
    const opt = options.find((o) => o.value === itemValue);
    if (!opt) return 0;
    const haystack = [opt.label, opt.blockName, opt.floor]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase()) ? 1 : 0;
  };

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
        className="p-0"
        // Width matches the trigger button exactly
        style={{ width: "var(--radix-popover-trigger-width)" }}
        align="start"
        // Keep focus inside the Command for keyboard navigation
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command filter={commandFilter}>
          <CommandInput
            placeholder="Search by name, floor, building…"
            className="h-9 text-sm"
            // autoFocus so user can type immediately after opening
            autoFocus
          />
          <CommandList>
            <CommandEmpty>
              <div className="flex flex-col items-center py-6 gap-1.5">
                <Home className="w-5 h-5 opacity-25" />
                <p className="text-sm text-muted-foreground">No units found.</p>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = value === opt.value;
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={(val) => {
                      onChange(val);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2.5 py-2 px-2 cursor-pointer"
                  >
                    {/* Checkmark — holds space even when unchecked */}
                    <Check
                      className={cn(
                        "w-4 h-4 shrink-0 transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      style={{ color: "var(--color-accent)" }}
                    />

                    {/* Label + sub-label */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className="text-sm font-medium leading-tight truncate"
                        style={{
                          color: isSelected
                            ? "var(--color-accent)"
                            : "var(--color-text-strong)",
                        }}
                      >
                        {opt.label}
                      </span>
                      {(opt.blockName || opt.floor) && (
                        <span
                          className="text-[11px] leading-tight truncate mt-0.5"
                          style={{ color: "var(--color-text-weak)" }}
                        >
                          {[opt.blockName, opt.floor].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>

                    {/* Optional occupancy badge */}
                    {showOccupancyBadge && (
                      <OccupancyBadge isOccupied={opt.isOccupied} />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}