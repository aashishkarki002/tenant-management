import { useState, useEffect } from "react";
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

export default function TransactionForm({
  open,
  onClose,
  onSubmit,
  vendor,
  transaction,
}) {
  const [formData, setFormData] = useState({
    transaction_type: "payment",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        transaction_type: transaction.transaction_type || "payment",
        amount: transaction.amount || "",
        description: transaction.description || "",
        date: transaction.date
          ? new Date(transaction.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      });
    } else {
      // Set default transaction type based on vendor type
      const defaultType =
        vendor?.vendor_type === "stall" ? "rent" : "expense";
      setFormData({
        transaction_type: defaultType,
        amount: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
      });
    }
  }, [transaction, vendor, open]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
    });
  };

  const isStallVendor = vendor?.vendor_type === "stall";

  const getTransactionTypes = () => {
    if (isStallVendor) {
      return [
        { value: "rent", label: "Rent Payment" },
        { value: "electricity", label: "Electricity" },
        { value: "payment", label: "Other Payment" },
      ];
    } else {
      return [
        { value: "expense", label: "Service Expense" },
        { value: "payment", label: "Payment Made" },
      ];
    }
  };

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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transaction_type">
                Transaction Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.transaction_type}
                onValueChange={(value) =>
                  handleChange("transaction_type", value)
                }
              >
                <SelectTrigger id="transaction_type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {getTransactionTypes().map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange("date", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="amount">
                Amount (रू) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
              <p
                className="text-xs"
                style={{ color: "var(--color-text-sub)" }}
              >
                {formData.transaction_type === "expense" ||
                formData.transaction_type === "payment"
                  ? "Amount paid out"
                  : "Amount received"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Enter transaction details..."
              rows={3}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {transaction ? "Update" : "Add"} Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
