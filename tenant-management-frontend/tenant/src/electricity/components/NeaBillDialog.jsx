import React, { useMemo, useState } from "react";
import {
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import {
  getLedgerPaymentMethodSelectOptions,
  normalizeLedgerPaymentMethod,
  paymentMethodRequiresBankAccount,
  PAYMENT_METHODS,
  getPaymentMethodLabel,
} from "@/constants/paymentMethods";

import DualCalendarTailwind from "@/components/dualDate";

import BankAccountSelect from "@/components/BankAccountSelect";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fmtRs = (n) =>
  `Rs ${Number(n ?? 0).toLocaleString("en-NP", {
    maximumFractionDigits: 0,
  })}`;

function PayDialog({
  open,
  bill,
  onPay,
  paying,
  onClose,
  bankAccounts = [],
}) {
  const [method, setMethod] = useState(
    PAYMENT_METHODS.CASH
  );

  const [bankAccountId, setBankAccountId] = useState("");
  
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );

  const recon = bill.reconciliation ?? {};

  const totalPaisa =
    recon.neaBillTotal ??
    bill.totalAmount ??
    0;

  const requiresBank = useMemo(
    () =>
      paymentMethodRequiresBankAccount(method),
    [method]
  );

  const handleMethodChange = (value) => {
    const normalized =
      normalizeLedgerPaymentMethod(value);

    setMethod(normalized);

    // Clear bank when switching to non-bank methods
    if (
      !paymentMethodRequiresBankAccount(
        normalized
      )
    ) {
      setBankAccountId("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (requiresBank && !bankAccountId) {
      return;
    }

    await onPay(bill._id, {
      paymentMethod: method,
      paymentDate: date,
      bankAccountId:
        requiresBank
          ? bankAccountId
          : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Pay NEA Bill
          </DialogTitle>

          <DialogDescription>
            Records{" "}
            <span className="font-semibold text-foreground">
              {fmtRs(totalPaisa)}
            </span>{" "}
            as paid — DR NEA Payable / CR{" "}
            {getPaymentMethodLabel(method)}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment Method
            </label>

            <Select
              value={method}
              onValueChange={handleMethodChange}
          
            >
              <SelectTrigger     className="w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>

              <SelectContent>
                {getLedgerPaymentMethodSelectOptions().map(
                  (option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Bank Account */}
          {requiresBank && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bank Account
              </label>

              <BankAccountSelect
                bankAccounts={bankAccounts}
                value={bankAccountId}
                onValueChange={
                  setBankAccountId
                }
                placeholder="Select bank account"
                showBalance
              />
            </div>
          )}

          {/* Payment Date */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment Date
            </label>

      ,       <DualCalendarTailwind
              onChange={(ad) => setDate(ad)}
              value={date}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              className="flex-1"
              disabled={
                paying ||
                (requiresBank &&
                  !bankAccountId)
              }
            >
              {paying && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {paying
                ? "Recording..."
                : "Confirm Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default PayDialog;