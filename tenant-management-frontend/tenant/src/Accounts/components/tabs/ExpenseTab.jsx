/**
 * tabs/ExpensesTab.jsx
 *
 * Renders the "Expenses" tab content.
 * Thin wrapper — owns the section header and delegates everything else
 * to ExpenseBreakDown which handles its own data fetching.
 *
 * Props:
 *   filterProps          object  — { selectedQuarter, selectedMonth, fiscalYear,
 *                                    compareMode, compareQuarter,
 *                                    customStartDate, customEndDate, entityId }
 *   filterLabel          string  — human-readable period for the heading
 *   totalExpenses        number  — from summary totals, shown in the badge
 *   pendingAction        string | null  — "expense" triggers AddExpenseDialog to open
 *   onDialogOpenHandled  () => void
 *   onExpenseAdded       () => void  — refetch callback
 */

import { TrendingDownIcon } from "lucide-react";
import ExpenseBreakDown from "../ExpenseBreakDown";
import { fmtN } from "../AccountingPage";
import TabSectionHeader from "./TabSectionHeader";

export default function ExpensesTab({
    filterProps,
    filterLabel,
    totalExpenses,
    pendingAction,
    onDialogOpenHandled,
    onExpenseAdded,
}) {
    return (
        <div className="flex flex-col gap-4">
            <TabSectionHeader
                icon={<TrendingDownIcon size={13} color="#fff" />}
                iconBg="var(--color-warning)"
                label={
                    <>
                        Expense categories for{" "}
                        <span className="font-bold text-[var(--color-text-strong)]">{filterLabel}</span>
                    </>
                }
                badge={
                    <span className="text-[12px] font-semibold text-[var(--color-warning)]">
                        ₹{fmtN(totalExpenses)} total
                    </span>
                }
            />
            <ExpenseBreakDown
                onExpenseAdded={onExpenseAdded}
                {...filterProps}
                openDialog={pendingAction === "expense"}
                onDialogOpenHandled={onDialogOpenHandled}
            />
        </div>
    );
}