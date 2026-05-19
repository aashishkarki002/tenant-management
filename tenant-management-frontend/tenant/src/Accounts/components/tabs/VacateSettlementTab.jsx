import { useState } from "react";
import { Loader2Icon, TriangleAlertIcon, CheckCircle2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenant } from "../../../hooks/use-tenants";

import { useVacateSettlement, useVacateList } from "../../hooks/useVacateSettlement";
import { useActiveTenants } from "../../hooks/useActiveTenants";
import { fmtRs } from "../../../utils/formatter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NP", {
    year: "numeric", month: "short", day: "2-digit",
  });
}

const STATUS_COLORS = {
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  DRAFT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children, className }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-semibold text-[var(--color-text-sub)] uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ─── Settlement preview card ──────────────────────────────────────────────────

function PreviewCard({ preview }) {
  const rows = [
    { label: "Existing AR (open charges)", value: preview.finalRentDuePaisa, color: "text-orange-600" },
    { label: `Pro-rated rent (${preview.proRatedDays}/${preview.totalDaysInMonth} days)`, value: preview.proRatedRentPaisa, color: "text-orange-600" },
    { label: "Pro-rated CAM", value: preview.proRatedCamPaisa, color: "text-orange-600" },
    null,
    { label: "Total AR at vacate", value: preview.totalArAtVacatePaisa, color: "font-bold text-[var(--color-text-body)]" },
    null,
    { label: "Security deposit held", value: preview.sdBalancePaisa, color: "text-[var(--color-text-sub)]" },
    { label: "Applied to AR", value: -preview.sdAppliedToArPaisa, color: "text-green-600" },
    { label: "Maintenance deduction", value: -preview.sdMaintenanceDeduction, color: "text-green-600" },
    { label: "Cash refund to tenant", value: -preview.sdCashRefundPaisa, color: "text-blue-600" },
    null,
    { label: "Bad debt write-off", value: preview.badDebtWrittenOffPaisa, color: "text-red-600" },
  ];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1">
      <p className="text-[13px] font-semibold text-[var(--color-text-body)] mb-3">Settlement Preview</p>
      {rows.map((row, i) =>
        row === null ? (
          <Separator key={i} className="my-2 bg-[var(--color-border)]" />
        ) : row.value !== 0 && row.value != null ? (
          <div key={row.label} className="flex justify-between items-center text-xs">
            <span className="text-[var(--color-text-sub)]">{row.label}</span>
            <span className={cn("tabular-nums font-medium", row.color)}>{fmtRs(row.value)}</span>
          </div>
        ) : null
      )}
    </div>
  );
}

