// AccountingPage.jsx
import React, { useState } from "react";
import {
    AArrowUpIcon as BanknoteArrowUpIcon,
    AArrowDownIcon as BanknoteArrowDownIcon,
    BanknoteIcon,
    GitCompareArrowsIcon,
    TrendingUpIcon,
    TrendingDownIcon,
    MinusIcon,
    CalendarIcon,
    ChevronDownIcon,
    BuildingIcon,
} from "lucide-react";
import {
    Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAccounting, useBankAccounts } from "../hooks/useAccounting";
import { useMonthlyChart, QUARTER_LABELS } from "../hooks/useMonthlyChart";

import LedgerTable from "./LedgerTable";
import DualCalendarTailwind from "../../components/dualDate";
import RevenueBreakDown from "./RevenueBreakDown";
import ExpenseBreakDown from "./ExpenseBreakDown";
import RevenueExpensesChart from "./RevenueExpensesChart";

// ─── Constants ─────────────────────────────────────────────────────────────────
const QUARTERS = [
    { label: "All", value: null },
    { label: "Q1", value: 1 },
    { label: "Q2", value: 2 },
    { label: "Q3", value: 3 },
    { label: "Q4", value: 4 },
];

// Nepal fiscal quarter labels (Shrawan-based)
const QUARTER_RANGE_LABELS = {
    1: "Shrawan – Ashwin",
    2: "Kartik – Poush",
    3: "Magh – Chaitra",
    4: "Baisakh – Ashadh",
};

// ─── KPI Metric Card ──────────────────────────────────────────────────────────
function MetricCard({ title, value, sub, icon: Icon, accentColor, bgColor, textColor }) {
    return (
        <div className={`relative flex flex-col gap-3 rounded-xl border border-border p-5 overflow-hidden ${bgColor}`}>
            {/* Accent left bar */}
            <div className={`absolute left-0 top-0 w-1 h-full rounded-l-xl ${accentColor}`} />

            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">
                    {title}
                </span>
                <div className={`p-2 rounded-lg ${bgColor} border border-border/60`}>
                    <Icon className={`w-4 h-4 ${textColor}`} />
                </div>
            </div>

            <div className="pl-1">
                <p className={`text-3xl font-black tabular-nums tracking-tight ${textColor}`}>
                    ₹{value.toLocaleString()}
                </p>
                {sub && (
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{sub}</p>
                )}
            </div>
        </div>
    );
}

// ─── Net Margin Badge ─────────────────────────────────────────────────────────
function NetMarginBadge({ revenue, netCashFlow }) {
    if (!revenue) return null;
    const margin = ((netCashFlow / revenue) * 100).toFixed(1);
    const isPositive = netCashFlow >= 0;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${isPositive
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800"
            }`}>
            {isPositive ? <TrendingUpIcon className="w-3 h-3" /> : <TrendingDownIcon className="w-3 h-3" />}
            {margin}% margin
        </span>
    );
}

// ─── Delta Badge ──────────────────────────────────────────────────────────────
function DeltaBadge({ pct }) {
    if (pct === null || pct === undefined) {
        return (
            <Badge variant="secondary" className="text-xs gap-1">
                <MinusIcon className="w-3 h-3" />N/A
            </Badge>
        );
    }
    const up = pct >= 0;
    const Icon = up ? TrendingUpIcon : TrendingDownIcon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${up
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
            }`}>
            <Icon className="w-3 h-3" />
            {Math.abs(pct).toFixed(1)}%
        </span>
    );
}

