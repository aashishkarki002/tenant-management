import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Search } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NEPALI_MONTH_NAMES, getNepaliYearOptions } from "@/utils/nepaliDate";
import { NEPALI_QUARTERS } from "../utils/quarterUtils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"


const STATUS_CHIPS = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending", tone: "pending" },
    { value: "overdue", label: "Overdue", dot: true, tone: "overdue" },
    { value: "partially_paid", label: "Partial", tone: "partial" },
    { value: "paid", label: "Paid", tone: "paid" },
];

const CHIP_INACTIVE =
    "border-border text-muted-foreground hover:text-foreground hover:bg-muted/60";
const CHIP_ACTIVE = {
    all: "border-border bg-foreground text-background font-medium",
    pending: "border-orange-300/60 bg-orange-50 text-orange-800 font-medium dark:bg-orange-950/40 dark:text-orange-200",
    overdue: "border-red-300/60 bg-red-50 text-red-800 font-medium dark:bg-red-950/40 dark:text-red-200",
    partial: "border-yellow-300/60 bg-yellow-50 text-yellow-900 font-medium dark:bg-yellow-950/40 dark:text-yellow-100",
    paid: "border-emerald-300/60 bg-emerald-50 text-emerald-800 font-medium dark:bg-emerald-950/40 dark:text-emerald-200",
};

const FilterPill = ({ label, isActive, children }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                    "h-8 gap-1 rounded-md text-xs font-normal shrink-0 border-border bg-background",
                    isActive && "bg-muted/80 border-border",
                )}
            >
                {label}
                <ChevronDown className="size-3 opacity-50 shrink-0" />
            </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="p-0">
            {children}
        </PopoverContent>
    </Popover>
);

const PopLabel = ({ children }) => (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {children}
    </p>
);

const OptionBtn = ({ active, onClick, children, showCheck }) => (
    <Button
        type="button"
        size="sm"
        variant={active ? "default" : "ghost"}
        onClick={onClick}
        className={cn("w-full justify-start gap-2 text-xs", !showCheck && "justify-center")}
    >
        {showCheck && (
            <Check className={cn("size-3 shrink-0 transition-opacity", active ? "opacity-100" : "opacity-0")} />
        )}
        {children}
    </Button>
);

