import React, { useState, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useFormik } from "formik";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, Building2, Banknote } from "lucide-react";
import DragDropFileUpload from "@/components/DragDropFileUpload";
import { useBankAccounts } from "../../Accounts/hooks/useAccounting";
import { recordPayment } from "../utils/electricityApi";

// ─── Payment method options ───────────────────────────────────────────────────

const PAYMENT_METHODS = [
    { value: "cash", label: "Cash", Icon: Banknote },
    { value: "bank_transfer", label: "Bank Transfer", Icon: Building2 },
    { value: "cheque", label: "Cheque", Icon: CreditCard },
];

const BANK_REQUIRED = new Set(["bank_transfer", "cheque"]);
const fmtRs = (n) =>
    `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(values, remainingAmount, remainingAmountFormatted) {
    const errors = {};
    const amount = parseFloat(values.paymentAmount);

    if (!values.paymentAmount || Number.isNaN(amount) || amount <= 0) {
        errors.paymentAmount = "Enter a valid amount greater than zero.";
    } else if (amount > remainingAmount) {
        errors.paymentAmount = `Cannot exceed the remaining balance of ${remainingAmountFormatted}.`;
    }

    if (BANK_REQUIRED.has(values.paymentMethod) && !values.bankAccountId) {
        errors.bankAccountId = "Select a bank account to continue.";
    }

    return errors;
}

// ─── Summary row ─────────────────────────────────────────────────────────────

function SummaryRow({ label, value, strong = false, className = "" }) {
    return (
        <div className={`flex items-center justify-between gap-4 ${className}`}>
            <span
                className="text-sm"
                style={{ color: strong ? "var(--color-text-strong)" : "var(--color-text-sub)" }}
            >
                {label}
            </span>
            <span
                className="text-sm tabular-nums"
                style={{
                    color: strong ? "var(--color-text-strong)" : "var(--color-text-body)",
                    fontWeight: strong ? 600 : 400,
                }}
            >
                {value}
            </span>
        </div>
    );
}

// ─── Bank account card ────────────────────────────────────────────────────────

function BankAccountCard({ bank, selected, onSelect }) {
    const isSelected = selected === bank._id;
    return (
        <button
            type="button"
            onClick={() => onSelect(bank._id)}
            className="w-full text-left rounded-xl border-2 p-3.5 transition-all duration-150"
            style={{
                borderColor: isSelected ? "var(--color-accent)" : "var(--color-border)",
                backgroundColor: isSelected ? "var(--color-accent-light)" : "var(--color-surface)",
            }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p
                        className="text-sm font-semibold truncate"
                        style={{ color: "var(--color-text-strong)" }}
                    >
                        {bank.bankName}
                    </p>
                    <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--color-text-sub)" }}
                    >
                        {bank.accountName} · ****{bank.accountNumber?.slice(-4) ?? "xxxx"}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <p
                        className="text-xs font-medium"
                        style={{ color: "var(--color-text-weak)" }}
                    >
                        Balance
                    </p>
                    <p
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: "var(--color-text-strong)" }}
                    >
                        Rs {(bank.balance ?? 0).toLocaleString("en-NP")}
                    </p>
                </div>
                {isSelected && (
                    <CheckCircle2
                        className="w-5 h-5 shrink-0"
                        style={{ color: "var(--color-accent)" }}
                    />
                )}
            </div>
        </button>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ElectricityPaymentDialog({
    paymentDialogOpen,
    setPaymentDialogOpen,
    unitName,
    record,
    totalAmount,
    paidAmount,
    remainingAmount,
    onPaymentRecorded,
}) {
    const { bankAccounts = [] } = useBankAccounts();
    const totalAmountFormatted = fmtRs(totalAmount);
    const paidAmountFormatted = paidAmount > 0 ? fmtRs(paidAmount) : null;
    const remainingAmountFormatted = fmtRs(remainingAmount);

    const formik = useFormik({
        initialValues: {
            paymentAmount: "",
            paymentMethod: "bank_transfer",
            bankAccountId: "",
            receiptFile: null,
        },
        validate: (values) => validate(values, remainingAmount, remainingAmountFormatted),
        onSubmit: async (values, { setSubmitting, resetForm }) => {
            try {
                await recordPayment(
                    {
                        electricityId: record._id,
                        amount: parseFloat(values.paymentAmount),
                        nepaliDate: record.nepaliDate,
                        paymentDate: new Date().toISOString(),
                        paymentMethod: values.paymentMethod,
                        ...(BANK_REQUIRED.has(values.paymentMethod) && {
                            bankAccountId: values.bankAccountId,
                        }),
                    },
                    values.receiptFile ?? undefined
                );

                toast.success("Payment recorded successfully.");
                resetForm();
                setPaymentDialogOpen(false);
                onPaymentRecorded?.();
            } catch (err) {
                toast.error(err?.message || "Failed to record payment.");
            } finally {
                setSubmitting(false);
            }
        },
    });

    const handleOpenChange = useCallback(
        (open) => {
            if (formik.isSubmitting) return;
            if (!open) formik.resetForm();
            setPaymentDialogOpen(open);
        },
        [formik, setPaymentDialogOpen]
    );

    const handleMethodChange = useCallback(
        (value) => {
            formik.setFieldValue("paymentMethod", value);
            if (!BANK_REQUIRED.has(value)) {
                formik.setFieldValue("bankAccountId", "");
            }
        },
        [formik]
    );

    const showBankPicker = BANK_REQUIRED.has(formik.values.paymentMethod);

    return (
        <Dialog open={paymentDialogOpen} onOpenChange={handleOpenChange}>
            {/*
        max-h-[90dvh] + flex-col keeps the header and footer pinned while
        the body scrolls — the only correct pattern for tall dialogs on mobile.
      */}
            <DialogContent
                className="flex flex-col sm:max-w-lg rounded-2xl p-0 gap-0 overflow-hidden"
                style={{ maxHeight: "90dvh" }}
            >
                {/* ── Fixed header ───────────────────────────────────────────── */}
                <DialogHeader
                    className="px-6 pt-6 pb-4 shrink-0 border-b"
                    style={{ borderColor: "var(--color-border)" }}
                >
                    <DialogTitle
                        className="text-lg font-bold"
                        style={{ color: "var(--color-text-strong)" }}
                    >
                        Record Electricity Payment
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span
                            className="text-sm font-medium"
                            style={{ color: "var(--color-text-body)" }}
                        >
                            {unitName}
                        </span>
                        {record?.nepaliDate && (
                            <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                    backgroundColor: "var(--color-surface)",
                                    color: "var(--color-text-sub)",
                                    border: "1px solid var(--color-border)",
                                }}
                            >
                                {record.nepaliDate}
                            </span>
                        )}
                    </div>
                </DialogHeader>

                {/* ── Scrollable body ─────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                    {/* Payment summary */}
                    <div
                        className="rounded-xl p-4 space-y-2.5"
                        style={{
                            backgroundColor: "var(--color-surface)",
                            border: "1px solid var(--color-border)",
                        }}
                    >
                        <p
                            className="text-[11px] font-bold uppercase tracking-wider mb-3"
                            style={{ color: "var(--color-text-weak)" }}
                        >
                            Bill Summary
                        </p>
                        <SummaryRow label="Total Amount" value={totalAmountFormatted} />
                        {paidAmount > 0 && (
                            <SummaryRow
                                label="Already Paid"
                                value={paidAmountFormatted ?? "-"}
                                className="pb-2.5 border-b"
                                style={{ borderColor: "var(--color-border)" }}
                            />
                        )}
                        <div
                            className="flex items-center justify-between gap-4 pt-1"
                        >
                            <span
                                className="text-sm font-semibold"
                                style={{ color: "var(--color-warning)" }}
                            >
                                Remaining Due
                            </span>
                            <span
                                className="text-base font-bold tabular-nums"
                                style={{ color: "var(--color-warning)" }}
                            >
                                {remainingAmountFormatted}
                            </span>
                        </div>
                    </div>

                    {/* Form */}
                    <form
                        id="electricity-payment-form"
                        onSubmit={formik.handleSubmit}
                        className="space-y-5"
                    >
                        {/* Amount */}
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="paymentAmount"
                                style={{ color: "var(--color-text-body)" }}
                            >
                                Payment Amount
                                <span style={{ color: "var(--color-danger)" }}> *</span>
                            </Label>
                            <div className="relative">
                                <span
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                                    style={{ color: "var(--color-text-sub)" }}
                                >
                                    Rs
                                </span>
                                <Input
                                    id="paymentAmount"
                                    name="paymentAmount"
                                    type="number"
                                    min="0.01"
                                    max={remainingAmount}
                                    step="0.01"
                                    value={formik.values.paymentAmount}
                                    onChange={formik.handleChange}
                                    onBlur={formik.handleBlur}
                                    placeholder={`Max ${remainingAmountFormatted}`}
                                    className="pl-9"
                                />
                            </div>
                            {formik.touched.paymentAmount && formik.errors.paymentAmount && (
                                <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                                    {formik.errors.paymentAmount}
                                </p>
                            )}
                        </div>

                        {/* Payment method */}
                        <div className="space-y-1.5">
                            <Label style={{ color: "var(--color-text-body)" }}>
                                Payment Method
                                <span style={{ color: "var(--color-danger)" }}> *</span>
                            </Label>
                            <Select
                                value={formik.values.paymentMethod}
                                onValueChange={handleMethodChange}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_METHODS.map(({ value, label, Icon }) => (
                                        <SelectItem key={value} value={value}>
                                            <div className="flex items-center gap-2">
                                                <Icon className="w-4 h-4" />
                                                {label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Bank account — shown only for bank_transfer / cheque */}
                        {showBankPicker && (
                            <div className="space-y-2">
                                <Label style={{ color: "var(--color-text-body)" }}>
                                    Deposit To
                                    <span style={{ color: "var(--color-danger)" }}> *</span>
                                </Label>
                                {bankAccounts.length === 0 ? (
                                    <p
                                        className="text-sm"
                                        style={{ color: "var(--color-text-sub)" }}
                                    >
                                        No bank accounts configured.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {bankAccounts.map((bank) => (
                                            <BankAccountCard
                                                key={bank._id}
                                                bank={bank}
                                                selected={formik.values.bankAccountId}
                                                onSelect={(id) => formik.setFieldValue("bankAccountId", id)}
                                            />
                                        ))}
                                    </div>
                                )}
                                {formik.touched.bankAccountId && formik.errors.bankAccountId && (
                                    <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                                        {formik.errors.bankAccountId}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Receipt upload */}
                        <div className="space-y-1.5">
                            <Label style={{ color: "var(--color-text-body)" }}>
                                Receipt{" "}
                                <span style={{ color: "var(--color-text-weak)" }}>(optional)</span>
                            </Label>
                            <DragDropFileUpload
                                value={formik.values.receiptFile}
                                onChange={(file) => formik.setFieldValue("receiptFile", file)}
                            />
                        </div>
                    </form>
                </div>

                {/* ── Fixed footer ────────────────────────────────────────────── */}
                <DialogFooter
                    className="px-6 py-4 shrink-0 border-t flex gap-2"
                    style={{ borderColor: "var(--color-border)" }}
                >
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={formik.isSubmitting}
                        className="flex-1 sm:flex-none"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="electricity-payment-form"
                        disabled={formik.isSubmitting}
                        className="flex-1 sm:flex-none"
                        style={{
                            backgroundColor: "var(--color-accent)",
                            color: "#fff",
                        }}
                    >
                        {formik.isSubmitting ? "Saving…" : "Confirm Payment"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}