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

function parseNepaliDate(nepaliStr) {
  if (!nepaliStr || typeof nepaliStr !== "string") return null;
  const parts = nepaliStr.trim().split("-").map(Number);
  if (parts.length < 3) return null;
  return { year: parts[0], month: parts[1], day: parts[2] };
}

const getInitialValues = () => ({
  payeeType: "tenant",
  tenantId: "",
  externalPayeeName: "",
  source: "",
  referenceType: "MANUAL",
  referenceId: "",
  amount: "",
  date: new Date().toISOString().split("T")[0],
  nepaliDateStr: "",
  notes: "",
});

export function AddExpenseDialog({
  open,
  onOpenChange,
  tenants,
  expenseSources,
  onSuccess,
}) {
  const [submitting, setSubmitting] = React.useState(false);

  const formik = useFormik({
    initialValues: getInitialValues(),
    onSubmit: async (values) => {
      setSubmitting(true);
      try {
        const payeeType = values.payeeType === "tenant" ? "TENANT" : "EXTERNAL";
        const nepali = parseNepaliDate(values.nepaliDateStr);
        const englishDate = values.date || new Date().toISOString().split("T")[0];

        const payload = {
          source: values.source,
          amount: Number(values.amount),
          EnglishDate: englishDate,
          referenceType: values.referenceType || "MANUAL",
          referenceId: values.referenceId || undefined,
          notes: values.notes || undefined,
          payeeType,
        };

        if (nepali) {
          payload.nepaliDate = values.nepaliDateStr;
          payload.nepaliMonth = nepali.month;
          payload.nepaliYear = nepali.year;
        } else {
          const today = new Date();
          payload.nepaliYear = 2081;
          payload.nepaliMonth = today.getMonth() + 1;
          payload.nepaliDate = `${payload.nepaliYear}-${String(payload.nepaliMonth).padStart(2, "0")}-15`;
        }

        if (payeeType === "TENANT") {
          payload.tenant = typeof values.tenantId === "object" ? values.tenantId?._id : values.tenantId;
        }

        const response = await api.post("/api/expense/create", payload);
        if (response.data?.expense != null) {
          onSuccess?.(response.data);
          handleClose();
        } else {
          console.error(response.data?.message || "Create failed");
        }
      } catch (err) {
        console.error("Error creating expense:", err);
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

  const payeeType = formik.values.payeeType ?? "tenant";

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
            Accounting · Expense
          </p>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Add Expense
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="space-y-6">
          {/* Payee type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payee type
            </Label>
            <div className="inline-flex rounded-md border border-input bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => formik.setFieldValue("payeeType", "tenant")}
                className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                  payeeType === "tenant"
                    ? "bg-background text-foreground border border-border shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tenant
              </button>
              <button
                type="button"
                onClick={() => formik.setFieldValue("payeeType", "external")}
                className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                  payeeType === "external"
                    ? "bg-background text-foreground border border-border shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                External
              </button>
            </div>
          </div>

          {/* Select tenant (when Tenant) */}
          {payeeType === "tenant" && (
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

          {payeeType === "external" && (
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Payee name (optional)
              </Label>
              <Input
                placeholder="Vendor or payee name"
                value={formik.values.externalPayeeName ?? ""}
                onChange={(e) =>
                  formik.setFieldValue("externalPayeeName", e.target.value)
                }
                className="rounded-md"
              />
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

          {/* Expense source + Reference ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Expense source
              </Label>
              <Select
                value={formik.values.source ?? ""}
                onValueChange={(value) => formik.setFieldValue("source", value)}
              >
                <SelectTrigger className="w-full rounded-md">
                  <SelectValue placeholder="— select source —" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(expenseSources) &&
                    expenseSources.map((src) => (
                      <SelectItem key={src._id} value={src._id}>
                        {src.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reference ID (optional)
              </Label>
              <Input
                placeholder="Reference ID"
                value={formik.values.referenceId ?? ""}
                onChange={(e) =>
                  formik.setFieldValue("referenceId", e.target.value)
                }
                className="rounded-md"
              />
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
                onChange={(englishDate, nepaliDateStr) => {
                  formik.setFieldValue("date", englishDate);
                  formik.setFieldValue("nepaliDateStr", nepaliDateStr ?? "");
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
              Add Expense
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
