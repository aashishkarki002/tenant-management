
import { useState, useMemo, useCallback, useEffect } from "react"; // useCallback used by handleCompareApply/handleCompareClear
import { AnimatePresence, motion } from "motion/react"; // eslint-disable-line no-unused-vars
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import {
    NEPALI_MONTH_NAMES,
    QUARTER_LABELS,
    getCurrentFiscalYear,
    getCurrentBSMonthName,
    toBSDate,
} from "../utils/nepaliCalendar";
import { fmtK } from "../../utils/formatter"

// ── Hooks ─────────────────────────────────────────────────────────────────────
import { useAccounting, useBankAccounts } from "../hooks/useAccounting";
import { usePortfolioHealth } from "../hooks/usePortfolioHealth";
import { useMonthlyChart } from "../hooks/useMonthlyChart";
import { useEntity } from "../../context/EntityContext";
import api from "../../../plugins/axios";
import { buildCompareLabel } from "../utils/filterHelpers";

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
import ProfitlossTab from "./tabs/ProfitLossTab";
import ProjectionsTab from "./tabs/ProjectionsTab";
import FinancialRatiosTab from "./tabs/FinancialRatiosTab";
import AuditLogTab from "./tabs/AuditLogTab";
import YearEndCloseTab from "./tabs/YearEndCloseTab";
import VacateSettlementTab from "./tabs/VacateSettlementTab";
import AdjustmentsTab from "./tabs/AdjustmentsTab";
import TrialBalanceTab from "./tabs/TrialBalanceTab";
import ArAgingTab from "./tabs/ArAgingTab";
import TdsFilingTab from "./tabs/TdsFilingTab";
import TenantStatementTab from "./tabs/TenantStatementTab";
import OwnerDistributionTab from "./tabs/OwnerDistributionTab";
import VendorBillsTab from "./tabs/VendorBillsTab";
import BankReconciliationTab from "./tabs/BankReconciliationTab";
import BudgetTab from "./tabs/BudgetTab";
import AdvanceRentTab from "./tabs/AdvanceRentTab";
import CamReconciliationTab from "./tabs/CamReconciliationTab";
import RevenueCollectionTab from "./tabs/RevenueCollectionTab";
import PettyCashTab from "./tabs/PettyCashTab";
import CoaManagementTab from "./tabs/CoaManagementTab";

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

    // ── UI state — tab driven by URL ?tab= param ─────────────────────────────
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") ?? "overview";
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

    // ── Entity scope — shared via EntityContext so filter persists across navigation
    const { entities, activeEntityId, setActiveEntityId } = useEntity();
    const resolvedEntityId = activeEntityId ?? null;

    // ── Tenants list (for TenantStatementTab / AdvanceRentTab selectors) ─────
    const [tenants, setTenants] = useState([]);
    useEffect(() => {
        const params = { limit: 500, status: "active" };
        if (resolvedEntityId) params.entityId = resolvedEntityId;
        api.get("/api/tenant", { params })
            .then((r) => {
                const raw = r.data?.tenants ?? r.data?.data ?? [];
                setTenants(raw.map((t) => ({ id: t._id, name: t.name })));
            })
            .catch(() => { });
    }, [resolvedEntityId]);

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
    const { health, loading: healthLoading } = usePortfolioHealth(
        resolvedFilter.quarter,
        resolvedFilter.startDate,
        resolvedFilter.endDate,
        resolvedFilter.month,
        resolvedFilter.fiscalYear,
        resolvedEntityId,
    );
    useBankAccounts(); // keeps bank account context warm for dialogs
    const { chartData, compareData, comparisonStats, loadingChart } = useMonthlyChart(
        chartQuarter, activeCompareQtr,
        selectedFiscalYear, chartAllYear, resolvedEntityId,
        compareMode ? compareYear : null,
    );

    // ── Derived totals ────────────────────────────────────────────────────────
    const totals = summary?.totals ?? {
        totalRevenue: 0, totalExpenses: 0, totalLiabilities: 0, netCashFlow: 0,
        cashBalance: 0, arBalance: 0, apBalance: 0, operatingCashFlow: 0,
        cashBalancePaisa: 0, arBalancePaisa: 0, apBalancePaisa: 0, operatingCashFlowPaisa: 0,
    };
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

            {/* Filter bar — pinned at top, full width */}
            <FilterControlBar
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

            {/* Scrollable content — sidebar lives in app-sidebar now */}
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
                                onViewLedger={() => setSearchParams({ tab: "ledger" }, { replace: true })}
                                currentBSMonth={getCurrentBSMonthName()}
                                health={health}
                                healthLoading={healthLoading}
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

                        {activeTab === "revenue-collection" && (
                            <RevenueCollectionTab filterProps={filterProps} />
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
                            <BalanceSheetTab entityId={resolvedEntityId} filterProps={filterProps} filterLabel={filterLabel} />
                        )}

                        {activeTab === "projections" && (
                            <ProjectionsTab
                                filterProps={filterProps}
                                filterLabel={filterLabel}
                            />
                        )}
                        {activeTab === "profit-loss" && (
                            <ProfitlossTab
                                filterProps={filterProps}
                                filterLabel={filterLabel}
                            />
                        )}
                        {activeTab === "financial-ratios" && (
                            <FinancialRatiosTab
                                filterProps={filterProps}
                                filterLabel={filterLabel}
                            />
                        )}
                        {activeTab === "audit-log" && (
                            <AuditLogTab entityId={resolvedEntityId} />
                        )}
                        {
                            activeTab === "year-end-close" && (
                                <YearEndCloseTab entityId={resolvedEntityId} onYearClosed={refetch} />
                            )
                        }
                        {
                            activeTab === "vacate-settlement" && (
                                <VacateSettlementTab entityId={resolvedEntityId} onSettlementAdded={refetch} />
                            )
                        }
                        {activeTab === "adjustments" && (
                            <AdjustmentsTab entityId={resolvedEntityId} />
                        )}
                        {activeTab === "trial-balance" && (
                            <TrialBalanceTab filterProps={filterProps} entityId={resolvedEntityId} />
                        )}
                        {activeTab === "ar-aging" && (
                            <ArAgingTab entityId={resolvedEntityId} />
                        )}
                        {activeTab === "tds-filing" && (
                            <TdsFilingTab entityId={resolvedEntityId} />
                        )}

                        {activeTab === "tenant-statement" && (
                            <TenantStatementTab tenants={tenants} />
                        )}
                        {activeTab === "owner-distribution" && (
                            <OwnerDistributionTab />
                        )}
                        {activeTab === "vendor-bills" && (
                            <VendorBillsTab />
                        )}
                        {activeTab === "bank-reconciliation" && (
                            <BankReconciliationTab />
                        )}
                        {activeTab === "budget" && (
                            <BudgetTab />
                        )}
                        {activeTab === "advance-rent" && (
                            <AdvanceRentTab tenants={tenants} />
                        )}
                        {activeTab === "cam-reconciliation" && (
                            <CamReconciliationTab />
                        )}
                        {activeTab === "petty-cash" && (
                            <PettyCashTab filterProps={filterProps} />
                        )}
                        {activeTab === "coa-management" && (
                            <CoaManagementTab />
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