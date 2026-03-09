// src/pages/dashboard/Transaction.jsx
// All colors use CSS variables — no hardcoded gray/zinc values.

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DualCalendarTailwind from "@/components/dualDate";
import { Search, MoreHorizontal, RefreshCw, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";

// ─── Status badge styles — semantic (green / yellow / red / neutral) ─────────
const STATUS_STYLES = {
    accepted: {
        bg: "color-mix(in oklch, var(--success) 16%, transparent)",
        color: "var(--success)",
        border: "color-mix(in oklch, var(--success) 35%, transparent)",
    },
    posted: {
        bg: "color-mix(in oklch, var(--success) 12%, transparent)",
        color: "var(--success)",
        border: "color-mix(in oklch, var(--success) 28%, transparent)",
    },
    pending: {
        bg: "color-mix(in oklch, var(--warning) 18%, transparent)",
        color: "var(--warning)",
        border: "color-mix(in oklch, var(--warning) 35%, transparent)",
    },
    rejected: {
        bg: "color-mix(in oklch, var(--destructive) 18%, transparent)",
        color: "var(--destructive)",
        border: "color-mix(in oklch, var(--destructive) 35%, transparent)",
    },
    voided: {
        bg: "var(--color-secondary)",
        color: "var(--color-muted-foreground)",
        border: "var(--color-border)",
    },
};

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] ?? STATUS_STYLES.voided;
    return (
        <span
            className="inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium"
            style={{ background: s.bg, color: s.color, borderColor: s.border }}
        >
            {status}
        </span>
    );
}

function mapTransactionToRow(tx) {
    return {
        id: tx._id,
        name: (tx.type || "Transaction").replace(/_/g, " "),
        description: tx.description || "",
        date: tx.transactionDate,
        amount: tx.totalAmountPaisa ? tx.totalAmountPaisa / 100 : 0,
        account: tx.referenceType || "—",
        status: (tx.status || "POSTED").toLowerCase(),
    };
}

function formatAmount(amount) {
    return `Rs. ${Number(amount).toLocaleString("en-NP")}`;
}

function formatDate(date) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Transaction() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [dateStart, setDateStart] = useState("");
    const [dateEnd, setDateEnd] = useState("");

    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get("/api/transactions/get-all");
            const list = Array.isArray(data?.data) ? data.data : [];
            setTransactions(list.map(mapTransactionToRow));
        } catch {
            toast.error("Failed to load transactions");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const filtered = useMemo(() => {
        return transactions.filter((t) => {
            if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
            if (statusFilter !== "all" && t.status !== statusFilter) return false;
            if (typeFilter !== "all" && !t.name.toLowerCase().includes(typeFilter)) return false;
            if (dateStart && t.date?.slice(0, 10) < dateStart) return false;
            if (dateEnd && t.date?.slice(0, 10) > dateEnd) return false;
            return true;
        });
    }, [transactions, search, statusFilter, typeFilter, dateStart, dateEnd]);

    return (
        <div className="min-h-screen w-full text-foreground">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link to="/dashboard/transactions">Transactions</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div className="w-full h-full">

                {/* Header */}
                <div className="flex items-center justify-between mb-4 p-4 border-b border-border">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Transactions</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            All financial activity across your system
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchTransactions}
                            className="border-border text-foreground hover:bg-secondary"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-4 p-4">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search transactions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9 bg-card border-border text-sm"
                        />
                    </div>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="h-9 w-36 text-sm">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="rent">Rent</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="payment">Payment</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-36 text-sm">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="posted">Posted</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="voided">Voided</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground">Start Date</label>
                        <DualCalendarTailwind value={dateStart} onChange={setDateStart} />
                        <label className="text-sm text-muted-foreground">End Date</label>
                        <DualCalendarTailwind value={dateEnd} onChange={setDateEnd} />
                    </div>
                </div>

                {/* Table */}
                <div className="w-full h-full overflow-auto">
                    <Table className="w-full">
                        <TableHeader className="bg-secondary">
                            <TableRow>
                                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Transaction</TableHead>
                                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Date</TableHead>
                                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Amount</TableHead>
                                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Account</TableHead>
                                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Status</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        Loading…
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        No transactions found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-secondary transition-colors">
                                        <TableCell>
                                            <div>
                                                <p className="font-medium text-sm text-foreground">{row.name}</p>
                                                <p className="text-xs text-muted-foreground">{row.description}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{formatDate(row.date)}</TableCell>
                                        <TableCell className="font-semibold text-sm tabular-nums text-foreground">
                                            {formatAmount(row.amount)}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{row.account}</TableCell>
                                        <TableCell><StatusBadge status={row.status} /></TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="hover:bg-secondary">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem>
                                                        <FileText className="w-4 h-4 mr-2" /> View
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}