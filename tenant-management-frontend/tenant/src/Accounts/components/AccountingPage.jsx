/**
 * AccountingPage.jsx (refactored)
 *
 * Key changes from the original 1 767-line monolith:
 *   1. All date/month constants & helpers deleted — imported from nepaliCalendar.js
 *      (single source of truth shared with every other accounting component).
 *   2. The six inline chart-component definitions (RevExpChart, CashFlowArea,
 *      CompareChart, CompareStatStrip, RevenueStreamTable, Scorecard) extracted
 *      into their own files under ./components/accounting/.
 *   3. FilterControlBar + MobileFilterBar moved to ./FilterControlBar.jsx.
 *   4. AccountingHeaderSlot moved to ./AccountingHeaderSlot.jsx.
 *   5. CompareTrigger + PeriodBPicker moved to ./CompareTrigger.jsx.
 *   6. Primitive UI atoms (Card, DarkCard, Lbl, Delta, ProgBar, Spark, Gauge,
 *      ChartTip, Skeleton) moved to ./AccountingPrimitives.jsx.
 *   7. Tab content (OverviewTab, RevenueTab, ExpensesTab, LedgerTab) extracted
 *      to ./tabs/*.jsx so each render branch is independently readable.
 *   8. No business logic was changed — only structural decomposition.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

// ── Date utilities — ONE import, no local duplicates ─────────────────────────
import {
    NEPALI_MONTH_NAMES,
    QUARTER_LABELS,
    CURRENT_FISCAL_YEAR,
    CURRENT_BS_MONTH_NAME,
    toBSDate,
    toBSShort,
} from "../utils/nepaliCalendar";

// ── Hooks ─────────────────────────────────────────────────────────────────────
import { useHeaderSlot } from "../../context/HeaderSlotContext";
import { useAccounting, useBankAccounts } from "../hooks/useAccounting";
import { useMonthlyChart } from "../hooks/useMonthlyChart";
import { useIsMobile } from "@/hooks/use-mobile";
import api from "../../../plugins/axios";

// ── Sub-components (extracted from this file) ─────────────────────────────────
import { Card, DarkCard, Lbl, Delta, Spark, Skeleton } from "./AccountingPrimitives";
import AccountingHeaderSlot from "./AccountingHeaderSlot";
import FilterControlBar from "./FilterControlBar";
import LedgerTable from "./LedgerTable";
import RevenueBreakDown from "./RevenueBreakDown";
import ExpenseBreakDown from "./ExpenseBreakDown";

// ── Tab content components ────────────────────────────────────────────────────
import OverviewTab from "./tabs/OverviewTab";
import RevenueTab from "./tabs/RevenueTab";
import ExpensesTab from "./tabs/ExpenseTab";
import LedgerTab from "./tabs/LedgerTab";

// ─── Constants ────────────────────────────────────────────────────────────────
const QUARTERS = [
    { label: "Q1", value: 1 }, { label: "Q2", value: 2 },
    { label: "Q3", value: 3 }, { label: "Q4", value: 4 },
];

// Now uses QUARTER_LABELS from nepaliCalendar — not a local duplicate
// QUARTER_LABELS[1] === "Shrawan–Ashwin" etc.

const GRANULARITIES = [
    { id: "month", label: "Month" },
    { id: "quarter", label: "Quarter" },
    { id: "year", label: "Year" },
    { id: "custom", label: "Custom" },
];

const TABS = [
    { id: "overview", label: "Overview" },
    { id: "revenue", label: "Revenue" },
    { id: "expenses", label: "Expenses" },
    { id: "ledger", label: "Ledger" },
];

// ─── Formatters ───────────────────────────────────────────────────────────────
export const fmtN = (n = 0) => Math.abs(n).toLocaleString("en-IN");
export const fmtK = (v) => {
    const a = Math.abs(v ?? 0), s = (v ?? 0) < 0 ? "−" : "";
    if (a >= 10_000_000) return `${s}${(a / 10_000_000).toFixed(2)} Cr`;
    if (a >= 100_000) return `${s}${(a / 100_000).toFixed(1)} L`;
    if (a >= 1_000) return `${s}${(a / 1_000).toFixed(0)}K`;
    return `${s}${a}`;
};

// ─── Shared label builders (used by FilterControlBar + ComparisonStats) ──────
/**
 * Build a human-readable label for a compare period config.
 * Uses NEPALI_MONTH_NAMES + QUARTER_LABELS from nepaliCalendar — no local arrays.
 */
