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
import { useFormik } from "formik";
import { toast } from "sonner";
import DragDropFileUpload from "@/components/DragDropFileUpload";
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
    const formik = useFormik({
        initialValues: {
            paymentAmount: "",
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
            return errors;
        },
        onSubmit: async (values, { setSubmitting, resetForm }) => {
            try {
                await recordPayment(
                    {
                        electricityId: record._id,
                        amount: parseFloat(values.paymentAmount),
                        nepaliDate: record.nepaliDate,
                        paymentDate: new Date().toISOString(),
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

    const handleOpenChange = (open) => {
        if (!formik.isSubmitting) {
            if (!open) formik.resetForm();
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
                    <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{unitName}</span>
                        {record?.nepaliDate && (
                            <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                                {record.nepaliDate}
                            </span>
                        )}
                    </p>
                </DialogHeader>

                {/* Payment Summary */}
                <div className="mt-4 rounded-xl bg-muted/40 p-4 border space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Amount</span>
                        <span className="font-medium">{totalAmountFormatted}</span>
                    </div>
                    {paidAmount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                            <span>Paid</span>
                            <span>{paidAmountFormatted}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-base font-semibold text-orange-600 pt-2 border-t">
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
                            <p className="text-xs text-red-500 mt-1">
                                {formik.errors.paymentAmount}
                            </p>
                        )}
                    </div>

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
                        <Button type="submit" disabled={formik.isSubmitting}>
                            {formik.isSubmitting ? "Saving…" : "Confirm Payment"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}