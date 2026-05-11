import React, { useState } from "react";
import {
  Zap,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";
import { NeaBillCard } from "./NeaBillCard";
import { fmtKLatin , fmtRs } from "../../utils/formatter";
import PayDialog from "./NeaBillDialog";

import { useBankAccounts } from "../../Accounts/hooks/useAccounting";

const fmtKwh = (n) =>
  `${Number(n ?? 0).toLocaleString("en-NP", {
    maximumFractionDigits: 1,
  })} kWh`;





function PendingPaymentsList({ bills }) {
  const pending = bills
    .filter((b) => b.status !== "paid")
    .slice(0, 3);

  if (!pending.length) return null;

  return (
    <div className="border-t px-4 py-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Pending Payments
      </p>

      <div className="space-y-2">
        {pending.map((b) => {
          const month =
            NEPALI_MONTH_NAMES[(b.nepaliMonth ?? 1) - 1] ?? "";

          const total =
            b.reconciliation?.neaBillTotal ??
            b.totalAmount ??
            0;

          return (
            <div
              key={b._id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">
                {month} {b.nepaliYear}
              </span>

              <span className="font-semibold text-amber-600">
                {fmtKLatin(total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

export function NeaBillPanel({
  bill,
  bills = [],
  onPay,
  paying = false,
  onUpload,
  currentPeriod = null,
}) {
  const [showPay, setShowPay] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { bankAccounts = [] } = useBankAccounts();

  const periodMonth = bill
    ? NEPALI_MONTH_NAMES[(bill.nepaliMonth ?? 1) - 1] ?? ""
    : currentPeriod
    ? NEPALI_MONTH_NAMES[(currentPeriod.month ?? 1) - 1] ?? ""
    : "";

  const periodYear =
    bill?.nepaliYear ?? currentPeriod?.year ?? "";

  const periodLabel = periodMonth
    ? `${periodMonth} ${periodYear}`
    : "—";

  const recon = bill?.reconciliation ?? {};

  const totalPaisa =
    recon.neaBillTotal ?? bill?.totalAmount ?? 0;

  const energyCharge =
    bill?.energyChargeAmountPaisa ?? null;

  const demandCharge =
    bill?.demandCharge ??
    recon.demandCharge ??
    null;

  const diff = recon.costDifference ?? 0;

  const isShort = Boolean(recon.shortfall);
  const isSurplus = Boolean(recon.surplus);

  const isPaid = bill?.status === "paid";

  const hasRecon = recon.systemNeaCost != null;

  const handlePay = async (billId, paymentData) => {
    await onPay(billId, paymentData);
    setShowPay(false);
  };

  return (
    <>
      <Card className="overflow-hidden shadow-sm">
        {/* Header */}
        <CardHeader className="bg-primary px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
              <Zap className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                NEA Bill · Reference
              </p>

              <p className="truncate text-sm font-semibold">
                Nepal Electricity Authority
              </p>
            </div>

            <span className="text-xs font-medium text-white/70">
              {periodLabel}
            </span>
          </div>
        </CardHeader>

        {/* Empty state */}
        {!bill && (
          <CardContent className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-sm font-semibold">
              No bill uploaded
            </p>

            <p className="max-w-[220px] text-xs text-muted-foreground">
              Upload NEA bill for {periodLabel} to track
              building costs
            </p>

            {onUpload && (
              <Button
                variant="outline"
                onClick={onUpload}
                className="mt-1"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Upload NEA Bill
              </Button>
            )}
          </CardContent>
        )}

        {/* Bill */}
        {bill && (
          <CardContent className="space-y-4 p-4">
            {/* Charges */}
            <div className="overflow-hidden rounded-lg border">
              {/* Energy */}
              <div className="flex items-center justify-between border-b px-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    Energy Charge
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {bill.totalUnits != null
                      ? fmtKwh(bill.totalUnits)
                      : "Variable"}
                  </p>
                </div>

            <span className="text-sm font-semibold">
  {energyCharge != null
    ? fmtRs(energyCharge)
    : "—"}
</span>
              </div>

              {/* Demand */}
              <div className="flex items-center justify-between border-b px-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    Demand Charge
                  </p>

                  <p className="text-xs text-muted-foreground">
                    Fixed monthly
                  </p>
                </div>

                <span className="text-sm font-semibold">
                  {demandCharge != null
                    ? fmtKLatin(demandCharge)
                    : "—"}
                </span>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between bg-muted px-3 py-3">
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  Total Payable
                </span>

                <span className="text-xl font-extrabold text-blue-600">
                  {fmtKLatin(totalPaisa)}
                </span>
              </div>
            </div>

            {/* Alert */}
            {hasRecon && (isShort || isSurplus) && (
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                  isShort
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-green-200 bg-green-50 text-green-700"
                }`}
              >
                {isShort ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}

                <span>
                  {fmtKLatin(Math.abs(diff))}{" "}
                  {isShort ? "shortfall" : "surplus"}
                </span>
              </div>
            )}

            {/* Payment state */}
            {isPaid ? (
              <div className="flex items-center justify-center gap-2 rounded-md border border-green-200 bg-green-50 py-2 text-sm font-medium text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Bill Paid
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowPay(true)}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Record NEA Payment
              </Button>
            )}
          </CardContent>
        )}

        {/* History */}
        {bills.length > 0 && (
          <div className="border-t">
            <button
              type="button"
              onClick={() =>
                setHistoryOpen((prev) => !prev)
              }
              className="flex w-full items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground transition hover:bg-muted/40"
            >
              <FileText className="h-4 w-4" />

              <span className="flex-1 text-left">
                Bill History
              </span>

              <Badge variant="secondary">
                {bills.length}
              </Badge>

              {historyOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {historyOpen && (
              <div className="max-h-[260px] overflow-y-auto border-t">
                {bills.map((b) => (
                  <NeaBillCard
                    key={b._id}
                    bill={b}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!historyOpen && (
          <PendingPaymentsList bills={bills} />
        )}
      </Card>

{showPay && bill && (
  <PayDialog
    open={showPay}
    bill={bill}
    onPay={handlePay}
    paying={paying}
    onClose={() => setShowPay(false)}
    bankAccounts={bankAccounts}
  />
)}
    </>
  );
}