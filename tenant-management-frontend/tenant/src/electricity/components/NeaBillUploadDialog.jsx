import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DragDropFileUpload from "@/components/DragDropFileUpload";
import { useNeaBill } from "../hooks/useNeaBill";
import { getRecentBillingPeriods, labelForPeriod, parsePeriodKey } from "@/utils/nepaliDate";

const fmtRs = (n) =>
  `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;

/**
 * NeaBillUploadDialog
 *
 * Lets the admin upload the monthly NEA utility bill PDF.
 * After upload shows a reconciliation summary comparing the NEA charge
 * against the sum of neaCostPaisa across all readings for that month.
 */
export default function NeaBillUploadDialog({ open, onOpenChange, propertyId }) {
  const periods       = getRecentBillingPeriods(13);
  const defaultPeriod = periods[0] ? `${periods[0].year}-${periods[0].month}` : "";

  const [periodKey,   setPeriodKey]   = useState(defaultPeriod);
  const [totalAmount, setTotalAmount] = useState("");
  const [notes,       setNotes]       = useState("");
  const [file,        setFile]        = useState(null);
  const [recon,       setRecon]       = useState(null);

  const { uploading, upload } = useNeaBill(propertyId);

  const handleSubmit = async () => {
    if (!file)
      return toast.error("Please select the NEA bill PDF");
    if (!totalAmount || isNaN(parseFloat(totalAmount)) || parseFloat(totalAmount) <= 0)
      return toast.error("Enter a valid total amount (Rs)");
    if (!periodKey)
      return toast.error("Select a billing period");

    const { month, year } = parsePeriodKey(periodKey);

    const formData = new FormData();
    formData.append("neaBillPdf",  file);
    formData.append("totalAmount", totalAmount);
    formData.append("nepaliMonth", String(month));
    formData.append("nepaliYear",  String(year));
    if (notes.trim()) formData.append("notes", notes.trim());

    try {
      const result = await upload(formData);
      setRecon(result.reconciliation);
      toast.success("NEA bill uploaded successfully");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    }
  };

  const handleClose = useCallback(() => {
    setPeriodKey(defaultPeriod);
    setTotalAmount("");
    setNotes("");
    setFile(null);
    setRecon(null);
    onOpenChange(false);
  }, [defaultPeriod, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="flex flex-col sm:max-w-lg rounded-2xl p-0 gap-0 overflow-hidden"
        style={{ maxHeight: "90dvh" }}
      >
        {/* ── Fixed header ─────────────────────────────────────────────── */}
        <DialogHeader
          className="px-6 pt-6 pb-4 shrink-0 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <DialogTitle
            className="text-lg font-bold"
            style={{ color: "var(--color-text-strong)" }}
          >
            Upload NEA Bill
          </DialogTitle>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-sub)" }}>
            Upload the monthly NEA utility bill PDF for this property. The bill is stored
            on FTP and compared against readings to show your margin.
          </p>
        </DialogHeader>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Reconciliation result — shown after successful upload */}
          {recon && (
            <div
              className="rounded-xl p-4 space-y-2.5"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-wider mb-3"
                style={{ color: "var(--color-text-weak)" }}
              >
                Reconciliation
              </p>
              <SummaryRow label="NEA Charged (bill)"  value={fmtRs(recon.neaBillTotal)}  />
              <SummaryRow
                label="System NEA Cost"
                value={fmtRs(recon.systemNeaCost)}
                note="sum of readings"
              />
              <div
                className="pt-2.5 border-t"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="text-sm" style={{ color: "var(--color-text-sub)" }}>
                    Difference
                  </span>
                  <div className="text-right">
                    <span
                      className="flex items-center gap-1.5 text-sm font-semibold tabular-nums"
                      style={{
                        color: recon.surplus
                          ? "var(--color-success)"
                          : recon.shortfall
                            ? "var(--color-danger)"
                            : "var(--color-text-body)",
                      }}
                    >
                      {recon.surplus && (
                        <CheckCircle2 style={{ width: 13, height: 13, flexShrink: 0 }} />
                      )}
                      {recon.shortfall && (
                        <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
                      )}
                      {fmtRs(Math.abs(recon.difference))}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--color-text-sub)" }}>
                      {recon.surplus
                        ? "Surplus — collected more than billed"
                        : recon.shortfall
                          ? "Shortfall — NEA billed more than collected"
                          : "Balanced"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload form — hidden after successful upload */}
          {!recon && (
            <div className="space-y-5">

              {/* Billing period */}
              <div className="space-y-1.5">
                <Label htmlFor="nea-period" style={{ color: "var(--color-text-body)" }}>
                  Billing Period (BS)
                  <span style={{ color: "var(--color-danger)" }}> *</span>
                </Label>
                <Select value={periodKey} onValueChange={setPeriodKey}>
                  <SelectTrigger id="nea-period">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((p) => {
                      const key = `${p.year}-${p.month}`;
                      return (
                        <SelectItem key={key} value={key}>
                          {labelForPeriod(p)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Total amount */}
              <div className="space-y-1.5">
                <Label htmlFor="nea-total" style={{ color: "var(--color-text-body)" }}>
                  NEA Total Amount
                  <span style={{ color: "var(--color-danger)" }}> *</span>
                </Label>
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
                    style={{ color: "var(--color-text-sub)" }}
                  >
                    Rs
                  </span>
                  <Input
                    id="nea-total"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 24500"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* PDF upload */}
              <div className="space-y-1.5">
                <Label style={{ color: "var(--color-text-body)" }}>
                  NEA Bill PDF
                  <span style={{ color: "var(--color-danger)" }}> *</span>
                </Label>
                <DragDropFileUpload
                  value={file}
                  onChange={setFile}
                  label=""
                  acceptedTypes={["application/pdf"]}
                  maxSizeMB={10}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="nea-notes" style={{ color: "var(--color-text-body)" }}>
                  Notes{" "}
                  <span style={{ color: "var(--color-text-weak)" }}>(optional)</span>
                </Label>
                <Textarea
                  id="nea-notes"
                  placeholder="e.g. includes common area, generator surcharge…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Fixed footer ─────────────────────────────────────────────── */}
        <div
          className="px-6 py-4 shrink-0 border-t flex justify-end gap-2"
          style={{ borderColor: "var(--color-border)" }}
        >
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
              onClick={handleSubmit}
              disabled={uploading}
              style={{ backgroundColor: "var(--color-accent)", color: "#fff" }}
            >
              {uploading && (
                <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} />
              )}
              {uploading ? "Uploading…" : "Upload NEA Bill"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Helper sub-component ───────────────────────────────────────────────────────
function SummaryRow({ label, value, note }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm" style={{ color: "var(--color-text-sub)" }}>
        {label}
      </span>
      <div className="text-right">
        <span
          className="text-sm tabular-nums"
          style={{ color: "var(--color-text-body)", fontWeight: 400 }}
        >
          {value}
        </span>
        {note && (
          <span
            className="block text-[11px]"
            style={{ color: "var(--color-text-sub)" }}
          >
            {note}
          </span>
        )}
      </div>
    </div>
  );
}
