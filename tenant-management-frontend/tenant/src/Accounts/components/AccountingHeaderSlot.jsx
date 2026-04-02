/**
 * AccountingHeaderSlot.jsx  —  REDESIGNED
 *
 * Header actions injected via useHeaderSlot().
 * Design changes:
 *   • "Add Revenue" CTA has sharper radius and tighter padding
 *   • Overflow button uses a more refined ghost style
 *   • "Add Expense" menu item uses a danger-tinted icon (consistent with expense = warning)
 *   • All text is 12px instead of 13px — denser, more professional
 *
 * Props (unchanged):
 *   onAddRevenue · onAddExpense · onRefresh · summary · filterLabel
 */

import {
    PlusIcon, MoreVerticalIcon, RefreshCwIcon,
    PrinterIcon, DownloadIcon, TrendingDownIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AccountingHeaderSlot({
    onAddRevenue,
    onAddExpense,
    onRefresh,
    summary,
    filterLabel,
}) {
    const handleExportCSV = () => {
        const t = summary?.totals ?? {};
        const rows = [
            ["Metric", "Value"],
            ["Revenue", t.totalRevenue ?? 0],
            ["Expenses", t.totalExpenses ?? 0],
            ["Net Cash Flow", t.netCashFlow ?? 0],
            ["Period", filterLabel],
        ];
        const blob = new Blob(
            [rows.map((r) => r.join(",")).join("\n")],
            { type: "text/csv" },
        );
        const url = URL.createObjectURL(blob);
        Object.assign(document.createElement("a"), {
            href: url,
            download: `accounts-${Date.now()}.csv`,
        }).click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="ml-auto flex items-center gap-1.5">
            {/* Primary CTA */}
            <Button
                onClick={onAddRevenue}
                size="sm"
                className="gap-1.5 h-8 px-3.5 text-[12px] font-bold bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-none rounded-xl border-0"
            >
                <PlusIcon size={13} strokeWidth={2.5} />
                Add Revenue
            </Button>

            {/* Overflow menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl border-[var(--color-border)] bg-transparent hover:bg-[var(--color-surface)] shadow-none"
                    >
                        <MoreVerticalIcon
                            size={14}
                            className="text-[var(--color-text-sub)]"
                        />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="min-w-[176px] rounded-xl shadow-lg">
                    <DropdownMenuItem
                        onClick={onAddExpense}
                        className="gap-2 cursor-pointer text-[12px]"
                    >
                        <TrendingDownIcon
                            size={13}
                            className="text-[var(--color-warning)]"
                        />
                        Add Expense
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onClick={onRefresh}
                        className="gap-2 cursor-pointer text-[12px]"
                    >
                        <RefreshCwIcon size={13} />
                        Refresh
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => window.print()}
                        className="gap-2 cursor-pointer text-[12px]"
                    >
                        <PrinterIcon size={13} />
                        Print Report
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onClick={handleExportCSV}
                        className="gap-2 cursor-pointer text-[12px]"
                    >
                        <DownloadIcon size={13} />
                        Export CSV
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}