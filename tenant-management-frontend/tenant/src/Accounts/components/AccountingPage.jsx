
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react"; // eslint-disable-line no-unused-vars
import { cn } from "@/lib/utils";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
// ── Date utilities — ONE import, no local duplicates ─────────────────────────
import {
    NEPALI_MONTH_NAMES,
    QUARTER_LABELS,
    getCurrentFiscalYear,
    getCurrentBSMonthName,
    toBSDate,
} from "../utils/nepaliCalendar";

// ── Hooks ─────────────────────────────────────────────────────────────────────
import { useAccounting, useBankAccounts } from "../hooks/useAccounting";
import { useMonthlyChart } from "../hooks/useMonthlyChart";
import { useEntity } from "../../context/EntityContext";

// ── Sub-components (extracted from this file) ─────────────────────────────────
import FilterControlBar from "./FilterControlBar";

// ── Tab content components ────────────────────────────────────────────────────
import OverviewTab from "./tabs/OverviewTab";
import RevenueTab from "./tabs/RevenueTab"
import LiabilitiesTab from "./tabs/LiabiltiesTab";
import ExpensesTab from "./tabs/ExpenseTab";
import CashFlowTab from "./tabs/CashFlowTab";
import LedgerTab from "./tabs/LedgerTab";
import BankingTab from "./tabs/BankingTab";
import BalanceSheetTab from "./tabs/BalanceSheetTab";


// Now uses QUARTER_LABELS from nepaliCalendar — not a local duplicate
// QUARTER_LABELS[1] === "Shrawan–Ashwin" etc.


const TABS = [
    { id: "overview", label: "Overview" },
    { id: "revenue", label: "Revenue" },
    { id: "expenses", label: "Expenses" },
    { id: "cash-flow", label: "Cash Flow" },
    { id: "liabilities", label: "Liabilities" },
    { id: "banking", label: "Banking" },
    { id: "ledger", label: "Ledger" },
    { id: "balance-sheet", label: "Balance Sheet" },
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


export function buildCompareLabel(granularity, { year, quarter, month } = {}) {
    if (granularity === "year" && year)
        return `FY ${year}/${String(year + 1).slice(2)}`;
    if (granularity === "quarter" && quarter && year)
        return `Q${quarter} · ${QUARTER_LABELS[quarter]} · FY ${year}`;
    if (granularity === "month" && month && year)
        return `${NEPALI_MONTH_NAMES[month - 1]} ${month <= 3 ? year + 1 : year}`;
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
    const [selectedFiscalYear, setSelectedFiscalYear] = useState(getCurrentFiscalYear());
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

    // ── Tab overflow — pinned (always-visible) + More dropdown ───────────────
    const [pinnedTabs, setPinnedTabs] = useState(["overview", "revenue", "expenses"]);
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef(null);

    useEffect(() => {
        if (!moreOpen) return;
        const handle = (e) => {
            if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [moreOpen]);

    const handleTabClick = useCallback((tabId) => {
        setActiveTab(tabId);
        if (!pinnedTabs.includes(tabId)) {
            // Swap the last slot (index 2); overview at index 0 is never displaced
            setPinnedTabs(prev => {
                const next = [...prev];
                next[next.length - 1] = tabId;
                return next;
            });
            setMoreOpen(false);
        }
    }, [pinnedTabs]);

    const visibleTabs = TABS.filter(t => pinnedTabs.includes(t.id))
        .sort((a, b) => pinnedTabs.indexOf(a.id) - pinnedTabs.indexOf(b.id));
    const hiddenTabs = TABS.filter(t => !pinnedTabs.includes(t.id));

    // ── Entity scope — shared via EntityContext so filter persists across navigation
    const { entities, activeEntityId, setActiveEntityId } = useEntity();
    const resolvedEntityId = activeEntityId ?? null;

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
    useBankAccounts(); // keeps bank account context warm for dialogs
    const { chartData, compareData, comparisonStats, loadingChart } = useMonthlyChart(
        chartQuarter, activeCompareQtr,
        selectedFiscalYear, chartAllYear, resolvedEntityId,
        compareMode ? compareYear : null,
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
            return `${NEPALI_MONTH_NAMES[selectedMonth - 1]} ${selectedMonth <= 3 ? selectedFiscalYear + 1 : selectedFiscalYear}`;
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

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[var(--color-bg)]">

            {/* Filter bar — pinned at top, never scrolls away */}
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

            {/* Tab bar — dropdown on mobile, pill row on sm+ */}

            <div className="no-print sm:hidden flex-shrink-0 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                <Select value={activeTab} onValueChange={handleTabClick}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select tab" />
                    </SelectTrigger>

                    <SelectContent>
                        {TABS.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                                {t.label}
                                {t.id === "ledger" && ledgerEntries.length > 0
                                    ? ` (${ledgerEntries.length})`
                                    : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Desktop: pinned tabs + More ▾ overflow */}
            <div
                role="tablist"
                className="no-print hidden sm:flex flex-shrink-0 items-center gap-0.5 px-4 sm:px-7 pt-3 pb-0 border-b border-[var(--color-border)] bg-[var(--color-bg)]"
            >
                {visibleTabs.map(t => (
                    <button
                        key={t.id}
                        role="tab"
                        aria-selected={activeTab === t.id}
                        onClick={() => handleTabClick(t.id)}
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

                {/* More ▾ overflow trigger */}
                <div ref={moreRef} className="relative ml-1 -mb-px">
                    <button
                        onClick={() => setMoreOpen(o => !o)}
                        className={cn(
                            "flex items-center gap-1 px-3 py-2 text-[13px] font-semibold cursor-pointer transition-all border-b-2 whitespace-nowrap",
                            hiddenTabs.some(t => t.id === activeTab)
                                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                                : "border-transparent text-[var(--color-text-sub)] hover:text-[var(--color-text-body)]",
                        )}>
                        More
                        <svg
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                            className={cn("transition-transform duration-150", moreOpen && "rotate-180")}
                        >
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    {moreOpen && (
                        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg py-1">
                            {hiddenTabs.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => handleTabClick(t.id)}
                                    className={cn(
                                        "w-full text-left px-4 py-2 text-[13px] font-semibold transition-colors whitespace-nowrap",
                                        activeTab === t.id
                                            ? "text-[var(--color-accent)] bg-[var(--color-accent-light)]"
                                            : "text-[var(--color-text-sub)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-surface)]",
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
                    )}
                </div>
            </div>

            {/* Tab content — this div owns the scroll, everything above stays pinned */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        role="tabpanel"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="flex flex-col gap-4 px-4 sm:px-7 pb-10 pt-5"
                    >
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
                                currentBSMonth={getCurrentBSMonthName()}
                            />
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

                        {activeTab === "cash-flow" && (
                            <CashFlowTab
                                summary={summary}
                                totals={totals}
                                filterLabel={filterLabel}
                                loadingSummary={loadingSummary}
                                chartData={chartData}
                                loadingChart={loadingChart}
                            />
                        )}

                        {activeTab === "liabilities" && (
                            <LiabilitiesTab />
                        )}

                        {activeTab === "banking" && (
                            <BankingTab entityId={resolvedEntityId} />
                        )}

                        {activeTab === "ledger" && (
                            <LedgerTab
                                filterLabel={filterLabel}
                                totals={totals}
                                ledgerEntries={ledgerEntries}
                                loadingLedger={loadingLedger}
                            />
                        )}

                        {activeTab === "balance-sheet" && (
                            <BalanceSheetTab entityId={resolvedEntityId} />
                        )}
                    </motion.div>
                </AnimatePresence>
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