// ─── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ open, onClose, onConfirm, executing, error }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[var(--color-bg)] border-[var(--color-border)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--color-text-heading)]">
            <TriangleAlertIcon className="size-4 text-amber-500" />
            Confirm Settlement
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--color-text-sub)]">
          This will post all journals, lock the tenant&apos;s ledger, and mark them as vacated.{" "}
          <strong className="text-[var(--color-text-body)]">This cannot be undone.</strong>
        </p>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[var(--color-border)] text-[var(--color-text-sub)]">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={executing}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {executing && <Loader2Icon className="size-4 animate-spin" />}
            {executing ? "Processing…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function VacateSettlementTab({ entityId }) {
  const [tenantId, setTenantId] = useState("");
  const [vacateDate, setVacateDate] = useState("");
  const [maintenanceDed, setMaintenanceDed] = useState(0);
  const [writeOff, setWriteOff] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const {
    tenants,
    loading: tenantsLoading,
  } = useTenant();
  const { preview, computing, executing, error, compute, execute } = useVacateSettlement(entityId);
  const { settlements, refetch: refetchList } = useVacateList(entityId, undefined);

  const handleCompute = async () => {
    if (!tenantId || !vacateDate) return;
    await compute({
      tenantId,
      vacateDate,
      maintenanceDeductionPaisa: Math.round(maintenanceDed * 100),
      writeOffBadDebt: writeOff,
      paymentMethod,
      notes,
    });
  };

  const handleExecute = async () => {
    try {
      await execute({ tenantId, paymentMethod, writeOffBadDebt: writeOff, notes });
      setSuccessMsg("Settlement completed. Tenant ledger is now locked.");
      setShowConfirm(false);
      refetchList();
    } catch { /* error surfaced via hook */ }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[var(--color-text-heading)]">Vacate Settlement</h2>
        <p className="text-sm text-[var(--color-text-sub)] mt-0.5">
          Pro-rate final charges, settle security deposit, lock tenant ledger
        </p>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-400 font-semibold">
          <CheckCircle2Icon className="size-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {error && !showConfirm && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <TriangleAlertIcon className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* New settlement form */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <p className="text-[13px] font-semibold text-[var(--color-text-body)]">New Settlement</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tenant select */}
          <Field label="Tenant">
            <Select value={tenantId} onValueChange={setTenantId} disabled={tenantsLoading}>
              <SelectTrigger className="h-9 w-full text-sm">
                {tenantsLoading
                  ? <span className="text-[var(--color-text-sub)] text-xs">Loading tenants…</span>
                  : <SelectValue placeholder="Select tenant…" />
                }
              </SelectTrigger>
              <SelectContent>
                {tenants.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-center text-[var(--color-text-sub)]">
                    No active tenants found
                  </div>
                ) : (
                  tenants.map(t => (
                    <SelectItem key={t._id} value={t._id}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{t.name}</span>
                        {t.unit?.name && (
                          <span className="text-[11px] text-muted-foreground">{t.unit.name}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>

          {/* Vacate date */}
          <Field label="Vacate Date">
            <Input
              type="date"
              value={vacateDate}
              onChange={e => setVacateDate(e.target.value)}
              className="h-9 text-sm"
            />
          </Field>

          {/* Maintenance deduction */}
          <Field label="Maintenance Deduction (Rs)">
            <Input
              type="number"
              min="0"
              value={maintenanceDed}
              onChange={e => setMaintenanceDed(Number(e.target.value))}
              className="h-9 text-sm"
            />
          </Field>

          {/* SD refund method */}
          <Field label="SD Refund Method">
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Write-off checkbox */}
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="writeoff"
            checked={writeOff}
            onCheckedChange={setWriteOff}
            className="mt-0.5"
          />
          <Label htmlFor="writeoff" className="text-sm text-[var(--color-text-body)] font-normal leading-snug cursor-pointer">
            Write off remaining AR as bad debt (if any balance remains after SD)
          </Label>
        </div>

        {/* Notes */}
        <Field label="Notes (optional)">
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes…"
            className="h-9 text-sm"
          />
        </Field>

        <Button
          onClick={handleCompute}
          disabled={!tenantId || !vacateDate || computing}
          className="bg-[var(--color-accent)] text-white hover:opacity-90 gap-1.5"
          size="sm"
        >
          {computing && <Loader2Icon className="size-4 animate-spin" />}
          {computing ? "Computing…" : "Compute Preview"}
        </Button>
      </div>

      {/* Preview + execute */}
      {preview && (
        <div className="space-y-3">
          <PreviewCard preview={preview} />
          <Button
            onClick={() => setShowConfirm(true)}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Execute Settlement
          </Button>
        </div>
      )}

      {/* Settlements history */}
      {settlements.length > 0 && (
        <div className="space-y-3">
          <p className="text-[13px] font-semibold text-[var(--color-text-body)]">Settlement History</p>
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[var(--color-surface)] hover:bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                  <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Tenant</TableHead>
                  <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Status</TableHead>
                  <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)] text-right">Total AR</TableHead>
                  <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)] text-right">SD Refund</TableHead>
                  <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Vacate Date</TableHead>
                  <TableHead className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-sub)]">Settled By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map(s => (
                  <TableRow key={s._id} className="border-b border-[var(--color-border)]">
                    <TableCell className="px-4 py-3 text-sm text-[var(--color-text-body)]">
                      {s.tenant?.name ?? "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", STATUS_COLORS[s.status] ?? STATUS_COLORS.CANCELLED)}>
                        {s.status}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-right font-mono text-orange-600 tabular-nums">
                      {fmtRs(s.totalArAtVacatePaisa)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-right font-mono text-blue-600 tabular-nums">
                      {fmtRs(s.sdCashRefundPaisa)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-[var(--color-text-sub)]">
                      {fmtDate(s.vacateDate)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-[var(--color-text-sub)]">
                      {s.settledBy?.name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleExecute}
        executing={executing}
        error={error}
      />
    </div>
  );
}