// ─── Comparison Stats ─────────────────────────────────────────────────────────
function ComparisonStats({ stats, labelA, labelB }) {
    if (!stats) return null;
    const rows = [
        { title: "Revenue", key: "revenue", aColor: "text-emerald-600", bColor: "text-cyan-600" },
        { title: "Expenses", key: "expenses", aColor: "text-rose-500", bColor: "text-orange-500" },
        { title: "Net Cash Flow", key: "netCashFlow", aColor: "text-foreground", bColor: "text-foreground" },
    ];
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {rows.map(({ title, key, aColor, bColor }) => {
                const s = stats[key];
                return (
                    <Card key={key} className="border-dashed">
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3">
                            <div className="flex items-end justify-between gap-2">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] text-muted-foreground">{labelA}</p>
                                    <p className={`text-base font-bold tabular-nums ${aColor}`}>₹{s.a.toLocaleString()}</p>
                                </div>
                                <div className="text-muted-foreground/40 text-lg font-light pb-1">→</div>
                                <div className="space-y-0.5 text-right">
                                    <p className="text-[10px] text-muted-foreground">{labelB}</p>
                                    <p className={`text-base font-bold tabular-nums ${bColor}`}>₹{s.b.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-border">
                                <DeltaBadge pct={s.pct} />
                                <span className="text-xs text-muted-foreground">
                                    {s.pct === null
                                        ? "No baseline data"
                                        : `₹${Math.abs(s.b - s.a).toLocaleString()} ${s.pct >= 0 ? "increase" : "decrease"}`}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

// ─── Quarter Strip (for compare mode) ─────────────────────────────────────────
function QuarterStrip({ value, onChange, excludeValue, label }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pl-0.5">
                {label}
            </span>
            <div className="flex flex-wrap gap-1.5">
                {QUARTERS.map(({ label: qLabel, value: qValue }) => (
                    <Button
                        key={qLabel}
                        variant={value === qValue ? "default" : "outline"}
                        size="sm"
                        className="min-w-[3.5rem] h-8 text-xs font-medium"
                        disabled={qValue !== null && qValue === excludeValue}
                        onClick={() => onChange(qValue)}
                    >
                        {qLabel}
                    </Button>
                ))}
            </div>
        </div>
    );
}

// ─── Active Filter Indicator ──────────────────────────────────────────────────
function ActiveFilterPill({ selectedQuarter, customStartDate, customEndDate, onClear }) {
    if (!selectedQuarter && !customStartDate) return null;

    const label = selectedQuarter === "custom"
        ? `${customStartDate} → ${customEndDate}`
        : selectedQuarter
            ? `Q${selectedQuarter} · ${QUARTER_RANGE_LABELS[selectedQuarter]}`
            : null;

    if (!label) return null;

    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-xs font-semibold">
            <CalendarIcon className="w-3 h-3" />
            {label}
            <button
                onClick={onClear}
                className="ml-0.5 hover:text-primary/70 transition-colors font-bold"
                title="Clear filter"
            >
                ×
            </button>
        </span>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountingPage() {
    const [selectedQuarter, setSelectedQuarter] = useState(null);
    const [activeTab, setActiveTab] = useState("summary");
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");

    const [compareMode, setCompareMode] = useState(false);
    const [compareQuarter, setCompareQuarter] = useState(2);

    const activeCompareQuarter = compareMode ? compareQuarter : null;

    // Ledger is only shown in the Summary tab — always fetch "all" to avoid
    // unnecessary refetches every time the user switches tabs.
    const { summary, loadingSummary, ledgerEntries, loadingLedger, refetch } =
        useAccounting(selectedQuarter, "all");

    const { bankAccounts } = useBankAccounts();

    const { chartData, compareData, comparisonStats, loadingChart } =
        useMonthlyChart(selectedQuarter, activeCompareQuarter);

    // ── Derived totals ────────────────────────────────────────────────────────
    const totals = summary?.totals ?? {
        totalRevenue: 0, totalLiabilities: 0, totalExpenses: 0, netCashFlow: 0,
    };

    const periodALabel = selectedQuarter
        ? QUARTER_LABELS[selectedQuarter] ?? "Period A"
        : "Last 5 months";
    const periodBLabel = compareQuarter
        ? QUARTER_LABELS[compareQuarter] ?? "Period B"
        : "Last 5 months";

    const chartSubtitle = compareMode
        ? `Comparing ${periodALabel} vs ${periodBLabel}`
        : selectedQuarter === "custom"
            ? `${customStartDate} → ${customEndDate}`
            : selectedQuarter
                ? `Q${selectedQuarter} · ${QUARTER_RANGE_LABELS[selectedQuarter]} · FY 2081/82`
                : "Last 5 months · FY 2081/82";

    // Shared filter props passed to Revenue & Expense tabs
    const filterProps = {
        selectedQuarter,
        compareMode,
        compareQuarter,
        customStartDate,
        customEndDate,
    };

    return (
        <div className="space-y-6 px-1">

            {/* ── Header ──────────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">Accounting</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-muted-foreground">Fiscal Year 2081/82</p>
                        <ActiveFilterPill
                            selectedQuarter={selectedQuarter}
                            customStartDate={customStartDate}
                            customEndDate={customEndDate}
                            onClear={() => { setSelectedQuarter(null); setCustomStartDate(""); setCustomEndDate(""); }}
                        />
                    </div>
                </div>

                {/* Bank Account Cards */}
                <div className="flex flex-wrap gap-2 sm:justify-end">
                    {bankAccounts.map((account) => (
                        <div
                            key={account._id}
                            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer min-w-[170px]"
                        >
                            <div className="p-2 rounded-lg bg-muted">
                                <BuildingIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate leading-none">{account.bankName}</p>
                                <div className="flex items-center justify-between gap-3 mt-1">
                                    <span className="text-[11px] text-muted-foreground">•••• {account.accountNumber?.slice(-3)}</span>
                                    <span className="text-[11px] font-bold tabular-nums text-foreground">₹{account.balance?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Period & Compare Controls ─────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-end gap-3">

                    {compareMode ? (
                        <div className="flex flex-col sm:flex-row gap-6 flex-1">
                            <QuarterStrip label="Period A" value={selectedQuarter} onChange={setSelectedQuarter} excludeValue={compareQuarter} />
                            <div className="hidden sm:flex items-center self-end pb-1.5">
                                <span className="text-sm text-muted-foreground/60 font-light px-2">vs</span>
                            </div>
                            <QuarterStrip label="Period B" value={compareQuarter} onChange={setCompareQuarter} excludeValue={selectedQuarter} />
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2 items-center">
                            {/* Quarter buttons */}
                            {QUARTERS.map(({ label, value }) => (
                                <Button
                                    key={label}
                                    variant={selectedQuarter === value ? "default" : "outline"}
                                    size="sm"
                                    className="min-w-[3.5rem] font-medium h-8"
                                    onClick={() => setSelectedQuarter(value)}
                                >
                                    {label}
                                    {value && selectedQuarter !== value && (
                                        <span className="ml-1.5 text-[10px] text-muted-foreground hidden sm:inline">
                                            {QUARTER_RANGE_LABELS[value]?.split("–")[0].trim()}
                                        </span>
                                    )}
                                </Button>
                            ))}

                            {/* Custom range picker */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant={selectedQuarter === "custom" ? "default" : "outline"}
                                        size="sm"
                                        className="font-medium h-8 gap-1.5"
                                    >
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                        {selectedQuarter === "custom" ? `${customStartDate} → ${customEndDate}` : "Custom"}
                                        <ChevronDownIcon className="w-3 h-3 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="p-4 w-auto min-w-[380px]" side="bottom">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                        Custom Date Range
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Start</label>
                                            <DualCalendarTailwind value={customStartDate} onChange={(e) => setCustomStartDate(e ?? "")} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">End</label>
                                            <DualCalendarTailwind value={customEndDate} onChange={(e) => setCustomEndDate(e ?? "")} />
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="mt-4 w-full"
                                        disabled={!customStartDate || !customEndDate}
                                        onClick={() => setSelectedQuarter("custom")}
                                    >
                                        Apply Range
                                    </Button>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {/* Compare toggle */}
                    <Button
                        variant={compareMode ? "default" : "outline"}
                        size="sm"
                        className="gap-2 font-medium shrink-0 h-8"
                        onClick={() => setCompareMode((p) => !p)}
                    >
                        <GitCompareArrowsIcon className="w-4 h-4" />
                        {compareMode ? "Exit Compare" : "Compare"}
                    </Button>
                </div>

                {compareMode && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Period A shown in emerald ·
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block mx-0.5" />
                        Period B in cyan. Same quarter disabled.
                    </p>
                )}
            </div>

            {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-10">
                    <TabsTrigger value="summary" className="text-sm font-semibold">Summary</TabsTrigger>
                    <TabsTrigger value="Revenue" className="text-sm font-semibold">Revenue</TabsTrigger>
                    <TabsTrigger value="Expenses" className="text-sm font-semibold">Expenses</TabsTrigger>
                </TabsList>

                {/* ── Summary Tab ─────────────────────────────────────────────────────── */}
                <TabsContent value="summary" className="mt-6 space-y-6">

                    {/* KPI Cards */}
                    {!compareMode && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <MetricCard
                                title="Gross Revenue"
                                value={totals.totalRevenue}
                                sub={`Period: ${chartSubtitle}`}
                                icon={BanknoteArrowUpIcon}
                                accentColor="bg-emerald-500"
                                bgColor="bg-emerald-50/50 dark:bg-emerald-950/20"
                                textColor="text-emerald-700 dark:text-emerald-400"
                            />
                            <MetricCard
                                title="Total Expenses"
                                value={totals.totalExpenses}
                                sub="All categories combined"
                                icon={BanknoteArrowDownIcon}
                                accentColor="bg-rose-500"
                                bgColor="bg-rose-50/50 dark:bg-rose-950/20"
                                textColor="text-rose-600 dark:text-rose-400"
                            />
                            <MetricCard
                                title="Net Cash Flow"
                                value={totals.netCashFlow}
                                sub={null}
                                icon={BanknoteIcon}
                                accentColor={totals.netCashFlow >= 0 ? "bg-blue-500" : "bg-orange-500"}
                                bgColor="bg-blue-50/40 dark:bg-blue-950/20"
                                textColor={totals.netCashFlow >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}
                            />
                        </div>
                    )}

                    {/* Net margin pill (only in non-compare, non-zero) */}
                    {!compareMode && totals.totalRevenue > 0 && (
                        <div className="flex items-center gap-3">
                            <NetMarginBadge revenue={totals.totalRevenue} netCashFlow={totals.netCashFlow} />
                            <span className="text-xs text-muted-foreground">
                                Net margin for {chartSubtitle}
                            </span>
                        </div>
                    )}

                    {/* Chart — RevenueExpensesChart wraps itself in a Card, so no outer Card needed */}
                    <RevenueExpensesChart
                        data={chartData}
                        compareData={compareData}
                        loading={loadingChart}
                        title={compareMode ? "Period Comparison" : "Revenue vs Expenses"}
                        subtitle={chartSubtitle}
                        periodALabel={compareMode ? periodALabel : undefined}
                        periodBLabel={compareMode ? periodBLabel : undefined}
                        compareMode={compareMode}
                    />
                    {compareMode && comparisonStats && (
                        <ComparisonStats
                            stats={comparisonStats}
                            labelA={periodALabel}
                            labelB={periodBLabel}
                        />
                    )}

                    {/* Ledger Table */}
                    <Card className="border-border">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-bold">General Ledger</CardTitle>
                                <Badge variant="secondary" className="text-xs">
                                    {ledgerEntries.length} entries
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                All transactions · {chartSubtitle}
                            </p>
                        </CardHeader>
                        <CardContent>
                            <LedgerTable entries={ledgerEntries} loading={loadingLedger} itemsPerPage={20} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Revenue Tab ──────────────────────────────────────────────────────── */}
                <TabsContent value="Revenue" className="mt-6">
                    <RevenueBreakDown
                        onRevenueAdded={refetch}
                        {...filterProps}
                    />
                </TabsContent>

                {/* ── Expenses Tab ─────────────────────────────────────────────────────── */}
                <TabsContent value="Expenses" className="mt-6">
                    <ExpenseBreakDown
                        onExpenseAdded={refetch}
                        {...filterProps}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}