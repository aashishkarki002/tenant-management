import React from "react";
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
import DragDropFileUpload from "@/components/DragDropFileUpload";
import { useBankAccounts } from "../../Accounts/hooks/useAccounting";
import { recordPayment } from "../utils/electricityApi";

/**
 * ElectricityPaymentDialog
 *
 * Industry pattern: the dialog validates input, calls the API, then delegates
 * state refresh to the parent via onPaymentRecorded(). No internal data refetch.
 *
 * Payment flow:
 *   1. User enters amount (capped at remainingAmount)
 *   2. User optionally attaches a receipt image
 *   3. POST /api/electricity/record-payment — multipart if receipt, JSON if not
 *   4. Backend updates paidAmountPaisa, status, and appends a ledger transaction
 *   5. onPaymentRecorded() triggers parent refetch
 */
export default function ElectricityPaymentDialog({
    paymentDialogOpen,
    setPaymentDialogOpen,
    unitName,
    record,
    totalAmountFormatted,
    paidAmount,
    paidAmountFormatted,
    remainingAmount,
    remainingAmountFormatted,
    /** Called after a successful payment so the parent can refetch */
    onPaymentRecorded,
}) {
    const { bankAccounts = [] } = useBankAccounts();
    const [selectedBankAccountId, setSelectedBankAccountId] = React.useState("");

    const formik = useFormik({
        initialValues: {
            paymentAmount: "",
            paymentMethod: "bank_transfer",
            bankAccountId: "",
            receiptFile: null,
        },
        validate: (values) => {
            const errors = {};
            const amount = parseFloat(values.paymentAmount);
            if (!values.paymentAmount || Number.isNaN(amount) || amount <= 0) {
                errors.paymentAmount = "Enter a valid amount greater than zero.";
            } else if (amount > remainingAmount) {
                errors.paymentAmount = `Amount cannot exceed remaining due (${remainingAmountFormatted}).`;
            }
            const paymentMethod = String(values.paymentMethod || "bank_transfer").toLowerCase();
            if ((paymentMethod === "bank_transfer" || paymentMethod === "cheque") && !values.bankAccountId) {
                errors.bankAccountId = "Please select a bank account.";
            }
            return errors;
        },
        onSubmit: async (values, { setSubmitting, resetForm }) => {
            try {
                const paymentMethod = String(values.paymentMethod || "bank_transfer").toLowerCase();
                const payload = {
                    electricityId: record._id,
                    amount: parseFloat(values.paymentAmount),
                    nepaliDate: record.nepaliDate,
                    paymentDate: new Date().toISOString(),
                    paymentMethod,
                };
                if (paymentMethod === "bank_transfer" || paymentMethod === "cheque") {
                    if (values.bankAccountId) payload.bankAccountId = values.bankAccountId;
                }
                await recordPayment(
                    payload,
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

    const handleOpenChange = (open) => {
        if (!formik.isSubmitting) {
            if (!open) {
                formik.resetForm();
                setSelectedBankAccountId("");
            }
            setPaymentDialogOpen(open);
        }
    };

    return (
        <Dialog open={paymentDialogOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-2xl p-6">
                {/* Header */}
                <DialogHeader className="space-y-1">
                    <DialogTitle className="text-xl font-semibold">
                        Record Electricity Payment
                    </DialogTitle>
                    <p className="text-sm text-text-sub">
                        <span className="font-medium text-foreground">{unitName}</span>
                        {record?.nepaliDate && (
                            <span className="ml-2 text-xs bg-muted-fill px-2 py-0.5 rounded-full">
                                {record.nepaliDate}
                            </span>
                        )}
                    </p>
                </DialogHeader>

                {/* Payment Summary */}
                <div className="mt-4 rounded-xl bg-muted-fill/40 p-4 border space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-text-sub">Total Amount</span>
                        <span className="font-medium">{totalAmountFormatted}</span>
                    </div>
                    {paidAmount > 0 && (
                        <div className="flex justify-between text-sm text-success">
                            <span>Paid</span>
                            <span>{paidAmountFormatted}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-base font-semibold text-warning pt-2 border-t">
                        <span>Remaining</span>
                        <span>{remainingAmountFormatted}</span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={formik.handleSubmit} className="space-y-5 mt-5">
                    {/* Payment Amount */}
                    <div className="space-y-1">
                        <Label htmlFor="paymentAmount">Payment Amount (Rs)</Label>
                        <Input
                            id="paymentAmount"
                            type="number"
                            name="paymentAmount"
                            min="0.01"
                            max={remainingAmount}
                            step="0.01"
                            value={formik.values.paymentAmount}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            placeholder={`Enter amount (max ${remainingAmountFormatted})`}
                            className="mt-1"
                        />
                        {formik.touched.paymentAmount && formik.errors.paymentAmount && (
                            <p className="text-xs text-danger mt-1">
                                {formik.errors.paymentAmount}
                            </p>
                        )}
                    </div>

                    {/* Payment Method — same type/options as PaymentDialog (cash | bank_transfer | cheque) */}
                    <div className="space-y-2">
                        <label htmlFor="payment-method-electricity" className="text-sm font-medium text-text-strong">
                            Payment Method
                        </label>
                        <Select
                            value={formik.values?.paymentMethod || ""}
                            onValueChange={(value) => {
                                formik.setFieldValue("paymentMethod", value);
                                if (value !== "bank_transfer") {
                                    setSelectedBankAccountId("");
                                    formik.setFieldValue("bankAccountId", "");
                                }
                            }}
                        >
                            <SelectTrigger id="payment-method-electricity">
                                <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="cheque">Cheque</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Bank account picker — shown when payment method is bank_transfer (same as PaymentDialog) */}
                    {formik.values?.paymentMethod === "bank_transfer" && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-text-strong">Deposit To</label>
                            <div className="grid gap-3">
                                {Array.isArray(bankAccounts) &&
                                    bankAccounts.map((bank) => (
                                        <button
                                            key={bank._id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedBankAccountId(bank._id);
                                                formik.setFieldValue("bankAccountId", bank._id);
                                            }}
                                            className={`w-full text-left p-4 border-2 rounded-lg cursor-pointer transition-colors ${selectedBankAccountId === bank._id
                                                ? "border-text-strong bg-text-strong/[0.03]"
                                                : "border-border hover:border-border bg-surface-raised"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-text-strong">{bank.bankName}</p>
                                                    <p className="text-xs text-text-sub">
                                                        **** **** {bank.accountNumber?.slice(-4) || "****"}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-text-sub font-semibold uppercase tracking-wide">
                                                        Balance
                                                    </p>
                                                    <p className="font-semibold text-text-strong text-sm">
                                                        ₹{bank.balance?.toLocaleString() || "0"}
                                                    </p>
                                                </div>
                                                {selectedBankAccountId === bank._id && (
                                                    <div className="ml-3 text-text-strong">
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                            </div>
                            {formik.touched.bankAccountId && formik.errors.bankAccountId && (
                                <p className="text-xs text-danger mt-1      ">{formik.errors.bankAccountId}</p>
                            )}
                        </div>
                    )}

                    {/* Receipt Upload */}
                    <div className="space-y-1">
                        <DragDropFileUpload
                            value={formik.values.receiptFile}
                            onChange={(file) => formik.setFieldValue("receiptFile", file)}
                        />
                    </div>

                    {/* Footer */}
                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={formik.isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={formik.isSubmitting} className="bg-accent text-accent-foreground hover:bg-accent-hover">
                            {formik.isSubmitting ? "Saving…" : "Confirm Payment"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}