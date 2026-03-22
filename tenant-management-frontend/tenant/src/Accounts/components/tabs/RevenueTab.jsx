/**
 * tabs/RevenueTab.jsx
 *
 * Renders the "Revenue" tab content.
 * Thin wrapper — owns the section header and delegates everything else
 * to RevenueBreakDown which handles its own data fetching.
 *
 * Props:
 *   filterProps          object  — { selectedQuarter, selectedMonth, fiscalYear,
 *                                    compareMode, compareQuarter,
 *                                    customStartDate, customEndDate, entityId }
 *   filterLabel          string  — human-readable period for the heading
 *   totalRevenue         number  — from summary totals, shown in the badge
 *   pendingAction        string | null  — "revenue" triggers AddRevenueDialog to open
 *   onDialogOpenHandled  () => void
 *   onRevenueAdded       () => void  — refetch callback
 */

import { TrendingUpIcon } from "lucide-react";
import RevenueBreakDown from "../RevenueBreakDown";
import { fmtN } from "../AccountingPage";
import TabSectionHeader from "./TabSectionHeader";

export default function RevenueTab({
    filterProps,
    filterLabel,
    totalRevenue,
    pendingAction,
    onDialogOpenHandled,
    onRevenueAdded,
}) {
    return (
        <div className="flex flex-col gap-4">
            <TabSectionHeader
                icon={<TrendingUpIcon size={13} color="#fff" />}
                iconBg="var(--color-info)"
                label={
                    <>
                        Revenue streams for{" "}
                        <span className="font-bold text-[var(--color-text-strong)]">{filterLabel}</span>
                    </>
                }
                badge={
                    <span className="text-[12px] font-semibold text-[var(--color-info)]">
                        ₹{fmtN(totalRevenue)} total
                    </span>
                }
            />
            <RevenueBreakDown
                onRevenueAdded={onRevenueAdded}
                {...filterProps}
                openDialog={pendingAction === "revenue"}
                onDialogOpenHandled={onDialogOpenHandled}
            />
        </div>
    );
}