export function buildCompareLabel(granularity, { year, quarter, month } = {}) {
    if (granularity === "year" && year)
        return `FY ${year}/${String(year + 1).slice(2)}`;
    if (granularity === "quarter" && quarter && year)
        return `Q${quarter} · ${QUARTER_LABELS[quarter]} · FY ${year}`;
    if (granularity === "month" && month && year)
        return `${NEPALI_MONTH_NAMES[month - 1]} ${year}`;
    return null;
}

export function isValidDraft(granularity, { year, quarter, month }) {
    if (granularity === "year") return !!year;
    if (granularity === "quarter") return !!quarter && !!year;
    if (granularity === "month") return !!month && !!year;
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AccountingPage() {
    // ── Filter state ────────────────────────────────────────────────────────
    const [filterGranularity, setFilterGranularity] = useState("year");
    const [selectedQuarter, setSelectedQuarter] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [selectedFiscalYear, setSelectedFiscalYear] = useState(CURRENT_FISCAL_YEAR);
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    // ── UI state ─────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState("overview");
    const [pendingAction, setPendingAction] = useState(null);

    // ── Compare state — compareMode derived from compareYear ─────────────────
    const [compareQuarter, setCompareQuarter] = useState(null);
    const [compareYear, setCompareYear] = useState(null);
    const [compareMonth, setCompareMonth] = useState(null);
    const compareMode = compareYear !== null;

    const handleCompareApply = useCallback(({ year, quarter, month }) => {
        setCompareYear(year ?? null);
        setCompareQuarter(quarter ?? null);
        setCompareMonth(month ?? null);
    }, []);
    const handleCompareClear = useCallback(() => {
        setCompareYear(null);
        setCompareQuarter(null);
        setCompareMonth(null);
    }, []);

    // ── Entity scope ─────────────────────────────────────────────────────────
    const [activeEntityId, setActiveEntityId] = useState(null);
    const [entities, setEntities] = useState([]);
    const [loadingEntities, setLoadingEntities] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoadingEntities(true);
        api.get("/api/ownership")
            .then(res => { if (!cancelled) setEntities(res.data.data ?? []); })
            .catch(() => { })
            .finally(() => { if (!cancelled) setLoadingEntities(false); });
        return () => { cancelled = true; };
    }, []);

    const resolvedEntityId = useMemo(() => {
        if (!activeEntityId) return null;
        const entity = entities.find(e => e._id === activeEntityId);
        if (entity?.type === "private") return "private";
        return activeEntityId;
    }, [activeEntityId, entities]);

    // ── Resolved filter params (fed into every hook) ─────────────────────────
    const resolvedFilter = useMemo(() => {
        if (filterGranularity === "custom" && customStart && customEnd)
            return { startDate: customStart, endDate: customEnd, quarter: null, month: null, fiscalYear: null };
        return {
            quarter: filterGranularity === "quarter" ? selectedQuarter : null,
            month: filterGranularity === "month" ? selectedMonth : null,
            fiscalYear: selectedFiscalYear,
            startDate: "", endDate: "",
        };
    }, [filterGranularity, selectedQuarter, selectedMonth, selectedFiscalYear, customStart, customEnd]);

    // ── Chart params ─────────────────────────────────────────────────────────
    const chartQuarter = filterGranularity === "quarter" ? selectedQuarter : null;
    const chartAllYear = filterGranularity === "year" || (filterGranularity === "custom" && !!(customStart && customEnd));
    const activeCompareQtr = compareMode && filterGranularity === "quarter" ? compareQuarter : null;

    // ── Data hooks ────────────────────────────────────────────────────────────
    const { summary, loadingSummary, ledgerEntries, loadingLedger, refetch } = useAccounting(
        resolvedFilter.quarter, "all",
        resolvedFilter.startDate, resolvedFilter.endDate,
        resolvedFilter.month, resolvedFilter.fiscalYear,
        resolvedEntityId,
    );
    const { bankAccounts } = useBankAccounts();
    const { chartData, compareData, comparisonStats, loadingChart } = useMonthlyChart(
        chartQuarter, activeCompareQtr,
        selectedFiscalYear, chartAllYear, resolvedEntityId,
    );

    // ── Derived totals ────────────────────────────────────────────────────────
    const totals = summary?.totals ?? { totalRevenue: 0, totalExpenses: 0, totalLiabilities: 0, netCashFlow: 0 };
    const netMargin = totals.totalRevenue > 0 ? (totals.netCashFlow / totals.totalRevenue) * 100 : 0;

    // ── Human-readable period label ───────────────────────────────────────────
    // Uses toBSDate / toBSShort from nepaliCalendar — no local duplicates
    const filterLabel = useMemo(() => {
        if (filterGranularity === "custom" && customStart && customEnd)
            return `${toBSDate(customStart)} → ${toBSDate(customEnd)}`;
        if (filterGranularity === "month" && selectedMonth)
            return `${NEPALI_MONTH_NAMES[selectedMonth - 1]} ${selectedFiscalYear}`;
        if (filterGranularity === "quarter" && selectedQuarter)
            return `Q${selectedQuarter} · ${QUARTER_LABELS[selectedQuarter]} · FY ${selectedFiscalYear}`;
        return `FY ${selectedFiscalYear}/${String(selectedFiscalYear + 1).slice(2)}`;
    }, [filterGranularity, selectedQuarter, selectedMonth, selectedFiscalYear, customStart, customEnd]);

    // ── Compare period labels ─────────────────────────────────────────────────
    const labelA = buildCompareLabel(filterGranularity, {
        year: selectedFiscalYear, quarter: selectedQuarter, month: selectedMonth,
    }) ?? filterLabel;
    const labelB = compareMode
        ? buildCompareLabel(filterGranularity, { year: compareYear, quarter: compareQuarter, month: compareMonth }) ?? "Period B"
        : "Period B";

    // ── CTA actions ───────────────────────────────────────────────────────────
    const handleAddRevenue = useCallback(() => { setActiveTab("revenue"); setPendingAction("revenue"); }, []);
    const handleAddExpense = useCallback(() => { setActiveTab("expenses"); setPendingAction("expense"); }, []);

    useHeaderSlot(
        () => (
            <AccountingHeaderSlot
                onAddRevenue={handleAddRevenue}
                onAddExpense={handleAddExpense}
                onRefresh={refetch}
                summary={summary}
                filterLabel={filterLabel}
            />
        ),
        [handleAddRevenue, handleAddExpense, refetch, summary, filterLabel],
    );

    // ── Props bundle passed to Revenue / Expense / Ledger breakdown components
    const filterProps = {
        selectedQuarter: resolvedFilter.quarter,
        selectedMonth: resolvedFilter.month,
        fiscalYear: resolvedFilter.fiscalYear,
        compareMode,
        compareQuarter,
        customStartDate: resolvedFilter.startDate,
        customEndDate: resolvedFilter.endDate,
        entityId: resolvedEntityId,
    };

    // ── Shared context strip data (shown on non-overview tabs) ────────────────
    const contextStripProps = { totals, filterLabel };

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">

            {/* Sticky filter bar */}
            <FilterControlBar
                entities={entities}
                activeEntityId={activeEntityId}
                onEntitySelect={setActiveEntityId}
                filterGranularity={filterGranularity}
                onGranularityChange={setFilterGranularity}
                selectedQuarter={selectedQuarter}
                onQuarterChange={setSelectedQuarter}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                selectedFiscalYear={selectedFiscalYear}
                onFiscalYearChange={setSelectedFiscalYear}
                customStart={customStart}
                onCustomStartChange={setCustomStart}
                customEnd={customEnd}
                onCustomEndChange={setCustomEnd}
                compareMode={compareMode}
                compareQuarter={compareQuarter}
                compareYear={compareYear}
                compareMonth={compareMonth}
                onCompareApply={handleCompareApply}
                onCompareClear={handleCompareClear}
                filterLabel={filterLabel}
            />

            {/* Tab bar */}
            <div className="no-print flex items-center gap-0.5 px-4 sm:px-7 pt-3 pb-0 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={cn(
                            "px-4 py-2 text-[13px] font-semibold cursor-pointer transition-all border-b-2 -mb-px whitespace-nowrap",
                            activeTab === t.id
                                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                                : "border-transparent text-[var(--color-text-sub)] hover:text-[var(--color-text-body)]",
                        )}>
                        {t.label}
                        {t.id === "ledger" && ledgerEntries.length > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--color-surface)] text-[var(--color-text-sub)]">
                                {ledgerEntries.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex flex-col gap-4 px-4 sm:px-7 pb-10 pt-5">

                {activeTab === "overview" && (
                    <OverviewTab
                        summary={summary}
                        loadingSummary={loadingSummary}
                        totals={totals}
                        netMargin={netMargin}
                        chartData={chartData}
                        compareData={compareData}
                        comparisonStats={comparisonStats}
                        loadingChart={loadingChart}
                        compareMode={compareMode}
                        labelA={labelA}
                        labelB={labelB}
                        filterLabel={filterLabel}
                        ledgerEntries={ledgerEntries}
                        loadingLedger={loadingLedger}
                        onViewLedger={() => setActiveTab("ledger")}
                        currentBSMonth={CURRENT_BS_MONTH_NAME}
                    />
                )}

                {/* Context strip — non-overview tabs */}
                {activeTab !== "overview" && (
                    <TabContextStrip {...contextStripProps} />
                )}

                {activeTab === "revenue" && (
                    <RevenueTab
                        filterProps={filterProps}
                        filterLabel={filterLabel}
                        totalRevenue={totals.totalRevenue}
                        pendingAction={pendingAction}
                        onDialogOpenHandled={() => setPendingAction(null)}
                        onRevenueAdded={refetch}
                    />
                )}

                {activeTab === "expenses" && (
                    <ExpensesTab
                        filterProps={filterProps}
                        filterLabel={filterLabel}
                        totalExpenses={totals.totalExpenses}
                        pendingAction={pendingAction}
                        onDialogOpenHandled={() => setPendingAction(null)}
                        onExpenseAdded={refetch}
                    />
                )}

                {activeTab === "ledger" && (
                    <LedgerTab
                        filterLabel={filterLabel}
                        totals={totals}
                        ledgerEntries={ledgerEntries}
                        loadingLedger={loadingLedger}
                    />
                )}
            </div>
        </div>
    );
}

