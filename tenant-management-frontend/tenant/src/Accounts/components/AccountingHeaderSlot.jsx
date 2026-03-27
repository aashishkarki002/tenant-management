/**
 * AccountingHeaderSlot.jsx
 *
 * The right-hand actions injected into the app's sticky header via useHeaderSlot().
 * Contains:
 *   • "Add Revenue" primary CTA button
 *   • Overflow (⋮) menu — Add Expense, Refresh, Print, Export CSV
 *
 * Props:
 *   onAddRevenue  () => void
 *   onAddExpense  () => void
 *   onRefresh     () => void
 *   summary       object | null   — from useAccounting, used for CSV export
 *   filterLabel   string          — human-readable period label for the CSV filename/row
 */

import {
    PlusIcon, MoreVerticalIcon, RefreshCwIcon,
    PrinterIcon, DownloadIcon,
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
            [rows.map(r => r.join(",")).join("\n")],
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
        <div className="ml-auto flex items-center gap-2">
            {/* Primary CTA */}
            <Button
                onClick={onAddRevenue}
                size="sm"
                className="gap-1.5 h-8 px-3 text-[13px] font-semibold bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-sm rounded-lg"
            >
                <PlusIcon size={14} strokeWidth={2.5} />
                Add Revenue
            </Button>

            {/* Overflow menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg border-[var(--color-border)] bg-transparent hover:bg-[var(--color-surface)]"
                    >
                        <MoreVerticalIcon size={15} className="text-[var(--color-text-sub)]" />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="min-w-[180px] rounded-xl">
                    <DropdownMenuItem
                        onClick={onAddExpense}
                        className="gap-2 cursor-pointer text-[13px]"
                    >
                        <PlusIcon size={14} className="text-[var(--color-warning)]" />
                        Add Expense
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onClick={onRefresh}
                        className="gap-2 cursor-pointer text-[13px]"
                    >
                        <RefreshCwIcon size={14} />
                        Refresh
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => window.print()}
                        className="gap-2 cursor-pointer text-[13px]"
                    >
                        <PrinterIcon size={14} />
                        Print Report
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onClick={handleExportCSV}
                        className="gap-2 cursor-pointer text-[13px]"
                    >
                        <DownloadIcon size={14} />
                        Export CSV
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}