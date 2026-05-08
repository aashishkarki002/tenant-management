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
  `${Number(n).toLocaleString("en-NP", {
    maximumFractionDigits: 1,
  })} kWh`;

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-NP", {
    maximumFractionDigits: 0,
  })}`;




export default function NeaBillUploadDialog({
  open,
  onOpenChange,
  propertyId,
  onUploaded,
}) {
  const periods = getRecentBillingPeriods(13);

  const defaultPeriod = useMemo(() => {
    return periods[0]?.value ?? "";
  }, [periods]);

  const [file, setFile] = useState(null);
  const [recon, setRecon] = useState(null);

  const { uploading, upload } = useNeaBill(propertyId);

  const formik = useFormik({
    enableReinitialize: true,

    initialValues: {
      periodKey: defaultPeriod,
      totalAmount: "",
      totalUnits: "",
      demandCharge: "",
      energyCharge: "",
      billDate: "",
      notes: "",
    },

    validationSchema: neaBillValidationSchema,

    onSubmit: async (values) => {
      try {
        const { nepaliMonth: month, nepaliYear: year } = parsePeriodKey(values.periodKey);

        const formData = new FormData();

        if (file) {
          formData.append("neaBillPdf", file);
        }

        formData.append("totalAmount", values.totalAmount);
        formData.append("nepaliMonth", String(month));
        formData.append("nepaliYear", String(year));

        if (values.totalUnits) {
          formData.append("totalUnits", values.totalUnits);
        }

        if (values.demandCharge) {
          formData.append("demandCharge", values.demandCharge);
        }

        if (values.energyCharge) {
          formData.append("energyCharge", values.energyCharge);
        }

        if (values.billDate) {
          formData.append("billDate", values.billDate);
        }

        if (values.notes?.trim()) {
          formData.append("notes", values.notes.trim());
        }

        const result = await upload(formData);

        setRecon(result.reconciliation);
        onUploaded?.();

        toast.success("NEA bill saved successfully");
      } catch (err) {
        toast.error(err.message || "Save failed");
      }
    },
  });

  const handleClose = useCallback(() => {
    formik.resetForm();
    setFile(null);
    setRecon(null);

    onOpenChange(false);
  }, [formik, onOpenChange]);

  return (
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
            <form
                onSubmit={formik.handleSubmit}
                className="space-y-6"
              >
                {/* Billing Period */}
                <div className="space-y-2">
                  <LabelRequired>Billing Period (BS)</LabelRequired>

                <Select
  value={formik.values.periodKey || ""}
  onValueChange={(value) =>
    formik.setFieldValue("periodKey", value)
  }
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

                  {formik.touched.periodKey &&
                    formik.errors.periodKey && (
                      <p className="text-sm text-destructive">
                        {formik.errors.periodKey}
                      </p>
                    )}
                </div>

                {/* Bill Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Bill Date</label>

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
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">NEA Bill PDF</label>

                  <DragDropFileUpload
                    value={file}
                    onChange={setFile}
                    acceptedTypes={["application/pdf"]}
                    maxSizeMB={10}
                    label=""
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Notes</label>

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
              onClick={formik.submitForm}
              disabled={uploading}
            >
              {uploading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {uploading ? "Saving..." : "Save NEA Bill"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <SummaryRow
          label="NEA Charged"
          value={fmtRs(recon.neaBillTotal)}
        />

        {recon.demandCharge != null && (
          <SummaryRow
            label="Demand Charge"
            value={fmtRs(recon.demandCharge)}
            note="building operating expense"
          />
        )}

        <SummaryRow
          label="System NEA Cost"
          value={fmtRs(recon.systemNeaCost)}
        />
      </div>

      <div className="border-t pt-4">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            Cost Difference
          </span>

          <div className="text-right">
            <div
              className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                recon.surplus
                  ? "text-green-600"
                  : recon.shortfall
                  ? "text-red-600"
                  : ""
              }`}
            >
              {recon.surplus && (
                <CheckCircle2 className="h-4 w-4" />
              )}

              {recon.shortfall && (
                <AlertTriangle className="h-4 w-4" />
              )}

              {fmtRs(
                Math.abs(
                  recon.costDifference ??
                    recon.difference ??
                    0
                )
              )}
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
              <SummaryRow
                label="Purchased from NEA"
                value={fmtKwh(recon.purchasedUnits)}
              />

              <SummaryRow
                label="Metered Units"
                value={fmtKwh(recon.meteredUnitUnits)}
              />
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
                {recon.unitLoss > 0 && (
                  <TrendingDown className="h-4 w-4" />
                )}

                {fmtKwh(Math.abs(recon.unitLoss ?? 0))}

                {recon.lossPercent != null &&
                  ` (${recon.lossPercent}%)`}
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

function CurrencyField({
  label,
  name,
  placeholder,
  formik,
  required = false,
}) {
  return (
    <div className="space-y-2">
      {required ? (
        <LabelRequired>{label}</LabelRequired>
      ) : (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>
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
        <p className="text-sm text-destructive">
          {formik.errors[name]}
        </p>
      )}
    </div>
  );
}

function NumberField({
  label,
  name,
  placeholder,
  formik,
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>

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
        <p className="text-sm text-destructive">
          {formik.errors[name]}
        </p>
      )}
    </div>
  );
}

function SummaryRow({ label, value, note }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">
        {label}
      </span>

      <div className="text-right">
        <p className="text-sm font-medium tabular-nums">
          {value}
        </p>

        {note && (
          <p className="text-xs text-muted-foreground">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}