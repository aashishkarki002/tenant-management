import { useState, useEffect } from "react";
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
import { AlertTriangle, Landmark, Wallet, Banknote, CreditCard } from "lucide-react";

import api from "../../../plugins/axios";
import { toast } from "sonner";
import BankAccountSelect from "@/components/BankAccountSelect.jsx";
import {
  PAYMENT_METHODS,
  paymentMethodRequiresBankAccount,
} from "@/constants/paymentMethods.js";

const PAYMENT_METHOD_CONFIG = {
  [PAYMENT_METHODS.CASH]: {
    label: "Cash",
    icon: Banknote,
  },
  [PAYMENT_METHODS.BANK_TRANSFER]: {
    label: "Bank Transfer",
    icon: Landmark,
  },
  [PAYMENT_METHODS.CHEQUE]: {
    label: "Cheque",
    icon: CreditCard,
  },
  [PAYMENT_METHODS.MOBILE_WALLET]: {
    label: "Mobile Wallet",
    icon: Wallet,
  },
};

export default function CompletionDialog({
  item,
  bankAccounts = [],
  open,
  onOpenChange,
  onComplete,
}) {
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS.CASH);
  const [selectedBank, setSelectedBank] = useState("");
  const [overpaymentMeta, setOverpaymentMeta] = useState(null);

  const [formData, setFormData] = useState({
    paymentStatus: "pending",
    paidAmount: "0",
  });

  useEffect(() => {
    if (item) {
      setFormData({
        paymentStatus: item.paymentStatus || "pending",
        paidAmount: item.paidAmount?.toString() || "0",
      });

      setSelectedMethod(PAYMENT_METHODS.CASH);
      setSelectedBank("");
      setOverpaymentMeta(null);
    }
  }, [item]);

  const estimatedAmount = item?.amount || 0;
  const paidAmount = Number(formData.paidAmount) || 0;
  const isOverpaying = paidAmount > estimatedAmount;

  const updateField = (field, value) => {
    if (field === "paidAmount") setOverpaymentMeta(null);

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const submitCompletion = async (allowOverpayment = false) => {
    if (!item) return;

    const payload = {
      status: "COMPLETED",
      paymentStatus: formData.paymentStatus,
      paidAmount: Number(formData.paidAmount),
      paymentMethod: selectedMethod,
      ...(allowOverpayment && { allowOverpayment: true }),
    };

    if (paymentMethodRequiresBankAccount(selectedMethod) && selectedBank) {
      payload.bankAccountId = selectedBank;
    }

    try {
      await api.patch(`/api/maintenance/${item._id}/status`, payload);

      toast.success(
        allowOverpayment
          ? "Work order completed (overpayment recorded)"
          : "Work order completed"
      );

      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      const data = err?.response?.data;

      if (err?.response?.status === 409 && data?.isOverpayment) {
        setOverpaymentMeta({
          message: data.message,
          diffRupees: data.overpaymentDiffRupees,
        });
        return;
      }

      toast.error(data?.message || "Failed to complete work order");
    }
  };

  const showBankSelection = paymentMethodRequiresBankAccount(selectedMethod);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 bg-white max-h-[90vh] flex flex-col">


        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-semibold">
            Complete Work Order
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Confirm payment details before completing this task.
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Estimated Amount */}
          <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Estimated Cost
            </span>
            <span className="text-lg font-semibold">
              RS {estimatedAmount}
            </span>
          </div>

          {/* Payment Status */}
          <div className="space-y-2">
            <Label>Payment Status</Label>

            <div className="grid grid-cols-3 gap-2">
              {["pending", "partially_paid", "paid"].map((status) => (
                <button
                  key={status}
                  onClick={() => updateField("paymentStatus", status)}
                  className={`rounded-md border p-2 text-sm transition
                  ${formData.paymentStatus === status
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 hover:border-slate-300"
                    }`}
                >
                  {status.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Paid Amount */}
          <div className="space-y-2">
            <Label>Paid Amount</Label>
            <Input
              type="number"
              value={formData.paidAmount}
              disabled={formData.paymentStatus === "pending"}
              onChange={(e) =>
                updateField("paidAmount", e.target.value)
              }
            />

            {isOverpaying && !overpaymentMeta && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Paid amount exceeds estimated cost.
              </p>
            )}
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <Label>Payment Method</Label>

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(PAYMENT_METHOD_CONFIG).map(
                ([value, config]) => {
                  const Icon = config.icon;

                  return (
                    <button
                      key={value}
                      onClick={() => {
                        setSelectedMethod(value);
                        if (!paymentMethodRequiresBankAccount(value)) {
                          setSelectedBank("");
                        }
                      }}
                      className={`border rounded-lg p-3 flex flex-col items-center justify-center gap-1 text-sm transition
                      ${selectedMethod === value
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 hover:border-slate-300"
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Bank Accounts */}
          {showBankSelection && (
            <div className="space-y-2">
              <Label>Deposit To</Label>
              <BankAccountSelect
                bankAccounts={bankAccounts}
                value={selectedBank || ""}
                onValueChange={setSelectedBank}
                triggerClassName="w-full"
              />
            </div>
          )}

          {/* Overpayment Warning */}
          {overpaymentMeta && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-1" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Overpayment detected
                  </p>
                  <p className="text-xs text-amber-700">
                    {overpaymentMeta.message}
                  </p>
                  <p className="text-xs text-amber-700">
                    Excess: RS {overpaymentMeta.diffRupees}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOverpaymentMeta(null)}
                >
                  Edit
                </Button>

                <Button
                  size="sm"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => submitCompletion(true)}
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!overpaymentMeta && (
          <DialogFooter className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button
              className="w-full sm:w-auto"
              onClick={() => submitCompletion(false)}
            >
              Complete Work Order
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}