// ─── TabContextStrip ──────────────────────────────────────────────────────────
/**
 * Small inline strip shown on Revenue / Expenses / Ledger tabs
 * summarising totals for the current filter period.
 *
 * Extracted from the inline JSX in AccountingPage — same markup, named component.
 */
function TabContextStrip({ totals, filterLabel }) {
    return (
        <div className="flex items-start sm:items-center justify-between flex-wrap gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--color-text-sub)]">Net</span>
                    <span className={cn(
                        "text-[14px] font-bold",
                        totals.netCashFlow >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
                    )}>
                        {totals.netCashFlow >= 0 ? "+" : "−"}₹{fmtK(Math.abs(totals.netCashFlow))}
                    </span>
                </div>
                <div className="w-px h-4 bg-[var(--color-border)]" />
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--color-text-sub)]">Revenue</span>
                    <span className="text-[13px] font-semibold text-[var(--color-info)]">₹{fmtK(totals.totalRevenue)}</span>
                </div>
                <div className="w-px h-4 bg-[var(--color-border)]" />
                <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--color-text-sub)]">Expenses</span>
                    <span className="text-[13px] font-semibold text-[var(--color-warning)]">₹{fmtK(totals.totalExpenses)}</span>
                </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)]">
                {filterLabel}
            </span>
        </div>
    );
}