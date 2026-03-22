/**
 * CompareTrigger.jsx
 *
 * The "Compare" button + guided popover that lets the user pick a second period
 * (Period B) to compare against the currently active filter (Period A).
 *
 * Extracted from AccountingPage with one structural fix:
 *   • BS_MONTHS and QUARTER_MONTHS local arrays replaced with
 *     NEPALI_MONTH_NAMES and QUARTER_LABELS from nepaliCalendar.js
 *
 * Props:
 *   filterGranularity   "month" | "quarter" | "year" | "custom"
 *   selectedFiscalYear  number
 *   filterLabel         string   — Period A human label (shown locked in popover)
 *   compareMode         boolean  — true when a Period B is already applied
 *   compareQuarter      number | null
 *   compareYear         number | null
 *   compareMonth        number | null
 *   onApply             ({ year, quarter, month }) => void
 *   onClear             () => void
 */

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { GitCompareArrowsIcon, XIcon, ArrowRightIcon } from "lucide-react";

// ── Single import — no local BS_MONTHS or QUARTER_MONTHS duplicates ──────────
import {
    NEPALI_MONTH_NAMES,
    QUARTER_LABELS,
} from "../utils/nepaliCalendar";

import { buildCompareLabel, isValidDraft } from "./AccountingPage";