export const RentFilter = ({
    search = "",
    onSearchChange,
    month,
    year,
    defaultMonth,
    defaultYear,
    onMonthChange,
    onYearChange,
    frequencyView = "monthly",
    onFrequencyChange,
    quarter = 0,
    defaultQuarter = 0,
    onQuarterChange,
    propertyId = "",
    properties = [],
    onPropertyChange,
    status = "all",
    onStatusChange,
    onReset,
}) => {
    const monthOptions = NEPALI_MONTH_NAMES.map((name, i) => ({ value: i + 1, label: name }));
    const yearOptions = getNepaliYearOptions(2078).reverse();

    const isMonthly = frequencyView === "monthly";

    const isPeriodActive = isMonthly
        ? (defaultMonth != null && month !== defaultMonth) || (defaultYear != null && year !== defaultYear)
        : quarter !== defaultQuarter || (defaultYear != null && year !== defaultYear);

    const currentMonthName = month != null ? NEPALI_MONTH_NAMES[month - 1] : "Month";
    const periodLabel = isMonthly
        ? `${currentMonthName} ${year ?? ""}`.trim()
        : `${NEPALI_QUARTERS[quarter]?.short ?? "Q1"} ${year ?? ""}`.trim();

    const selectedProperty = properties.find((p) => p._id === propertyId);
    const propertyLabel = selectedProperty?.name ?? "All Properties";

    const hasActiveFilters =
        !!String(search || "").trim() ||
        status !== "all" ||
        propertyId !== "" ||
        isPeriodActive ||
        frequencyView !== "monthly";

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <FilterPill label={periodLabel} isActive={isPeriodActive}>
                        <div className="p-3 w-64 space-y-4">
                            <div>
                                <PopLabel>Year</PopLabel>
                                <div className="flex flex-wrap gap-1">
                                    {yearOptions.map((opt) => (
                                        <OptionBtn
                                            key={opt.value}
                                            active={year === opt.value}
                                            onClick={() => onYearChange?.(opt.value)}
                                        >
                                            {opt.label}
                                        </OptionBtn>
                                    ))}
                                </div>
                            </div>
                            {isMonthly ? (
                                <div>
                                    <PopLabel>Month</PopLabel>
                                    <div className="grid grid-cols-3 gap-1">
                                        {monthOptions.map((m) => (
                                            <OptionBtn
                                                key={m.value}
                                                active={month === m.value}
                                                onClick={() => onMonthChange?.(m.value)}
                                            >
                                                {m.label}
                                            </OptionBtn>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <PopLabel>Quarter</PopLabel>
                                    <div className="grid grid-cols-2 gap-1">
                                        {NEPALI_QUARTERS.map((q, i) => (
                                            <OptionBtn
                                                key={i}
                                                active={quarter === i}
                                                onClick={() => onQuarterChange?.(i)}
                                            >
                                                {q.label}
                                            </OptionBtn>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </FilterPill>

                    <Tabs
                        value={frequencyView}
                        onValueChange={(value) => onFrequencyChange?.(value)}
                        className="shrink-0"
                    >
                        <TabsList className="h-8 border-1 p-0.5">
                            <TabsTrigger
                                value="monthly"
                                className="text-xs px-3 h-7 "
                            >
                                Monthly
                            </TabsTrigger>

                            <TabsTrigger
                                value="quarterly"
                                className="text-xs px-3 h-7"
                            >
                                Quarterly
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {properties.length > 0 && (
                        <FilterPill label={propertyLabel} isActive={!!propertyId}>
                            <div className="p-2 min-w-40 max-w-56 space-y-0.5">
                                {[{ _id: "", name: "All Properties" }, ...properties].map((p) => (
                                    <OptionBtn
                                        key={p._id}
                                        active={propertyId === p._id}
                                        onClick={() => onPropertyChange?.(p._id)}
                                        showCheck
                                    >
                                        {p.name}
                                    </OptionBtn>
                                ))}
                            </div>
                        </FilterPill>
                    )}

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onReset}
                        disabled={!hasActiveFilters}
                        className="h-8 text-xs text-muted-foreground px-2"
                    >
                        Reset
                    </Button>
                </div>

                <div className="relative w-full sm:w-64 sm:shrink-0 md:w-72">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                        type="search"
                        placeholder="Search tenants or units…"
                        value={search}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        className="h-8 pl-8 text-xs bg-background border-border"
                    />
                </div>
            </div>

            <ToggleGroup
                type="single"
                value={status}
                onValueChange={(value) => value && onStatusChange?.(value)}
                className="flex items-center gap-1.5 pt-1  overflow-x-auto scrollbar-none -mx-1 px-1"
            >
                {STATUS_CHIPS.map(({ value, label, dot, tone }) => {
                    const isActive = status === value
                    const activeClass =
                        isActive && tone
                            ? CHIP_ACTIVE[tone]
                            : isActive
                                ? CHIP_ACTIVE.all
                                : CHIP_INACTIVE

                    return (
                        <ToggleGroupItem
                            key={value}
                            value={value}
                            className={cn(
                                "inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-xs font-normal transition-colors shrink-0 whitespace-nowrap select-none",
                                activeClass
                            )}
                        >
                            {dot && (
                                <span
                                    className={cn(
                                        "size-1.5 rounded-full shrink-0",
                                        isActive ? "bg-red-600" : "bg-red-400/70"
                                    )}
                                />
                            )}
                            {label}
                        </ToggleGroupItem>
                    )
                })}
            </ToggleGroup>
        </div>
    );
};
