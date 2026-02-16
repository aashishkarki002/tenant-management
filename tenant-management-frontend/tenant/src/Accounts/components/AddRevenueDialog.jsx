import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
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
import { useFormik } from "formik";
import api from "../../../plugins/axios";
import { Loader2 } from "lucide-react";
import DualCalendarTailwind from "@/components/dualDate";

const getInitialValues = () => ({
  payerType: "tenant",
  tenantId: "",
  externalPayerName: "",
  externalPayerType: "PERSON",
  referenceType: "",
  referenceId: "",
  amount: "",
  date: new Date().toISOString().split("T")[0],
  notes: "",
  bankAccount: "",
  paymentSchedule: "one_time",
});


export function AddRevenueDialog({
  open,
  onOpenChange,
  tenants,
  revenueSource,
  bankAccounts,
  onSuccess,
}) {
  const [submitting, setSubmitting] = React.useState(false);

  const formik = useFormik({
    initialValues: getInitialValues(),
    onSubmit: async (values) => {
      setSubmitting(true);
      try {
        const payerType = values.payerType === "tenant" ? "TENANT" : "EXTERNAL";
        const payload = {
          source: values.referenceType,
          amount: Number(values.amount),
          date: values.date || new Date().toISOString().split("T")[0],
          payerType,
          referenceType: "MANUAL",
          referenceId: values.referenceId || undefined,
          notes: values.notes || undefined,
          bankAccountId: values.bankAccount,
          paymentMethod: "bank_transfer",
          createdBy: undefined,
        };

        if (payerType === "TENANT") {
          payload.tenant = typeof values.tenantId === "object" ? values.tenantId?._id : values.tenantId;
        } else {
          payload.externalPayer = {
            name: values.externalPayerName,
            type: values.externalPayerType,
          };
        }

        const response = await api.post("/api/revenue/create", payload);
        if (response.data?.success) {
          onSuccess?.(response.data);
          handleClose();
        } else {
          console.error(response.data?.message || "Create failed");
        }
      } catch (err) {
        console.error("Error creating revenue:", err);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleClose = () => {
    formik.resetForm({ values: getInitialValues() });
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    formik.resetForm({ values: getInitialValues() });
  }, [open]);

  const payerType = formik.values.payerType ?? "tenant";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          if (e.target?.closest?.("[data-dual-calendar-panel]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Accounting · Revenue
          </p>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Add Revenue
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="space-y-6">
          {/* Payer type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payer type
            </Label>
            <div className="inline-flex rounded-md border border-input bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => formik.setFieldValue("payerType", "tenant")}
                className={`rounded px-4 py-2 text-sm font-medium transition-colors ${payerType === "tenant"
                  ? "bg-background text-foreground border border-border shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Tenant
              </button>
              <button
                type="button"
                onClick={() => formik.setFieldValue("payerType", "external")}
                className={`rounded px-4 py-2 text-sm font-medium transition-colors ${payerType === "external"
                  ? "bg-background text-foreground border border-border shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                External
              </button>
            </div>
          </div>

          {/* Select tenant (when Tenant) */}
          {payerType === "tenant" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Select tenant
              </Label>
              <Select
                value={typeof formik.values.tenantId === "object" ? formik.values.tenantId?._id ?? "" : (formik.values.tenantId ?? "")}
                onValueChange={(value) => formik.setFieldValue("tenantId", value)}
              >
                <SelectTrigger className="w-full rounded-md">
                  <SelectValue placeholder="— choose tenant —" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(tenants) &&
                    tenants.map((tenant) => (
                      <SelectItem key={tenant._id} value={tenant._id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {payerType === "external" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  External payer name
                </Label>
                <Input
                  placeholder="Name of payer"
                  value={formik.values.externalPayerName ?? ""}
                  onChange={(e) =>
                    formik.setFieldValue("externalPayerName", e.target.value)
                  }
                  className="rounded-md"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Type
                </Label>
                <Select
                  value={formik.values.externalPayerType ?? "PERSON"}
                  onValueChange={(value) =>
                    formik.setFieldValue("externalPayerType", value)
                  }
                >
                  <SelectTrigger className="w-full rounded-md">
                    <SelectValue placeholder="Person or Company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERSON">Person</SelectItem>
                    <SelectItem value="COMPANY">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Transaction separator */}
          <div className="relative flex items-center py-2">
            <div className="flex-1 border-t border-border" />
            <span className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Transaction
            </span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* Revenue source + Bank account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Revenue source
              </Label>
              <Select
                value={formik.values.referenceType ?? ""}
                onValueChange={(value) =>
                  formik.setFieldValue("referenceType", value)
                }
              >
                <SelectTrigger className="w-full rounded-md">
                  <SelectValue placeholder="— select source —" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(revenueSource) &&
                    revenueSource.map((source) => (
                      <SelectItem key={source._id} value={source._id}>
                        {source.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bank account
              </Label>
              <Select
                value={formik.values.bankAccount ?? ""}
                onValueChange={(value) =>
                  formik.setFieldValue("bankAccount", value)
                }
              >
                <SelectTrigger className="w-full rounded-md">
                  <SelectValue placeholder="— select account —" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(bankAccounts) &&
                    bankAccounts.map((bank) => (
                      <SelectItem key={bank._id} value={bank._id}>
                        {bank.bankName} — ****
                        {bank.accountNumber?.slice(-4) || "****"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Amount (₹)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formik.values.amount ?? ""}
                onChange={(e) => formik.setFieldValue("amount", e.target.value)}
                className="rounded-md"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Date
              </Label>
              <DualCalendarTailwind
                value={formik.values.date ?? ""}
                onChange={(englishDate) => {
                  formik.setFieldValue("date", englishDate);
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes (optional)
            </Label>
            <Textarea
              placeholder="Any additional context..."
              value={formik.values.notes ?? ""}
              onChange={(e) => formik.setFieldValue("notes", e.target.value)}
              rows={3}
              className="rounded-md resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:ring-neutral-900"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              Add Revenue
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
