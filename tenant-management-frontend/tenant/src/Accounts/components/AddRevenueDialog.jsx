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

function getOwnershipLabel(entity) {
  if (!entity || typeof entity !== "object") return null;
  if (entity.name) return entity.name;
  if (entity.type === "head_office") return "HQ";
  if (entity.type === "company") return "Company";
  if (entity.type === "private") return "Private";
  return null;
}

const getInitialValues = () => ({
  payerType: "tenant",
  tenantId: "",
  externalPayerName: "",
  externalPayerType: "PERSON",
  // FIX: separate field for the revenue source ObjectId
  sourceId: "",
  referenceId: "",
  amount: "",
  date: new Date().toISOString().split("T")[0],
  notes: "",
  paymentMethod: "bank_transfer",
  bankAccountId: "",
});

export function AddRevenueDialog({
  open,
  onOpenChange,
  tenants,
  // FIX: accept both `revenueSource` (array) and the common mistake of
  // passing `revenueSource.data` or `revenueSource.revenueSource` from
  // the parent. Normalise here so the dropdown always gets a flat array.
  revenueSource: revenueSourceProp,
  bankAccounts = [],
  onSuccess,
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = React.useState("");

  // ── Normalise the revenueSource prop into a guaranteed flat array ─────────
  // Parent might pass:  array | { data: [...] } | { revenueSource: [...] } | undefined
  const revenueSource = React.useMemo(() => {
    if (!revenueSourceProp) return [];
    if (Array.isArray(revenueSourceProp)) return revenueSourceProp;
    if (Array.isArray(revenueSourceProp?.data)) return revenueSourceProp.data;
    if (Array.isArray(revenueSourceProp?.revenueSource))
      return revenueSourceProp.revenueSource;
    return [];
  }, [revenueSourceProp]);

  const formik = useFormik({
    initialValues: getInitialValues(),
    onSubmit: async (values) => {
      setSubmitting(true);
      try {
        const payerType =
          values.payerType === "tenant" ? "TENANT" : "EXTERNAL";
        const paymentMethod = String(
          values.paymentMethod || "bank_transfer",
        ).toLowerCase();

        // FIX: `source` is the ObjectId from sourceId, NOT referenceType
        const payload = {
          source: values.sourceId,
          amount: Number(values.amount),
          date: values.date || new Date().toISOString().split("T")[0],
          payerType,
          referenceType: "MANUAL",
          referenceId: values.referenceId || undefined,
          notes: values.notes || undefined,
          paymentMethod,
          createdBy: undefined,
        };

        if (
          paymentMethod === "bank_transfer" ||
          paymentMethod === "cheque"
        ) {
          if (values.bankAccountId)
            payload.bankAccountId = values.bankAccountId;
        }

        if (payerType === "TENANT") {
          payload.tenant =
            typeof values.tenantId === "object"
              ? values.tenantId?._id
              : values.tenantId;
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
    setSelectedBankAccountId("");
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    formik.resetForm({ values: getInitialValues() });
    setSelectedBankAccountId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const payerType = formik.values.payerType ?? "tenant";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        MOBILE-FIRST:
        - On mobile (< sm): full screen sheet from bottom, rounded top corners only
        - On sm+: centred modal, max-w-lg, capped height with internal scroll
      */}
      <DialogContent
        className={[
          "flex flex-col gap-0 p-0 overflow-hidden",

          // mobile: bottom sheet
          "fixed bottom-0 left-0 right-0 top-auto",
          "rounded-t-2xl rounded-b-none",
          "max-h-[92dvh]",
          "translate-x-0 translate-y-0",

          // sm+: restore normal centred modal behaviour
          "sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:right-auto",
          "sm:-translate-x-1/2 sm:-translate-y-1/2",   // ← key fix
          "sm:rounded-2xl",
          "sm:max-w-lg sm:max-h-[90dvh]",
        ].join(" ")}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border space-y-0.5 sm:px-6 sm:pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Accounting · Revenue
          </p>
          <DialogTitle className="text-xl font-bold text-foreground leading-tight sm:text-2xl">
            Add Revenue
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
          <form
            id="add-revenue-form"
            onSubmit={formik.handleSubmit}
            className="space-y-5"
          >
            {/* ── Payer type toggle ─────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Payer type
              </Label>
              <div className="inline-flex w-full rounded-xl border border-input bg-muted/40 p-1 gap-1">
                {["tenant", "external"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => formik.setFieldValue("payerType", type)}
                    className={[
                      "flex-1 rounded-lg py-2.5 text-sm font-medium transition-all capitalize",
                      payerType === type
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tenant picker ────────────────────────────────────────── */}
            {payerType === "tenant" && (
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Select tenant
                </Label>
                <Select
                  value={
                    typeof formik.values.tenantId === "object"
                      ? (formik.values.tenantId?._id ?? "")
                      : (formik.values.tenantId ?? "")
                  }
                  onValueChange={(v) => formik.setFieldValue("tenantId", v)}
                >
                  <SelectTrigger className="w-full h-11 rounded-xl text-sm">
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

            {/* ── External payer fields ──────────────────────────────── */}
            {payerType === "external" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Payer name
                  </Label>
                  <Input
                    placeholder="Name of payer"
                    value={formik.values.externalPayerName ?? ""}
                    onChange={(e) =>
                      formik.setFieldValue("externalPayerName", e.target.value)
                    }
                    className="h-11 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Type
                  </Label>
                  <Select
                    value={formik.values.externalPayerType ?? "PERSON"}
                    onValueChange={(v) =>
                      formik.setFieldValue("externalPayerType", v)
                    }
                  >
                    <SelectTrigger className="w-full h-11 rounded-xl text-sm">
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

            {/* ── Section divider ───────────────────────────────────────── */}
            <div className="relative flex items-center py-1">
              <div className="flex-1 border-t border-border" />
              <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Transaction
              </span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* ── Revenue source ────────────────────────────────────────── */}
            {/*
              FIX: bound to `sourceId` (ObjectId string), NOT `referenceType`.
              The normalised `revenueSource` array is guaranteed non-undefined.
              If the array is empty we show a disabled placeholder so the user
              knows data hasn't loaded yet rather than a blank invisible select.
            */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Revenue source
              </Label>
              <Select
                value={formik.values.sourceId ?? ""}
                onValueChange={(v) => formik.setFieldValue("sourceId", v)}
                disabled={revenueSource.length === 0}
              >
                <SelectTrigger className="w-full h-11 rounded-xl text-sm">
                  <SelectValue
                    placeholder={
                      revenueSource.length === 0
                        ? "Loading sources…"
                        : "— select source —"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {revenueSource.map((source) => (
                    <SelectItem key={source._id} value={source._id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {revenueSource.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No revenue sources found. Make sure sources are configured in
                  the system.
                </p>
              )}
            </div>

            {/* ── Payment method ─────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Payment method
              </Label>
              <Select
                value={formik.values.paymentMethod || ""}
                onValueChange={(v) => {
                  formik.setFieldValue("paymentMethod", v);
                  if (v !== "bank_transfer" && v !== "cheque") {
                    setSelectedBankAccountId("");
                    formik.setFieldValue("bankAccountId", "");
                  }
                }}
              >
                <SelectTrigger className="w-full h-11 rounded-xl text-sm">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Bank account picker ────────────────────────────────── */}
            {(formik.values.paymentMethod === "bank_transfer" ||
              formik.values.paymentMethod === "cheque") && (
                <div className="space-y-3">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Deposit to
                  </Label>
                  <div className="flex flex-col gap-2.5">
                    {Array.isArray(bankAccounts) &&
                      bankAccounts.map((bank) => {
                        const selected = selectedBankAccountId === bank._id;
                        return (
                          <button
                            key={bank._id}
                            type="button"
                            onClick={() => {
                              setSelectedBankAccountId(bank._id);
                              formik.setFieldValue("bankAccountId", bank._id);
                            }}
                            className={[
                              "w-full text-left p-3.5 border-2 rounded-xl transition-colors",
                              selected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground bg-background",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getOwnershipLabel(bank.entityId) && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground flex-shrink-0">
                                      {getOwnershipLabel(bank.entityId)}
                                    </span>
                                  )}
                                  <p className="font-semibold text-foreground text-sm truncate">
                                    {bank.bankName}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  **** **** {bank.accountNumber?.slice(-4) || "****"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                <div className="text-right">
                                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                                    Balance
                                  </p>
                                  <p className="font-semibold text-foreground text-sm">
                                    ₹{bank.balance?.toLocaleString() || "0"}
                                  </p>
                                </div>
                                {selected && (
                                  <div className="text-primary flex-shrink-0">
                                    <svg
                                      className="w-5 h-5"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

            {/* ── Amount + Date (stacked on mobile, side-by-side on sm+) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Amount (₹)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={formik.values.amount ?? ""}
                  onChange={(e) =>
                    formik.setFieldValue("amount", e.target.value)
                  }
                  className="h-11 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Date
                </Label>
                <DualCalendarTailwind
                  value={formik.values.date ?? ""}
                  onChange={(englishDate) =>
                    formik.setFieldValue("date", englishDate)
                  }
                />
              </div>
            </div>

            {/* ── Notes ─────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Notes{" "}
                <span className="normal-case font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Any additional context..."
                value={formik.values.notes ?? ""}
                onChange={(e) =>
                  formik.setFieldValue("notes", e.target.value)
                }
                rows={3}
                className="rounded-xl resize-none text-sm"
              />
            </div>
          </form>
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────── */}
        {/*
          Placed OUTSIDE the scrollable area so it's always visible
          at the bottom of the sheet / modal regardless of scroll position.
        */}
        <div className="flex-shrink-0 flex gap-3 px-5 py-4 border-t border-border bg-background sm:px-6 sm:pb-5">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="flex-1 h-11 rounded-xl text-sm sm:flex-none sm:w-24"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-revenue-form"
            disabled={submitting}
            className="flex-1 h-11 rounded-xl text-sm bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-none sm:min-w-[130px]"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Add Revenue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}