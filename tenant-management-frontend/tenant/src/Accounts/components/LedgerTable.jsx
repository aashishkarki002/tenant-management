/**
 * LedgerTable.jsx
 *
 * Date cells use toBSDate (Nepali calendar) instead of toLocaleDateString.
 *
 * Order: entries are rendered in API order. The ledger endpoint returns rows
 * chronological ascending (FIFO: earliest at top, latest at bottom) with
 * runningBalance computed server-side — no client sorting.
 */

import { useState } from "react";
import { usePagination } from "../hooks/usePagination";
import { toBSDate } from "../utils/nepaliCalendar";   // ← replaces raw Date API
import { cn } from "@/lib/utils";
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Pagination, PaginationContent, PaginationItem,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import {
    ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon,
} from "lucide-react";

const LEDGER_FILTERS = [
    { value: "all", label: "All" },
    { value: "credit", label: "Credits" },
    { value: "debit", label: "Debits" },
];

export default function LedgerTable({
    entries,
    loading = false,
    itemsPerPage = 10,
}) {
    const [typeFilter, setTypeFilter] = useState("all");

    const filteredEntries = typeFilter === "all"
        ? entries
        : typeFilter === "credit"
            ? entries.filter(e => e.credit > 0)
            : entries.filter(e => e.debit > 0);

    const {
        currentPage, totalPages,
        startIndex, endIndex,
        paginatedItems,
        nextPage, prevPage, goToPage,
    } = usePagination(filteredEntries, itemsPerPage);

    return (
        <>
            {/* ── Type filter pills ───────────────────────────────────────────── */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[var(--color-border)]">
                {LEDGER_FILTERS.map(opt => {
                    const isActive = typeFilter === opt.value;
                    return (
                        <button
                            key={opt.value}
                            onClick={() => { setTypeFilter(opt.value); goToPage(1); }}
                            className="inline-flex items-center h-6 px-2.5 rounded-md text-[11px] font-semibold cursor-pointer transition-colors border"
                            style={{
                                background: isActive
                                    ? opt.value === "credit" ? "var(--color-success)"
                                        : opt.value === "debit" ? "var(--color-danger)"
                                            : "var(--color-accent)"
                                    : "transparent",
                                borderColor: isActive
                                    ? opt.value === "credit" ? "var(--color-success)"
                                        : opt.value === "debit" ? "var(--color-danger)"
                                            : "var(--color-accent)"
                                    : "var(--color-border)",
                                color: isActive ? "#fff" : "var(--color-text-sub)",
                            }}
                        >
                            {opt.label}
                        </button>
                    );
                })}
                {typeFilter !== "all" && (
                    <span className="text-[10px] ml-1" style={{ color: "var(--color-text-sub)" }}>
                        {filteredEntries.length} of {entries.length} entries
                    </span>
                )}
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-[var(--color-border)]">
                            <TableHead className="w-[160px] text-[11px] font-semibold text-[var(--color-text-weak)] uppercase tracking-[0.05em]">Date (BS)</TableHead>
                            <TableHead className="w-[160px] text-[11px] font-semibold text-[var(--color-text-weak)] uppercase tracking-[0.05em]">Invoice</TableHead>
                            <TableHead className="text-[11px] font-semibold text-[var(--color-text-weak)] uppercase tracking-[0.05em]">Description</TableHead>
                            <TableHead className="text-[11px] font-semibold text-[var(--color-text-weak)] uppercase tracking-[0.05em]">Debit</TableHead>
                            <TableHead className="text-[11px] font-semibold text-[var(--color-text-weak)] uppercase tracking-[0.05em]">Credit</TableHead>
                            <TableHead className="text-right text-[11px] font-semibold text-[var(--color-text-weak)] uppercase tracking-[0.05em]">Running Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-[var(--color-text-sub)]">Loading…</TableCell>
                            </TableRow>
                        ) : filteredEntries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-[var(--color-text-sub)]">
                                    {typeFilter === "all" ? "No ledger entries" : `No ${typeFilter} entries for this period`}
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedItems.map((entry, index) => (
                                <TableRow
                                    key={entry._id}
                                    className={cn(
                                        "border-b border-[var(--color-border)] transition-colors duration-100 hover:bg-[var(--color-bg)]",
                                        index % 2 === 0 ? "bg-[var(--color-surface)]" : "bg-transparent",
                                    )}
                                >
                                    <TableCell className="text-[12px] tabular-nums text-[var(--color-text-body)]">
                                        {toBSDate(entry.date)}
                                    </TableCell>
                                    <TableCell className="text-[12px] tabular-nums text-[var(--color-text-body)]">
                                        {entry?.voucherNo || "—"}
                                    </TableCell>
                                    <TableCell className="text-[12px] text-[var(--color-text-body)]">
                                        {entry.description || entry.account?.name || "—"}
                                    </TableCell>
                                    <TableCell className="text-[12px] font-medium tabular-nums text-[var(--color-danger)]">
                                        {entry.debit ? `−RS ${entry.debit.toLocaleString()}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-[12px] font-medium tabular-nums text-[var(--color-success)]">
                                        {entry.credit ? `+RS ${entry.credit.toLocaleString()}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-[12px] font-semibold tabular-nums text-[var(--color-text-strong)]">
                                        {entry.runningBalance !== undefined
                                            ? `RS ${entry.runningBalance.toLocaleString()}`
                                            : "—"}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {filteredEntries.length > itemsPerPage && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-4 border-t px-4 pb-4">
                    <div className="text-sm text-muted-foreground text-center sm:text-left">
                        Showing {startIndex + 1}–{Math.min(endIndex, filteredEntries.length)} of {filteredEntries.length} entries
                    </div>
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <Button variant="outline" size="sm" onClick={prevPage}
                                    disabled={currentPage === 1 || loading} className="gap-1 bg-transparent">
                                    <ChevronLeftIcon className="h-4 w-4" />
                                    <span className="hidden sm:inline">Previous</span>
                                </Button>
                            </PaginationItem>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                if (
                                    page === 1 || page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                ) {
                                    return (
                                        <PaginationItem key={page}>
                                            <Button
                                                variant={currentPage === page ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => goToPage(page)}
                                                disabled={loading}
                                                className="min-w-[2.5rem]">
                                                {page}
                                            </Button>
                                        </PaginationItem>
                                    );
                                } else if (page === currentPage - 2 || page === currentPage + 2) {
                                    return (
                                        <PaginationItem key={page}>
                                            <span className="flex h-9 w-9 items-center justify-center">
                                                <MoreHorizontalIcon className="h-4 w-4" />
                                            </span>
                                        </PaginationItem>
                                    );
                                }
                                return null;
                            })}

                            <PaginationItem>
                                <Button variant="outline" size="sm" onClick={nextPage}
                                    disabled={currentPage === totalPages || loading} className="gap-1 bg-transparent">
                                    <span className="hidden sm:inline">Next</span>
                                    <ChevronRightIcon className="h-4 w-4" />
                                </Button>
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </>
    );
}