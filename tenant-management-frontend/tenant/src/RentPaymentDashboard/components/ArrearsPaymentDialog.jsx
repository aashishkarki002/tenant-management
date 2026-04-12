// src/pages/rent/components/ArrearsPaymentDialog.jsx
//
// Multi-month arrears payment dialog.
// Opened from RentTableRow when the tenant has prevBalance / multiple overdue months.
//
// Props:
//   open          boolean
//   onClose       () => void
//   tenant        { _id, name }
//   bankAccounts  BankAccount[]
//   onSuccess     (result) => void    — called after successful submit

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { AlertTriangle, CheckSquare, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArrearsPayment } from "../hooks/useArrearsPayment";
import DualCalendarTailwind from "../../components/dualDate";
import BankAccountSelect from "@/components/BankAccountSelect";
import {
    getLedgerPaymentMethodSelectOptions,
} from "@/constants/paymentMethods.js";

// ── Nepali month names ────────────────────────────────────────────────────────
const NEPALI_MONTHS = [
    "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CLASS = {
    overdue: "bg-red-50 text-red-700 border-red-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    partially_paid: "bg-orange-50 text-orange-700 border-orange-200",
};

const STATUS_LABEL = {
    overdue: "Overdue",
    pending: "Pending",
    partially_paid: "Partial",
};

