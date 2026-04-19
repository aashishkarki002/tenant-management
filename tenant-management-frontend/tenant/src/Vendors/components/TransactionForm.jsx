import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const validationSchema = Yup.object({
  transaction_type: Yup.string().required("Transaction type is required"),
  date: Yup.string().required("Date is required"),
  amount: Yup.number()
    .typeError("Amount must be a number")
    .positive("Amount must be greater than 0")
    .required("Amount is required"),
  description: Yup.string().required("Description is required"),
});

const getDefaultType = (vendor) =>
  vendor?.vendor_type === "stall" ? "rent" : "expense";

const buildInitialValues = (transaction, vendor) => ({
  transaction_type: transaction?.transaction_type ?? getDefaultType(vendor),
  amount: transaction?.amount ?? "",
  description: transaction?.description ?? "",
  date: transaction?.date
    ? new Date(transaction.date).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0],
});

const getTransactionTypes = (vendor) => {
  if (vendor?.vendor_type === "stall") {
    return [
      { value: "rent", label: "Rent Payment" },
      { value: "electricity", label: "Electricity" },
      { value: "payment", label: "Other Payment" },
    ];
  }
  return [
    { value: "expense", label: "Service Expense" },
    { value: "payment", label: "Payment Made" },
  ];
};

export default function TransactionForm({
  open,
  onClose,
  onSubmit,
  vendor,
  transaction,
}) {
  const formik = useFormik({
    initialValues: buildInitialValues(transaction, vendor),
    validationSchema,
    onSubmit: (values) => {
      onSubmit({ ...values, amount: parseFloat(values.amount) });
    },
  });

  useEffect(() => {
    if (open) {
      formik.resetForm({
        values: buildInitialValues(transaction, vendor),
      });
    }
  }, [transaction, vendor, open]);

  const fieldError = (field) =>
    formik.touched[field] && formik.errors[field] ? (
      <p className="text-xs text-destructive">{formik.errors[field]}</p>
    ) : null;

  const isOutflow =
    formik.values.transaction_type === "expense" ||
    formik.values.transaction_type === "payment";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Edit Transaction" : "Add Transaction"}
          </DialogTitle>
          <DialogDescription>
            {transaction
              ? "Update transaction details below"
              : `Record a new transaction for ${vendor?.name}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transaction_type">
                Transaction Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formik.values.transaction_type}
                onValueChange={(value) =>
                  formik.setFieldValue("transaction_type", value)
                }
              >
                <SelectTrigger id="transaction_type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {getTransactionTypes(vendor).map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("transaction_type")}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                {...formik.getFieldProps("date")}
              />
              {fieldError("date")}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="amount">
                Amount (रू) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                {...formik.getFieldProps("amount")}
                placeholder="0"
                min="0"
                step="0.01"
              />
              <p className="text-xs" style={{ color: "var(--color-text-sub)" }}>
                {isOutflow ? "Amount paid out" : "Amount received"}
              </p>
              {fieldError("amount")}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              {...formik.getFieldProps("description")}
              placeholder="Enter transaction details..."
              rows={3}
            />
            {fieldError("description")}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={formik.isSubmitting}>
              {transaction ? "Update" : "Add"} Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
