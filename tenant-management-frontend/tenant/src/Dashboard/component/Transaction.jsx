import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import DualCalendarTailwind from "@/components/dualDate";
import {
    ScanLine,
    Plus,
    ChevronDown,
    Search,
    MoreVertical,
    FileText,
    RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "../../../plugins/axios";
import { toast } from "sonner";

const STATUS_STYLES = {
    accepted: "bg-green-100 text-green-700",
    posted: "bg-green-100 text-green-700",
    pending: "bg-orange-100 text-orange-700",
    rejected: "bg-red-100 text-red-700",
    voided: "bg-gray-100 text-gray-600",
};

/** Map API transaction document to table row shape */
function mapTransactionToRow(tx) {
    const amountRupees = tx.totalAmountPaisa != null ? tx.totalAmountPaisa / 100 : 0;
    const displayStatus = (tx.status || "POSTED").toLowerCase();
    const typeLabel = (tx.type || "").replace(/_/g, " ");
    return {
        id: tx._id,
        name: typeLabel || tx.referenceType || "Transaction",
        description: tx.description || "",
        date: tx.transactionDate,
        amount: amountRupees,
        account: tx.referenceType || "—",
        status: displayStatus,
        rawType: tx.type || "",
    };
}

function formatDisplayDate(isoDate) {
    if (!isoDate) return "—";
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function formatAmount(amount) {
    return `Rs. ${Number(amount).toLocaleString("en-NP")}`;
}

function getInitials(name) {
    return name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function Transaction() {
    const [search, setSearch] = useState("");
    const [transactionType, setTransactionType] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateStart, setDateStart] = useState("");
    const [dateEnd, setDateEnd] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/api/transactions/get-all");
            const list = Array.isArray(data?.data) ? data.data : [];
            setTransactions(list.map(mapTransactionToRow));
        } catch (err) {
            setError(err.response?.data?.message || "Failed to fetch transactions");
            toast.error("Failed to load transactions");
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const filtered = useMemo(() => {
        let list = [...transactions];
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (t) =>
                    t.name.toLowerCase().includes(q) ||
                    t.description?.toLowerCase().includes(q) ||
                    String(t.id).toLowerCase().includes(q)
            );
        }
        if (statusFilter !== "all") {
            list = list.filter((t) => t.status === statusFilter);
        }
        if (dateStart) {
            list = list.filter((t) => (t.date ? String(t.date).slice(0, 10) >= dateStart : false));
        }
        if (dateEnd) {
            list = list.filter((t) => (t.date ? String(t.date).slice(0, 10) <= dateEnd : false));
        }
        if (transactionType !== "all") {
            if (transactionType === "rent") {
                list = list.filter((t) => /RENT|CAM|SECURITY_DEPOSIT/.test(t.rawType));
            } else if (transactionType === "expense") {
                list = list.filter((t) => /EXPENSE|MAINTENANCE/.test(t.rawType));
            } else if (transactionType === "payment") {
                list = list.filter((t) => /PAYMENT|CHARGE/.test(t.rawType));
            }
        }
        return list;
    }, [transactions, search, transactionType, statusFilter, dateStart, dateEnd]);

    const toggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map((t) => t.id)));
        }
    };

    return (
        <div className="min-h-screen">
            {/* Header */}
            <div className="p-4 sm:p-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-orange-900 leading-tight">
                    Transactions
                </h1>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-1">
                    <p className="text-sm text-gray-500">
                        Accurate time tracking for better productivity.
                    </p>

                </div>
            </div>

            {/* Filters */}
            <div className="px-4 sm:px-6 pb-4">
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Input
                            type="search"
                            placeholder="Search by name, TXD ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 rounded-md border-gray-300 bg-white text-gray-900 placeholder:text-gray-500"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                        <div className="w-full sm:w-[180px]">
                            <Select value={transactionType} onValueChange={setTransactionType}>
                                <SelectTrigger className="w-full rounded-md border-gray-300 bg-white text-gray-900">
                                    <SelectValue placeholder="Transaction Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="rent">Rent</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                    <SelectItem value="payment">Payment</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full sm:w-[140px]">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full rounded-md border-gray-300 bg-white text-gray-900">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="posted">Posted</SelectItem>
                                    <SelectItem value="accepted">Accepted</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="voided">Voided</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 flex-1 sm:flex-initial">
                            <div className="min-w-0">
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                                    Start date
                                </label>
                                <DualCalendarTailwind
                                    value={dateStart}
                                    onChange={(english) => setDateStart(english ?? "")}
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                                    End date
                                </label>
                                <DualCalendarTailwind
                                    value={dateEnd}
                                    onChange={(english) => setDateEnd(english ?? "")}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table card */}
            <div className="px-4 sm:px-6 pb-6">
                <div className="rounded-xl shadow-md bg-white border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        {/* Desktop table */}
                        <Table className="hidden md:table">
                            <TableHeader>
                                <TableRow className="border-gray-100 hover:bg-transparent">
                                    <TableHead className="w-[40px] pr-0">
                                        <input
                                            type="checkbox"
                                            checked={
                                                filtered.length > 0 &&
                                                selectedIds.size === filtered.length
                                            }
                                            onChange={toggleSelectAll}
                                            disabled={loading}
                                            className="rounded border-gray-300 text-orange-900 focus:ring-orange-500"
                                        />
                                    </TableHead>
                                    <TableHead className="text-gray-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            Transactions
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-gray-400 hover:text-orange-600"
                                                onClick={fetchTransactions}
                                                disabled={loading}
                                            >
                                                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                                            </Button>
                                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                        </span>
                                    </TableHead>
                                    <TableHead className="text-gray-500 font-medium">Date</TableHead>
                                    <TableHead className="text-gray-500 font-medium">
                                        Amount
                                    </TableHead>
                                    <TableHead className="text-gray-500 font-medium">
                                        Account
                                    </TableHead>
                                    <TableHead className="text-gray-500 font-medium">
                                        Status
                                    </TableHead>
                                    <TableHead className="text-gray-500 font-medium w-[100px]">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                                            Loading transactions…
                                        </TableCell>
                                    </TableRow>
                                ) : error ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12">
                                            <p className="text-gray-600 mb-2">{error}</p>
                                            <Button variant="outline" size="sm" onClick={fetchTransactions}>
                                                Retry
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className="border-gray-100 hover:bg-gray-50/80"
                                        >
                                            <TableCell className="pr-0">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(row.id)}
                                                    onChange={() => toggleSelect(row.id)}
                                                    className="rounded border-gray-300 text-orange-900 focus:ring-orange-500"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200">
                                                        <AvatarFallback className="rounded-full bg-orange-100 text-orange-800 text-xs font-medium">
                                                            {getInitials(row.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            {row.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {row.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-gray-600">
                                                {formatDisplayDate(row.date)}
                                            </TableCell>
                                            <TableCell className="font-medium text-gray-900 tabular-nums">
                                                {formatAmount(row.amount)}
                                            </TableCell>
                                            <TableCell className="text-gray-600">
                                                {row.account}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={cn(
                                                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                                                        STATUS_STYLES[row.status] ?? STATUS_STYLES.pending
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "h-1.5 w-1.5 rounded-full",
                                                            (row.status === "accepted" || row.status === "posted") && "bg-green-500",
                                                            row.status === "pending" && "bg-orange-500",
                                                            row.status === "rejected" && "bg-red-500",
                                                            row.status === "voided" && "bg-gray-500"
                                                        )}
                                                    />
                                                    {row.status === "posted" ? "Posted" : row.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-gray-300 text-gray-700 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-200 text-xs"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        Details
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-gray-500 hover:bg-gray-100"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuItem>View details</DropdownMenuItem>
                                                            <DropdownMenuItem>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-red-600">
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )))}
                            </TableBody>
                        </Table>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {loading ? (
                                <div className="p-4 text-center py-12 text-gray-500">Loading transactions…</div>
                            ) : error ? (
                                <div className="p-4 text-center py-12">
                                    <p className="text-gray-600 mb-2">{error}</p>
                                    <Button variant="outline" size="sm" onClick={fetchTransactions}>Retry</Button>
                                </div>
                            ) : (
                                filtered.map((row) => (
                                    <div
                                        key={row.id}
                                        className="p-4 flex flex-col gap-3 hover:bg-gray-50/50"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(row.id)}
                                                    onChange={() => toggleSelect(row.id)}
                                                    className="rounded border-gray-300 text-orange-900 focus:ring-orange-500 shrink-0 mt-0.5"
                                                />
                                                <Avatar className="h-10 w-10 rounded-full bg-gray-100 border border-gray-200 shrink-0">
                                                    <AvatarFallback className="rounded-full bg-orange-100 text-orange-800 text-xs font-medium">
                                                        {getInitials(row.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 truncate">
                                                        {row.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {row.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 shrink-0 text-gray-500"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem>View details</DropdownMenuItem>
                                                    <DropdownMenuItem>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-red-600">
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2 pl-[46px]">
                                            <span className="text-sm text-gray-500">
                                                {formatDisplayDate(row.date)}
                                            </span>
                                            <span className="font-semibold text-gray-900 tabular-nums">
                                                {formatAmount(row.amount)}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2 pl-[46px]">
                                            <span className="text-xs text-gray-500">{row.account}</span>
                                            <span
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                                                    STATUS_STYLES[row.status] ?? STATUS_STYLES.pending
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        "h-1.5 w-1.5 rounded-full",
                                                        (row.status === "accepted" || row.status === "posted") && "bg-green-500",
                                                        row.status === "pending" && "bg-orange-500",
                                                        row.status === "rejected" && "bg-red-500",
                                                        row.status === "voided" && "bg-gray-500"
                                                    )}
                                                />
                                                {row.status === "posted" ? "Posted" : row.status}
                                            </span>
                                        </div>
                                        <div className="pl-[46px]">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full sm:w-auto border-gray-300 text-gray-700 hover:bg-orange-50 hover:text-orange-800 text-xs"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                Details
                                            </Button>
                                        </div>
                                    </div>
                                )))}
                        </div>
                    </div>

                    {!loading && !error && filtered.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-500">
                                No transactions found
                            </p>
                            <p className="text-xs text-gray-400">
                                Try adjusting filters or search
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Transaction;