const fmtRs = (n) =>
    `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

// ── Month row ─────────────────────────────────────────────────────────────────
const MonthRow = ({ record, checked, onToggle }) => (
    <div
        className={cn(
            "flex items-start gap-3 px-3 py-2.5 border-b border-border last:border-b-0",
            "cursor-pointer select-none transition-colors",
            checked ? "bg-amber-50/50" : "hover:bg-accent/40",
        )}
        onClick={() => onToggle(record._id)}
    >
        {/* Checkbox */}
        <div className="mt-0.5 shrink-0">
            {checked ? (
                <CheckSquare className="size-4 text-foreground" />
            ) : (
                <Square className="size-4 text-muted-foreground" />
            )}
        </div>

        {/* Month info */}
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                    {record.monthName} {record.nepaliYear}
                </span>
                <Badge
                    className={cn(
                        "capitalize border text-[10px] px-1.5 py-0.5 font-medium",
                        STATUS_CLASS[record.status] ?? "bg-gray-100 text-gray-700 border-gray-200",
                    )}
                >
                    {STATUS_LABEL[record.status] ?? record.status}
                </Badge>
            </div>
            {record.hasLateFee && (
                <p className="text-[10px] text-rose-600 mt-0.5">
                    + {fmtRs(record.remainingLateFee)} late fee
                </p>
            )}
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
            <p className="text-sm font-semibold tabular-nums text-foreground">
                {fmtRs(record.totalRemaining)}
            </p>
            {record.remainingRentPaisa !== record.totalRemainingPaisa && (
                <p className="text-[10px] text-muted-foreground">
                    rent {fmtRs(record.remainingRent)}
                </p>
            )}
        </div>
    </div>
);

// ── Main export ───────────────────────────────────────────────────────────────
export const ArrearsPaymentDialog = ({
    open,
    onClose,
    tenant,
    bankAccounts = [],
    onSuccess,
}) => {
    const hook = useArrearsPayment({ tenant, onSuccess, onClose });

    const {
        arrears,
        loading,
        submitting,
        fetchError,
        selectedIds,
        selectedArrears,
        selectedTotal,
        selectedRentOnlyPaisa,
        selectedLateFeePaisa,
        toggleMonth,
        selectAll,
        deselectAll,
        amount,
        setAmount,
        paymentDate,
        setPaymentDate,
        nepaliDate,
        setNepaliDate,
        paymentMethod,
        setPaymentMethod,
        bankAccountId,
        setBankAccountId,
        bankAccountCode,
        setBankAccountCode,
        transactionRef,
        setTransactionRef,
        note,
        setNote,
        amountNum,
        needsBankAccount,
        fillFullAmount,
        validationErrors,
        isValid,
        submit,
    } = hook;

    const allSelected = arrears.length > 0 && selectedIds.size === arrears.length;
    const paymentMethodOptions = getLedgerPaymentMethodSelectOptions();

    // Balance display
    const balancePaisa = Math.round(amountNum * 100) - (selectedIds.size > 0
        ? selectedArrears.reduce((s, r) => s + r.totalRemainingPaisa, 0)
        : 0);
    const overpaying = balancePaisa > 0;
    const underpaying = balancePaisa < 0 && amountNum > 0;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
            <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">

                {/* ── Header ─────────────────────────────────────────────────────────── */}
                <DialogHeader className="px-5 pt-4 pb-3 border-b border-border shrink-0">
                    <DialogTitle className="text-sm font-medium">
                        Pay Arrears — {tenant?.name ?? "Tenant"}
                    </DialogTitle>
                    {arrears.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {arrears.length} month{arrears.length !== 1 ? "s" : ""} outstanding
                            &nbsp;·&nbsp;
                            {fmtRs(arrears.reduce((s, r) => s + r.totalRemaining, 0))} total
                        </p>
                    )}
                </DialogHeader>

                {/* ── Scrollable body ─────────────────────────────────────────────────── */}
                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

                    {/* Loading state */}
                    {loading && (
                        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            <span className="text-sm">Loading arrears…</span>
                        </div>
                    )}

                    {/* Error state */}
                    {!loading && fetchError && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-xs text-destructive">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            {fetchError}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !fetchError && arrears.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No outstanding months found for this tenant.
                        </p>
                    )}

                    {/* ── Month selection ─────────────────────────────────────────────── */}
                    {!loading && arrears.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    Select months
                                </p>
                                <button
                                    type="button"
                                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={allSelected ? deselectAll : selectAll}
                                >
                                    {allSelected ? "Deselect all" : "Select all"}
                                </button>
                            </div>
                            <div className="rounded-md border border-border overflow-hidden">
                                {arrears.map((record) => (
                                    <MonthRow
                                        key={record._id}
                                        record={record}
                                        checked={selectedIds.has(record._id)}
                                        onToggle={toggleMonth}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Summary strip ───────────────────────────────────────────────── */}
                    {selectedIds.size > 0 && (
                        <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/40 border border-border px-4 py-3">
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Months
                                </p>
                                <p className="text-sm font-semibold mt-0.5">{selectedIds.size}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Rent
                                </p>
                                <p className="text-sm font-semibold mt-0.5 tabular-nums">
                                    {fmtRs(selectedRentOnlyPaisa / 100)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                    Late fees
                                </p>
                                <p className={cn(
                                    "text-sm font-semibold mt-0.5 tabular-nums",
                                    selectedLateFeePaisa > 0 ? "text-rose-600" : "text-muted-foreground",
                                )}>
                                    {selectedLateFeePaisa > 0 ? fmtRs(selectedLateFeePaisa / 100) : "—"}
                                </p>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* ── Payment date ─────────────────────────────────────────────────── */}
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                            Payment date
                        </p>
                        <DualCalendarTailwind
                            value={paymentDate}
                            nepaliValue={nepaliDate}
                            onChange={(ad, bs) => {
                                setPaymentDate(ad);
                                setNepaliDate(bs);
                            }}
                        />
                    </div>

                    {/* ── Amount ──────────────────────────────────────────────────────── */}
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                            Amount received (₹)
                        </p>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="h-8 text-sm tabular-nums"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0 text-xs"
                                onClick={fillFullAmount}
                                disabled={selectedIds.size === 0}
                            >
                                Full amt
                            </Button>
                        </div>

                        {/* Over/under indicator */}
                        {amountNum > 0 && selectedIds.size > 0 && (
                            <p className={cn(
                                "text-[11px] mt-1.5",
                                overpaying ? "text-amber-600" : underpaying ? "text-sky-600" : "text-emerald-600",
                            )}>
                                {overpaying
                                    ? `₹${Math.abs(balancePaisa / 100).toLocaleString()} more than due — will be noted`
                                    : underpaying
                                        ? `₹${Math.abs(balancePaisa / 100).toLocaleString()} short — partial payment`
                                        : "✓ Covers selected months exactly"}
                            </p>
                        )}
                    </div>

                    {/* ── Payment method ───────────────────────────────────────────────── */}
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                            Payment method
                        </p>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Select method…" />
                            </SelectTrigger>
                            <SelectContent>
                                {paymentMethodOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ── Bank account ─────────────────────────────────────────────────── */}
                    {needsBankAccount && (
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                                Bank account
                            </p>
                            <BankAccountSelect
                                bankAccounts={bankAccounts}
                                value={bankAccountId}
                                onChange={(id, code) => {
                                    setBankAccountId(id);
                                    setBankAccountCode(code);
                                }}
                            />
                        </div>
                    )}

                    {/* ── Optional fields ──────────────────────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                                Transaction ref
                            </p>
                            <Input
                                value={transactionRef}
                                onChange={(e) => setTransactionRef(e.target.value)}
                                placeholder="Optional"
                                className="h-8 text-xs"
                            />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                                Note
                            </p>
                            <Input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Optional"
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>

                    {/* ── Partial payment notice ───────────────────────────────────────── */}
                    {underpaying && amountNum > 0 && (
                        <div className="flex items-start gap-2 rounded-md bg-sky-50 border border-sky-200 px-3 py-2.5 text-xs text-sky-700">
                            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                            <span>
                                Amount is less than selected total. Oldest months are cleared
                                first; remaining balance stays outstanding.
                            </span>
                        </div>
                    )}

                    {/* ── Validation errors ────────────────────────────────────────────── */}
                    {validationErrors.length > 0 && (
                        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 space-y-0.5">
                            {validationErrors.map((e, i) => (
                                <p key={i} className="text-[11px] text-destructive">
                                    {e}
                                </p>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Footer ──────────────────────────────────────────────────────────── */}
                <div className="px-5 py-3 border-t border-border bg-background shrink-0 flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="flex-[2] h-8 text-xs font-semibold"
                        disabled={!isValid || submitting || loading}
                        onClick={submit}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="size-3 mr-1.5 animate-spin" />
                                Processing…
                            </>
                        ) : (
                            `Record Payment — ${selectedIds.size} month${selectedIds.size !== 1 ? "s" : ""}`
                        )}
                    </Button>
                </div>

            </DialogContent>
        </Dialog>
    );
};