// ─── Quarter list (static, no date math needed) ───────────────────────────────
const QUARTERS = [
    { label: "Q1", value: 1 },
    { label: "Q2", value: 2 },
    { label: "Q3", value: 3 },
    { label: "Q4", value: 4 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PERIOD B PICKER — inner panel shown inside the popover
// ═══════════════════════════════════════════════════════════════════════════════
function PeriodBPicker({ granularity, fiscalYears, draft, onChange }) {
    const btnCls = (active) => cn(
        "px-3 py-2 rounded-xl border text-[12px] font-semibold cursor-pointer transition-colors text-left",
        active
            ? "bg-[var(--color-warning)] border-[var(--color-warning)] text-white"
            : "border-[var(--color-border)] bg-transparent text-[var(--color-text-body)] hover:border-[var(--color-warning-border)]",
    );

    if (granularity === "custom") {
        return (
            <p className="text-[12px] text-[var(--color-text-sub)] py-2">
                Switch to Month, Quarter or Year to use Compare.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-3">

            {/* Quarter grid */}
            {granularity === "quarter" && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-sub)] mb-2">
                        Quarter
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {QUARTERS.map(q => (
                            <button
                                key={q.value}
                                onClick={() => onChange({ ...draft, quarter: q.value })}
                                className={btnCls(draft.quarter === q.value)}
                            >
                                {q.label}
                                {/* ✅ QUARTER_LABELS from nepaliCalendar — not a local object */}
                                <span className={cn(
                                    "block text-[10px] font-normal mt-0.5",
                                    draft.quarter === q.value ? "text-white/70" : "text-[var(--color-text-sub)]",
                                )}>
                                    {QUARTER_LABELS[q.value]}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Month grid */}
            {granularity === "month" && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-sub)] mb-2">
                        Month
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                        {/* ✅ NEPALI_MONTH_NAMES from nepaliCalendar — not a local BS_MONTHS array */}
                        {NEPALI_MONTH_NAMES.map((m, i) => (
                            <button
                                key={i}
                                onClick={() => onChange({ ...draft, month: i + 1 })}
                                className={cn(btnCls(draft.month === i + 1), "text-center px-1 py-2")}
                            >
                                {m.slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Fiscal year — always shown regardless of granularity */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-sub)] mb-2">
                    Fiscal Year
                </p>
                <div className="flex flex-wrap gap-2">
                    {fiscalYears.map(y => (
                        <button
                            key={y}
                            onClick={() => onChange({ ...draft, year: y })}
                            className={cn(
                                "h-8 px-4 rounded-xl border text-[12px] font-semibold cursor-pointer transition-colors",
                                draft.year === y
                                    ? "bg-[var(--color-warning)] border-[var(--color-warning)] text-white"
                                    : "border-[var(--color-border)] bg-transparent text-[var(--color-text-body)] hover:border-[var(--color-warning-border)]",
                            )}
                        >
                            FY {y}/{String(y + 1).slice(2)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARE TRIGGER
// ═══════════════════════════════════════════════════════════════════════════════
export default function CompareTrigger({
    filterGranularity,
    selectedFiscalYear,
    filterLabel,
    compareMode,
    compareQuarter,
    compareYear,
    compareMonth,
    onApply,
    onClear,
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState({
        year: compareYear ?? selectedFiscalYear - 1,
        quarter: compareQuarter ?? null,
        month: compareMonth ?? null,
    });
    const popRef = useRef(null);

    // Sync draft when popover opens or external compare values change
    useEffect(() => {
        if (open) {
            setDraft({
                year: compareYear ?? selectedFiscalYear - 1,
                quarter: compareQuarter ?? null,
                month: compareMonth ?? null,
            });
        }
    }, [open, compareYear, compareQuarter, compareMonth, selectedFiscalYear]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const fiscalYears = [selectedFiscalYear, selectedFiscalYear - 1, selectedFiscalYear - 2, selectedFiscalYear - 3];
    const previewLabel = buildCompareLabel(filterGranularity, draft);
    const canApply = isValidDraft(filterGranularity, draft);
    const isCustomMode = filterGranularity === "custom";
    const activeBLabel = compareMode
        ? buildCompareLabel(filterGranularity, { year: compareYear, quarter: compareQuarter, month: compareMonth })
        : null;

    return (
        <div className="relative shrink-0" ref={popRef}>

            {/* ── Trigger button ── */}
            <button
                onClick={() => !isCustomMode && setOpen(p => !p)}
                disabled={isCustomMode}
                className={cn(
                    "inline-flex items-center gap-1.5 h-7 border text-[12px] font-semibold",
                    "cursor-pointer transition-all whitespace-nowrap rounded-lg",
                    compareMode
                        ? "border-[var(--color-warning)] bg-[var(--color-warning-bg)] text-[var(--color-warning)] pl-2.5 pr-0"
                        : open
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)] px-2.5"
                            : "border-[var(--color-border)] bg-transparent text-[var(--color-text-sub)] hover:text-[var(--color-text-body)] px-2.5",
                    isCustomMode && "opacity-40 cursor-not-allowed",
                )}
            >
                <GitCompareArrowsIcon size={12} strokeWidth={2.2} />

                {compareMode && activeBLabel ? (
                    <span className="flex items-center gap-1">
                        <span className="text-[var(--color-warning)]/60 text-[11px] font-normal">vs</span>
                        {activeBLabel}
                    </span>
                ) : "Compare"}

                {/* Clear button — only shown when compare is active */}
                {compareMode && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
                        className="ml-1 h-7 px-2 flex items-center justify-center border-l border-[var(--color-warning)] rounded-r-lg hover:bg-[var(--color-warning)]/10 transition-colors"
                    >
                        <XIcon size={11} strokeWidth={2.5} />
                    </button>
                )}
            </button>

            {/* ── Popover ── */}
            {open && (
                <div className="absolute top-full right-0 mt-2 z-50 w-[340px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-xl p-4 flex flex-col gap-4">

                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[13px] font-bold text-[var(--color-text-strong)]">
                                Compare periods
                            </p>
                            <p className="text-[11px] text-[var(--color-text-sub)] mt-0.5">
                                Choose a second period to compare against your current view.
                            </p>
                        </div>
                        <button
                            onClick={() => setOpen(false)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--color-text-weak)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer shrink-0"
                        >
                            <XIcon size={14} />
                        </button>
                    </div>

                    {/* Period A — locked display */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-sub)] mb-1.5">
                            Viewing (Period A)
                        </p>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-accent-mid)] bg-[var(--color-accent-light)]">
                            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-accent)] shrink-0">A</span>
                            <span className="text-[12px] font-semibold text-[var(--color-accent)] flex-1">{filterLabel}</span>
                            <span className="text-[9px] text-[var(--color-accent)]/60 font-medium">locked</span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-[var(--color-border)]" />
                        <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-weak)] font-medium whitespace-nowrap">
                            <ArrowRightIcon size={10} />compare against
                        </div>
                        <div className="flex-1 h-px bg-[var(--color-border)]" />
                    </div>

                    {/* Period B picker */}
                    <PeriodBPicker
                        granularity={filterGranularity}
                        fiscalYears={fiscalYears}
                        draft={draft}
                        onChange={setDraft}
                    />

                    {/* Period B preview chip */}
                    {previewLabel && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]">
                            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-warning)] shrink-0">B</span>
                            <span className="text-[12px] font-semibold text-[var(--color-warning)]">{previewLabel}</span>
                        </div>
                    )}

                    {/* Footer actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-border)]">
                        <button
                            onClick={() => setOpen(false)}
                            className="flex-1 h-9 rounded-xl border border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-text-body)] bg-transparent hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => { onApply(draft); setOpen(false); }}
                            disabled={!canApply}
                            className="flex-1 h-9 rounded-xl text-[13px] font-bold text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Compare
                            {previewLabel && (
                                <span className="ml-1 font-normal opacity-70 text-[11px]">→ {previewLabel}</span>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}