import { useMemo, useCallback, useState } from "react";
import { useFormik } from "formik";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  TrendingDown,
  ScanLine,
} from "lucide-react";

import { toast } from "sonner";

import DragDropFileUpload from "@/components/DragDropFileUpload";

import { useNeaBill } from "../hooks/useNeaBill";
import { neaBillValidationSchema } from "../validation/neaBill.validation";

import {
  getRecentBillingPeriods,
  labelForPeriod,
  parsePeriodKey,
} from "@/utils/nepaliDate";

const fmtKwh = (n) =>
  `${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 1 })} kWh`;

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

// ─── Confirm dialog data builder ──────────────────────────────────────────────
// Builds a human-readable summary of what will be saved, shown before submit.

function buildConfirmRows(values, periodLabel) {
  return [
    { label: "Billing Period", value: periodLabel ?? values.periodKey },
    { label: "Total Amount",   value: values.totalAmount   ? `Rs ${values.totalAmount}`   : "—" },
    { label: "Total Units",    value: values.totalUnits    ? `${values.totalUnits} kWh`   : "—" },
    { label: "Energy Charge",  value: values.energyCharge  ? `Rs ${values.energyCharge}`  : "—" },
    { label: "Demand Charge",  value: values.demandCharge  ? `Rs ${values.demandCharge}`  : "—" },
    { label: "Bill Date",      value: values.billDate      || "—" },
    { label: "Notes",          value: values.notes?.trim() || "—" },
  ];
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export default function NeaBillUploadDialog({
  open,
  onOpenChange,
  propertyId,
  onUploaded,
}) {
  const periods = getRecentBillingPeriods(13);

  const defaultPeriod = useMemo(() => periods[0]?.value ?? "", [periods]);

  const [file, setFile]           = useState(null);
  const [recon, setRecon]         = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { uploading, upload, parsing, parseError, parseFill } = useNeaBill(propertyId);

  const formik = useFormik({
    enableReinitialize: true,

    initialValues: {
      periodKey:   defaultPeriod,
      totalAmount: "",
      totalUnits:  "",
      demandCharge: "",
      energyCharge: "",
      billDate:    "",
      notes:       "",
    },

    validationSchema: neaBillValidationSchema,

    onSubmit: async (values) => {
      try {
        const { nepaliMonth: month, nepaliYear: year } = parsePeriodKey(values.periodKey);

        const formData = new FormData();
        if (file) formData.append("neaBillPdf", file);

        formData.append("totalAmount",  values.totalAmount);
        formData.append("nepaliMonth",  String(month));
        formData.append("nepaliYear",   String(year));

        if (values.totalUnits)         formData.append("totalUnits",   values.totalUnits);
        if (values.demandCharge)       formData.append("demandCharge", values.demandCharge);
        if (values.energyCharge)       formData.append("energyCharge", values.energyCharge);
        if (values.billDate)           formData.append("billDate",     values.billDate);
        if (values.notes?.trim())      formData.append("notes",        values.notes.trim());

        const result = await upload(formData);
        setRecon(result.reconciliation);
        onUploaded?.();
        toast.success("NEA bill saved successfully");
      } catch (err) {
        toast.error(err.message || "Save failed");
      }
    },
  });

  // ── File change: auto-parse then pre-fill ─────────────────────────────────
  const handleFileChange = useCallback(async (selectedFile) => {
    setFile(selectedFile);
    if (!selectedFile) return;

    const fill = await parseFill(selectedFile);
    if (!fill) return;

    // Only set fields the user hasn't manually touched yet
    Object.entries(fill).forEach(([field, value]) => {
      if (!formik.values[field]) {
        formik.setFieldValue(field, value);
      }
    });
  }, [parseFill, formik]);

  // ── Save button: validate first, then open confirm dialog ─────────────────
  const handleSaveClick = useCallback(async () => {
    const errors = await formik.validateForm();
    formik.setTouched(
      Object.keys(formik.values).reduce((acc, k) => ({ ...acc, [k]: true }), {})
    );
    if (Object.keys(errors).length === 0) {
      setConfirmOpen(true);
    }
  }, [formik]);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    formik.submitForm();
  }, [formik]);

  const handleClose = useCallback(() => {
    formik.resetForm();
    setFile(null);
    setRecon(null);
    onOpenChange(false);
  }, [formik, onOpenChange]);

  // Period label for the confirm dialog
  const selectedPeriodLabel = useMemo(() => {
    return periods.find((p) => p.value === formik.values.periodKey)?.label;
  }, [periods, formik.values.periodKey]);

  const confirmRows = buildConfirmRows(formik.values, selectedPeriodLabel);

  return (
    <>
      {/* ── Main dialog ───────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-2xl p-0">
          {/* Header */}
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-xl font-semibold">
              Record NEA Bill
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Upload monthly NEA bill and reconcile purchased electricity
              against tenant meter readings.
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="max-h-[70dvh] overflow-y-auto px-6 py-5">
            {recon ? (
              <ReconciliationCard recon={recon} />
            ) : (
              <form onSubmit={formik.handleSubmit} className="space-y-6">
                {/* Billing Period */}
                <div className="space-y-2">
                  <LabelRequired>Billing Period (BS)</LabelRequired>
                  <Select
                    value={formik.values.periodKey || ""}
                    onValueChange={(value) => formik.setFieldValue("periodKey", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formik.touched.periodKey && formik.errors.periodKey && (
                    <p className="text-sm text-destructive">{formik.errors.periodKey}</p>
                  )}
                </div>

                {/* Bill Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Bill Date
                  </label>
                  <Input
                    type="date"
                    name="billDate"
                    value={formik.values.billDate}
                    onChange={formik.handleChange}
                  />
                </div>

                {/* Amount + Units */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CurrencyField
                    label="Total Amount"
                    required
                    name="totalAmount"
                    placeholder="24500"
                    formik={formik}
                  />
                  <NumberField
                    label="Total Units (kWh)"
                    name="totalUnits"
                    placeholder="3500"
                    formik={formik}
                  />
                </div>

                {/* Demand + Energy */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <CurrencyField
                    label="Demand Charge"
                    name="demandCharge"
                    placeholder="2000"
                    formik={formik}
                  />
                  <CurrencyField
                    label="Energy Charge"
                    name="energyCharge"
                    placeholder="22500"
                    formik={formik}
                  />
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    NEA Bill PDF
                  </label>
                  <DragDropFileUpload
                    value={file}
                    onChange={handleFileChange}
                    acceptedTypes={["application/pdf"]}
                    maxSizeMB={10}
                    label=""
                  />

                  {/* Parse status — shown only while parsing or on soft error */}
                  {parsing && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ScanLine className="h-3 w-3 animate-pulse" />
                      Reading bill…
                    </p>
                  )}
                  {parseError && !parsing && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Could not read PDF — please fill fields manually.
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Notes
                  </label>
                  <Textarea
                    rows={3}
                    name="notes"
                    placeholder="Includes common area, transformer loss, etc."
                    value={formik.values.notes}
                    onChange={formik.handleChange}
                  />
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
            >
              {recon ? "Close" : "Cancel"}
            </Button>

            {!recon && (
              <Button
                type="button"
                onClick={handleSaveClick}
                disabled={uploading || parsing}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Upload NEA Bill"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm alert dialog ───────────────────────────────────────────── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bill Details</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              Review the extracted data before saving. Incorrect values will
              affect reconciliation.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Summary table */}
          <div className="my-2 divide-y rounded-xl border text-sm">
            {confirmRows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">{value}</span>
              </div>
            ))}
          </div>

          {file && (
            <p className="text-xs text-muted-foreground">
              PDF attached: <span className="font-medium">{file.name}</span>
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Confirm & Save"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Reconciliation                               */
/* -------------------------------------------------------------------------- */

function ReconciliationCard({ recon }) {
  return (
    <div className="space-y-5 rounded-2xl border bg-muted/30 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Reconciliation Summary
        </p>
      </div>

      <div className="space-y-3">
        <SummaryRow label="NEA Charged" value={fmtRs(recon.neaBillTotal)} />
        {recon.demandCharge != null && (
          <SummaryRow
            label="Demand Charge"
            value={fmtRs(recon.demandCharge)}
            note="building operating expense"
          />
        )}
        <SummaryRow label="System NEA Cost" value={fmtRs(recon.systemNeaCost)} />
      </div>

      <div className="border-t pt-4">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm text-muted-foreground">Cost Difference</span>
          <div className="text-right">
            <div
              className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                recon.surplus ? "text-green-600" : recon.shortfall ? "text-red-600" : ""
              }`}
            >
              {recon.surplus  && <CheckCircle2 className="h-4 w-4" />}
              {recon.shortfall && <AlertTriangle className="h-4 w-4" />}
              {fmtRs(Math.abs(recon.costDifference ?? recon.difference ?? 0))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {recon.surplus
                ? "Collected more than billed"
                : recon.shortfall
                ? "NEA billed more than collected"
                : "Balanced"}
            </p>
          </div>
        </div>
      </div>

      {recon.purchasedUnits != null && (
        <>
          <div className="border-t pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Unit Reconciliation
            </p>
            <div className="space-y-3">
              <SummaryRow label="Purchased from NEA" value={fmtKwh(recon.purchasedUnits)} />
              <SummaryRow label="Metered Units"       value={fmtKwh(recon.meteredUnitUnits)} />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              {recon.unitLoss >= 0 ? "Loss" : "Surplus"}
            </span>
            <div className="text-right">
              <div
                className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                  recon.unitLoss > 0
                    ? "text-amber-600"
                    : recon.unitSurplus
                    ? "text-green-600"
                    : ""
                }`}
              >
                {recon.unitLoss > 0 && <TrendingDown className="h-4 w-4" />}
                {fmtKwh(Math.abs(recon.unitLoss ?? 0))}
                {recon.lossPercent != null && ` (${recon.lossPercent}%)`}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {recon.unitLoss > 0
                  ? "Possible leakage or common area usage"
                  : recon.unitSurplus
                  ? "Metered more than purchased"
                  : "Balanced"}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function LabelRequired({ children }) {
  return (
    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      {children}
      <span className="text-destructive"> *</span>
    </label>
  );
}

function CurrencyField({ label, name, placeholder, formik, required = false }) {
  return (
    <div className="space-y-2">
      {required ? (
        <LabelRequired>{label}</LabelRequired>
      ) : (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          Rs
        </span>
        <Input
          type="number"
          min="0"
          step="0.01"
          name={name}
          placeholder={placeholder}
          value={formik.values[name]}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          className="pl-9"
        />
      </div>
      {formik.touched[name] && formik.errors[name] && (
        <p className="text-sm text-destructive">{formik.errors[name]}</p>
      )}
    </div>
  );
}

function NumberField({ label, name, placeholder, formik }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>
      <Input
        type="number"
        min="0"
        step="0.1"
        name={name}
        placeholder={placeholder}
        value={formik.values[name]}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
      />
      {formik.touched[name] && formik.errors[name] && (
        <p className="text-sm text-destructive">{formik.errors[name]}</p>
      )}
    </div>
  );
}

function SummaryRow({ label, value, note }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums">{value}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}