import React from "react";
import { Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import DualCalendarTailwind from "../../components/dualDate";
import { getPaymentAmounts } from "../utils/paymentUtil";
import {
  getLedgerPaymentMethodSelectOptions,
  normalizeLedgerPaymentMethod,
  paymentMethodRequiresBankAccount,
  isChequePayment,
} from "@/constants/paymentMethods.js";
import BankAccountSelect from "@/components/BankAccountSelect.jsx";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveId(val) {
  if (!val) return null;
  if (val._id) return val._id.toString();
  return val.toString();
}

function proportionalAllocate(unitBreakdown, totalRupees) {
  const totalEffectiveRemainingPaisa = unitBreakdown.reduce((sum, u) => {
    const effective = (u.grossRentAmountPaisa || 0) - (u.tdsAmountPaisa || 0);
    return sum + Math.max(0, effective - (u.paidAmountPaisa || 0));
  }, 0);

  if (totalEffectiveRemainingPaisa === 0) return [];

  const totalPaymentPaisa = Math.round(totalRupees * 100);
  let remaining = totalPaymentPaisa;
  const unpaidUnits = unitBreakdown.filter((u) => {
    const eff = (u.grossRentAmountPaisa || 0) - (u.tdsAmountPaisa || 0);
    return eff - (u.paidAmountPaisa || 0) > 0;
  });
  const result = [];

  unpaidUnits.forEach((u, idx) => {
    const unitEffectivePaisa = (u.grossRentAmountPaisa || 0) - (u.tdsAmountPaisa || 0);
    const unitRemainingPaisa = unitEffectivePaisa - (u.paidAmountPaisa || 0);

    let alloc;
    if (idx === unpaidUnits.length - 1) {
      alloc = remaining;
    } else {
      alloc = Math.round(
        (unitRemainingPaisa / totalEffectiveRemainingPaisa) * totalPaymentPaisa,
      );
      alloc = Math.min(alloc, unitRemainingPaisa);
    }

    if (alloc > 0) {
      result.push({ unitId: resolveId(u.unit), amount: alloc / 100 });
      remaining -= alloc;
    }
  });

  return result;
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-3">
      {children}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const PaymentDialog = ({
  rent,
  cams,
  bankAccounts,
  electricityRecords = [],
  formik,
  allocationMode,
  setAllocationMode,
  rentAllocation,
  setRentAllocation,
  camAllocation,
  setCamAllocation,
  lateFeeAllocation,
  setLateFeeAllocation,
  electricityAllocations = [],
  setElectricityAllocations,
  totalElectricityAllocation = 0,
  selectedBankAccountId,
  setSelectedBankAccountId,
  handleAmountChange,
  onClose,
  onTdsVerified,
}) => {
  const {
    rentAmount, camAmount, lateFeeAmount, totalDue,
    tdsAmountPaisa, hasLateFee, remainingLateFeePaisa,
  } = getPaymentAmounts(rent, cams);

  // ── Matching CAM ──────────────────────────────────────────────────────────
  const matchingCam = React.useMemo(() => {
    if (!cams?.length) return null;
    return (
      cams.find(
        (c) =>
          resolveId(c.tenant) === resolveId(rent?.tenant?._id || rent?.tenant) &&
          c.nepaliMonth === rent?.nepaliMonth &&
          c.nepaliYear === rent?.nepaliYear,
      ) || cams[0]
    );
  }, [cams, rent]);

  const units = React.useMemo(() => {
    const unitNameById = new Map(
      (rent?.units || [])
        .map((u) => [resolveId(u), u?.name])
        .filter(([id, name]) => Boolean(id) && Boolean(name)),
    );

    const hasBreakdown =
      rent?.useUnitBreakdown &&
      Array.isArray(rent.unitBreakdown) &&
      rent.unitBreakdown.length > 0;

    if (hasBreakdown) {
      return rent.unitBreakdown.map((ub, index) => {
        const unit = ub.unit;
        const id = resolveId(unit);
        const grossPaisa = ub.grossRentAmountPaisa || 0;
        const tdsPaisa = ub.tdsAmountPaisa || 0;
        const paidPaisa = ub.paidAmountPaisa || 0;
        const remainingPaisa = grossPaisa - tdsPaisa - paidPaisa;

        return {
          id,
          name:
            unit?.name ||
            unitNameById.get(id) ||
            (id ? `Unit ${index + 1}` : "Unit"),
          label: unit?.block?.name
            ? `${unit.block.name} - ${unit.innerBlock?.name || ""}`.trim()
            : "",
          gross: grossPaisa / 100,
          tds: tdsPaisa / 100,
          paidSoFar: paidPaisa / 100,
          remaining: remainingPaisa / 100,
          hasOutstanding: remainingPaisa > 0,
          _breakdownRef: ub,
        };
      });
    }

    const totals = rent?.totals || {};
    const grossPaisa = totals.grossRentAmountPaisa ?? rent?.grossRentAmountPaisa ?? 0;
    const tdsPaisa = totals.tdsAmountPaisa ?? rent?.tdsAmountPaisa ?? 0;
    const paidPaisa = totals.paidAmountPaisa ?? rent?.paidAmountPaisa ?? 0;
    const remainingPaisa = totals.remainingAmountPaisa ?? (grossPaisa - tdsPaisa - paidPaisa);
    return [
      {
        id: resolveId(rent?.units?.[0]) || rent?._id || "primary",
        name: rent?.units?.[0]?.name || "Primary Unit",
        label: `${rent?.innerBlock?.name || ""} ${rent?.block?.name || ""}`.trim(),
        gross: grossPaisa / 100,
        tds: tdsPaisa / 100,
        paidSoFar: paidPaisa / 100,
        remaining: remainingPaisa / 100,
        hasOutstanding: remainingPaisa > 0,
        _breakdownRef: null,
      },
    ];
  }, [rent]);

  // ── Selected units ────────────────────────────────────────────────────────
  const [selectedUnitIds, setSelectedUnitIds] = React.useState(
    units.filter((u) => u.hasOutstanding).map((u) => u.id),
  );

  // ── TDS state ─────────────────────────────────────────────────────────────
  const [tdsPaidToGovt, setTdsPaidToGovt] = React.useState(false);
  const [tdsPaidDate, setTdsPaidDate] = React.useState("");
  const [tdsNepaliDate, setTdsNepaliDate] = React.useState("");
  const [tdsNotes, setTdsNotes] = React.useState("");
  const [tdsDocument, setTdsDocument] = React.useState(null);
  const [tdsDocumentError, setTdsDocumentError] = React.useState("");
  const [tdsUploading, setTdsUploading] = React.useState(false);
  const [tdsUploadedPath, setTdsUploadedPath] = React.useState("");

  React.useEffect(() => {
    setSelectedUnitIds(units.filter((u) => u.hasOutstanding).map((u) => u.id));
  }, [rent?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedUnits = units.filter((u) => selectedUnitIds.includes(u.id));
  const allSelected = selectedUnitIds.length === units.length;

  // ── Per-unit rent allocation (manual mode) ────────────────────────────────
  const [unitRentAllocations, setUnitRentAllocations] = React.useState({});

  React.useEffect(() => {
    setUnitRentAllocations((prev) => {
      const next = {};
      selectedUnits.forEach((u) => { next[u.id] = prev[u.id] ?? u.remaining; });
      return next;
    });
  }, [selectedUnitIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Electricity ───────────────────────────────────────────────────────────
  const totalElecDue = electricityRecords.reduce((sum, r) => {
    return sum + (r.remainingAmount ?? Math.max(0, (r.totalAmount || 0) - (r.paidAmount || 0)));
  }, 0);

  // ── Derived amounts ───────────────────────────────────────────────────────
  const paymentAmount = formik.values?.amount || 0;
  const totalAllocated =
    rentAllocation + camAllocation + totalElectricityAllocation + (lateFeeAllocation || 0);
  const grandTotalDue = totalDue + totalElecDue;
  const balanceOwed = grandTotalDue - totalAllocated;
  const isOverAllocated = totalAllocated > paymentAmount && paymentAmount > 0;

  const lateFeeRemaining = remainingLateFeePaisa / 100;
  const isPartialLateFee =
    (lateFeeAllocation || 0) > 0 &&
    (lateFeeAllocation || 0) < lateFeeRemaining - 0.01;

  const autoUnitAllocations = React.useMemo(() => {
    if (!rent?.useUnitBreakdown || !rent?.unitBreakdown?.length) return [];
    const selectedBreakdown = rent.unitBreakdown.filter((ub) =>
      selectedUnitIds.includes(resolveId(ub.unit)),
    );
    if (!selectedBreakdown.length || !rentAllocation) return [];
    return proportionalAllocate(selectedBreakdown, rentAllocation);
  }, [rent, selectedUnitIds, rentAllocation]);

  const manualUnitRentTotal = Object.values(unitRentAllocations).reduce(
    (s, v) => s + (parseFloat(v) || 0), 0,
  );
  const unitAllocationMismatch =
    allocationMode === "manual" &&
    rent?.useUnitBreakdown &&
    Math.abs(manualUnitRentTotal - rentAllocation) > 0.01;
  const isCheque = isChequePayment(formik.values?.paymentMethod);

  // ── Payload builder ───────────────────────────────────────────────────────
  function buildPayload() {
    const isMultiUnit = rent?.useUnitBreakdown && rent?.unitBreakdown?.length > 0;

    const payload = {
      tenantId: resolveId(rent?.tenant?._id || rent?.tenant),
      amount: paymentAmount,
      paymentDate: formik.values?.paymentDate
        ? new Date(formik.values.paymentDate).toISOString().split("T")[0]
        : null,
      nepaliDate: formik.values?.nepaliDate || null,
      paymentMethod: normalizeLedgerPaymentMethod(formik.values?.paymentMethod, ""),
      paymentStatus: isCheque ? "paid" : "pending",
      note: formik.values?.note || "",
      bankAccountId: formik.values?.bankAccountId || null,
      bankAccountCode: formik.values?.bankAccountCode || null,
      transactionRef: formik.values?.transactionRef || null,
      allocations: {},
    };

    if (rentAllocation > 0) {
      const rentEntry = { rentId: rent._id, amount: rentAllocation };
      if (isMultiUnit) {
        const unitAllocations =
          allocationMode === "manual"
            ? selectedUnits
              .map((u) => ({ unitId: u.id, amount: parseFloat(unitRentAllocations[u.id]) || 0 }))
              .filter((a) => a.amount > 0)
            : autoUnitAllocations.filter((a) => selectedUnitIds.includes(a.unitId));
        if (unitAllocations.length > 0) rentEntry.unitAllocations = unitAllocations;
      }
      payload.allocations.rent = rentEntry;
    }

    if (camAllocation > 0 && matchingCam?._id) {
      payload.allocations.cam = { camId: matchingCam._id, paidAmount: camAllocation };
    }

    if ((lateFeeAllocation || 0) > 0) {
      payload.allocations.lateFee = { rentId: rent._id, amount: lateFeeAllocation };
    }

    const validElec = electricityAllocations.filter((a) => (a.amount || 0) > 0);
    if (validElec.length > 0) {
      payload.allocations.electricity = validElec;
    }

    return payload;
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const needsBankAccount = paymentMethodRequiresBankAccount(formik.values?.paymentMethod);

  const isElecOverAllocated = electricityAllocations.some((a) => {
    const rec = electricityRecords.find((r) => r._id === a.electricityId);
    if (!rec) return false;
    const due = rec.remainingAmount ?? Math.max(0, (rec.totalAmount || 0) - (rec.paidAmount || 0));
    return (a.amount || 0) > due + 0.01;
  });

  const isSubmitDisabled =
    !selectedUnits.length ||
    isOverAllocated ||
    isElecOverAllocated ||
    isPartialLateFee ||
    !paymentAmount ||
    !formik.values?.paymentMethod ||
    !formik.values?.paymentDate ||
    (needsBankAccount && !formik.values?.bankAccountId) ||
    (isCheque && !formik.values?.chequeNumber?.trim()) ||
    unitAllocationMismatch ||
    tdsUploading;

  const summaryState =
    balanceOwed === 0 ? "full"
      : balanceOwed > 0 ? "partial"
        : "over";

  const portalContainerRef = React.useRef(null);

  const hasErrors =
    !selectedUnits.length ||
    isOverAllocated ||
    isElecOverAllocated ||
    isPartialLateFee ||
    unitAllocationMismatch ||
    (needsBankAccount && !formik.values?.bankAccountId) ||
    (isCheque && !formik.values?.chequeNumber?.trim());

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = buildPayload();
    await formik.setValues({ ...formik.values, ...payload });

    try {
      const api = (await import("../../../plugins/axios")).default;

      if (tdsPaidToGovt && !rent?.tdsPaidToGovernment && tdsDocument && !tdsUploadedPath) {
        setTdsUploading(true);
        const uploadForm = new FormData();
        uploadForm.append("tdsDocument", tdsDocument);
        const uploadRes = await api.post(`/api/rent/${rent._id}/tds/upload-document`, uploadForm);
        if (!uploadRes?.data?.success) {
          throw new Error(uploadRes?.data?.message || "TDS document upload failed");
        }
        setTdsUploadedPath(uploadRes?.data?.data?.tdsReceiptUrl || "");
      }

      await formik.handleSubmit();

      if (formik.isValid && tdsPaidToGovt && !rent?.tdsPaidToGovernment) {
        try {
          const tdsPayload = {
            tdsPaidDate: tdsPaidDate || new Date().toISOString(),
            nepaliTdsPaidDate: tdsNepaliDate || "",
            tdsPaidNotes: tdsNotes || "",
          };
          const response = await api.patch(`/api/rent/${rent._id}/tds/mark-paid`, tdsPayload);
          if (response.data.success) {
            toast.success(
              tdsUploadedPath || tdsDocument
                ? "Payment recorded and TDS receipt linked successfully"
                : "TDS payment verified successfully",
            );
            if (onTdsVerified) onTdsVerified();
          }
        } catch (error) {
          console.error("TDS verification error:", error);
          toast.error("Payment successful, but TDS verification failed. Please verify manually.");
        }
      }

      if (formik.isValid) onClose();
    } catch (error) {
      console.error("Payment with TDS upload flow error:", error);
      const { toast: t } = await import("sonner");
      t.error(error?.response?.data?.message || error?.message || "Payment failed. Please try again.");
    } finally {
      setTdsUploading(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-[600px] p-0 flex flex-col h-[92vh] overflow-hidden bg-background rounded-xl">
      <div ref={portalContainerRef} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-5 border-b border-border flex items-start justify-between">
        <div>
          <h2 className="text-[17px] font-bold text-foreground tracking-tight">Record Payment</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {rent.nepaliMonth} {rent.nepaliYear}
            {rent?.tenant?.name && (
              <span className="text-muted-foreground/60"> · {rent.tenant.name}</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total Due</p>
          <p className="text-[22px] font-bold text-foreground leading-tight mt-0.5">
            RS {grandTotalDue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-6 space-y-8">

          {/* ══ Due Summary ══════════════════════════════════════════════════ */}
          <section>
            <SectionLabel>Amount Due</SectionLabel>
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {/* Rent */}
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">
                    Rent{tdsAmountPaisa > 0 ? " (net TDS)" : ""}
                  </p>
                  {tdsAmountPaisa > 0 && (
                    <p className="text-[11px] text-amber-600 mt-0.5">
                      RS {(tdsAmountPaisa / 100).toLocaleString()} withheld by tenant
                    </p>
                  )}
                </div>
                <p className="text-[15px] font-semibold text-foreground tabular-nums">
                  RS {rentAmount.toLocaleString()}
                </p>
              </div>

              {/* CAM */}
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-[13px] font-medium text-foreground">CAM</p>
                <p className="text-[15px] font-semibold text-foreground tabular-nums">
                  RS {camAmount.toLocaleString()}
                </p>
              </div>

              {/* Electricity */}
              {totalElecDue > 0 && (
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
                      <Zap className="size-3.5 text-amber-500" />
                      Electricity
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {electricityRecords.length} reading{electricityRecords.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-[15px] font-semibold text-foreground tabular-nums">
                    RS {totalElecDue.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Late Fee */}
              {hasLateFee && (
                <div className="flex items-center justify-between px-4 py-3 bg-destructive/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-destructive">Late Fee</p>
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                        Penalty
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Full payment required</p>
                  </div>
                  <p className="text-[15px] font-semibold text-destructive tabular-nums">
                    RS {lateFeeAmount.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Total row */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">Total</p>
                <p className="text-[17px] font-bold text-foreground tabular-nums">
                  RS {grandTotalDue.toLocaleString()}
                </p>
              </div>
            </div>
          </section>

          {/* ══ TDS Section ══════════════════════════════════════════════════ */}
          {tdsAmountPaisa > 0 && (
            <section>
              <SectionLabel>TDS to Government</SectionLabel>
              <div className={cn(
                "rounded-lg border p-4",
                rent?.tdsPaidToGovernment
                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                  : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    {rent?.tdsPaidToGovernment
                      ? <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                      : <AlertCircle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                    }
                    <div>
                      <p className={cn(
                        "text-[13px] font-semibold",
                        rent?.tdsPaidToGovernment ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                      )}>
                        {rent?.tdsPaidToGovernment
                          ? `Verified ${rent.tdsPaidDate ? new Date(rent.tdsPaidDate).toLocaleDateString() : ""}`
                          : `RS ${(tdsAmountPaisa / 100).toLocaleString()} must be paid to IRD`
                        }
                      </p>
                      <p className={cn(
                        "text-[11px] mt-0.5 opacity-80",
                        rent?.tdsPaidToGovernment ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {rent?.tdsPaidToGovernment
                          ? "TDS payment confirmed"
                          : "Tenant withholds this amount from rent"
                        }
                      </p>
                    </div>
                  </div>

                  {!rent?.tdsPaidToGovernment && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={tdsPaidToGovt}
                        onChange={(e) => setTdsPaidToGovt(e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-primary"
                      />
                      <span className="text-[12px] font-medium text-foreground">Verified</span>
                    </label>
                  )}
                </div>

                {/* TDS details form */}
                {tdsPaidToGovt && !rent?.tdsPaidToGovernment && (
                  <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">Payment Date</Label>
                        <DualCalendarTailwind
                          value={tdsPaidDate}
                          nepaliValue={tdsNepaliDate}
                          onChange={(ad, bs) => {
                            setTdsPaidDate(ad);
                            setTdsNepaliDate(bs);
                          }}
                          placeholder="Select date"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px]">Receipt / Reference <span className="font-normal">(optional)</span></Label>
                        <Input
                          placeholder="Receipt number"
                          value={tdsNotes}
                          onChange={(e) => setTdsNotes(e.target.value)}
                          className="text-[13px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">Upload TDS Receipt <span className="font-normal">(optional)</span></Label>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const maxSize = 10 * 1024 * 1024;
                            if (file.size > maxSize) {
                              setTdsDocumentError("File size must be less than 10MB");
                              setTdsDocument(null);
                              e.target.value = "";
                            } else {
                              setTdsDocumentError("");
                              setTdsDocument(file);
                              setTdsUploadedPath("");
                            }
                          } else {
                            setTdsDocument(null);
                            setTdsDocumentError("");
                            setTdsUploadedPath("");
                          }
                        }}
                        className="text-[12px]"
                      />
                      {tdsDocumentError && (
                        <p className="text-[11px] text-destructive">{tdsDocumentError}</p>
                      )}
                      {tdsDocument && !tdsDocumentError && (
                        <p className="text-[11px] text-muted-foreground">
                          {tdsDocument.name} ({(tdsDocument.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                      {tdsUploadedPath && (
                        <p className="text-[11px] text-emerald-600">Uploaded receipt attached.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ══ Unit Selection ════════════════════════════════════════════════ */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Units</SectionLabel>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 cursor-pointer accent-primary"
                  checked={allSelected}
                  onChange={(e) =>
                    setSelectedUnitIds(e.target.checked ? units.map((u) => u.id) : [])
                  }
                />
                <span className="text-[11px] text-muted-foreground font-medium">Select all</span>
              </label>
            </div>

            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {units.map((unit) => {
                const selected = selectedUnitIds.includes(unit.id);
                return (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() =>
                      setSelectedUnitIds((prev) =>
                        prev.includes(unit.id)
                          ? prev.filter((id) => id !== unit.id)
                          : [...prev, unit.id],
                      )
                    }
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-center justify-between gap-4 transition-colors duration-100",
                      selected ? "bg-primary/5" : "bg-background hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "size-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                          selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                        )}
                      >
                        {selected && <div className="size-1.5 rounded-full bg-primary-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{unit.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          {unit.label && <span>{unit.label}</span>}
                          {unit.hasOutstanding && (
                            <span className="text-amber-600 font-medium">Outstanding</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-semibold text-foreground tabular-nums">
                        RS {unit.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">net payable</p>
                      {unit.tds > 0 && (
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          TDS RS {unit.tds.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {!selectedUnits.length && (
              <p className="text-[11px] text-destructive mt-2">Select at least one unit to continue.</p>
            )}
          </section>

          {/* ══ Allocation ════════════════════════════════════════════════════ */}
          <section>
            <SectionLabel>Allocation</SectionLabel>

            {/* Segmented control */}
            <div className="grid grid-cols-2 bg-muted border border-border rounded-lg p-0.5 mb-4">
              {[
                { value: "auto", label: "Quick Payment" },
                { value: "manual", label: "Custom" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setAllocationMode(tab.value)}
                  className={cn(
                    "rounded-md py-1.5 text-[12px] font-medium cursor-pointer transition-all",
                    allocationMode === tab.value
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Auto mode */}
            {allocationMode === "auto" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Amount to Pay (Rs)</Label>
                  <Input
                    type="number"
                    placeholder={`Full due: RS ${grandTotalDue.toLocaleString()}`}
                    value={formik.values?.amount || ""}
                    onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0, rent, electricityRecords)}
                    onBlur={(e) => { if (!e.target.value) handleAmountChange(grandTotalDue, rent, electricityRecords); }}
                    className="text-[15px] font-semibold"
                  />
                </div>

                <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-[12px] font-medium text-foreground">Rent</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Due RS {rentAmount.toLocaleString()}</p>
                    </div>
                    <p className={cn("text-[13px] font-semibold tabular-nums", rentAllocation > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                      RS {rentAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>

                  {camAmount > 0 && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-[12px] font-medium text-foreground">CAM</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Due RS {camAmount.toLocaleString()}</p>
                      </div>
                      <p className={cn("text-[13px] font-semibold tabular-nums", camAllocation > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                        RS {camAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}

                  {totalElecDue > 0 && electricityRecords.map((elec) => {
                    const due = elec.remainingAmount ?? Math.max(0, (elec.totalAmount || 0) - (elec.paidAmount || 0));
                    if (due <= 0) return null;
                    const unitName = elec.unit?.name || elec.subMeter?.name || "Unit";
                    const alloc = electricityAllocations.find((a) => a.electricityId === elec._id);
                    return (
                      <div key={elec._id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                            <Zap className="size-3 text-amber-500" />{unitName}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Electricity · Due RS {due.toLocaleString()}</p>
                        </div>
                        <p className={cn("text-[13px] font-semibold tabular-nums", (alloc?.amount || 0) > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                          RS {(alloc?.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    );
                  })}

                  {hasLateFee && (
                    <div className="flex items-center justify-between px-4 py-3 bg-destructive/5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-medium text-destructive">Late Fee</p>
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                            Full only
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Due RS {lateFeeAmount.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[13px] font-semibold tabular-nums", (lateFeeAllocation || 0) > 0 ? "text-destructive" : "text-muted-foreground/40")}>
                          RS {(lateFeeAllocation || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        {(lateFeeAllocation || 0) === 0 && paymentAmount > 0 && (
                          <p className="text-[10px] text-muted-foreground">+RS {lateFeeAmount.toLocaleString()} to cover</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Unit breakdown */}
                  {autoUnitAllocations.length > 0 && (
                    <div className="px-4 py-3 bg-muted/20">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                        Unit breakdown
                      </p>
                      <div className="space-y-1.5">
                        {autoUnitAllocations.map((alloc) => {
                          const unit = units.find((u) => u.id === alloc.unitId);
                          return (
                            <div key={alloc.unitId} className="flex justify-between items-center">
                              <span className="text-[12px] text-muted-foreground">{unit?.name || alloc.unitId}</span>
                              <span className="text-[12px] font-semibold text-foreground tabular-nums">
                                RS {alloc.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Total Allocated</p>
                    <p className="text-[14px] font-bold text-foreground tabular-nums">
                      RS {totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Manual mode */}
            {allocationMode === "manual" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Total Amount to Pay (Rs)</Label>
                  <Input
                    type="number"
                    placeholder={`Full due: RS ${grandTotalDue.toLocaleString()}`}
                    value={formik.values?.amount || ""}
                    onChange={(e) => formik.setFieldValue("amount", parseFloat(e.target.value) || 0)}
                    className="text-[15px] font-semibold"
                  />
                </div>

                <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <p className="text-[12px] font-medium text-foreground">Rent</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Due RS {rentAmount.toLocaleString()}</p>
                    </div>
                    <Input
                      type="number"
                      placeholder="0"
                      value={rentAllocation || ""}
                      onChange={(e) => setRentAllocation(parseFloat(e.target.value) || 0)}
                      className="w-[120px] text-right text-[13px]"
                    />
                  </div>

                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <p className="text-[12px] font-medium text-foreground">CAM</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Due RS {camAmount.toLocaleString()}</p>
                    </div>
                    <Input
                      type="number"
                      placeholder="0"
                      value={camAllocation || ""}
                      onChange={(e) => setCamAllocation(parseFloat(e.target.value) || 0)}
                      className="w-[120px] text-right text-[13px]"
                    />
                  </div>

                  {totalElecDue > 0 && electricityRecords.map((elec) => {
                    const due = elec.remainingAmount ?? Math.max(0, (elec.totalAmount || 0) - (elec.paidAmount || 0));
                    if (due <= 0) return null;
                    const unitName = elec.unit?.name || elec.subMeter?.name || "Unit";
                    const currentAlloc = electricityAllocations.find((a) => a.electricityId === elec._id);
                    const isOver = (currentAlloc?.amount || 0) > due + 0.01;
                    return (
                      <div key={elec._id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1">
                          <p className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                            <Zap className="size-3 text-amber-500" />{unitName}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Electricity · Due RS {due.toLocaleString()}</p>
                          {isOver && (
                            <p className="text-[10px] text-destructive mt-0.5 font-medium">Cannot exceed RS {due.toLocaleString()}</p>
                          )}
                        </div>
                        <Input
                          type="number"
                          placeholder="0"
                          value={currentAlloc?.amount || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setElectricityAllocations((prev) => {
                              const next = prev.filter((a) => a.electricityId !== elec._id);
                              if (val > 0) next.push({ electricityId: elec._id, amount: val });
                              return next;
                            });
                          }}
                          className={cn("w-[120px] text-right text-[13px]", isOver && "border-destructive")}
                        />
                      </div>
                    );
                  })}

                  {hasLateFee && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-destructive/5">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-medium text-destructive">Late Fee</p>
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                            All or nothing
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Due RS {lateFeeAmount.toLocaleString()}</p>
                        {isPartialLateFee && (
                          <p className="text-[10px] text-destructive mt-0.5 font-medium">Enter RS {lateFeeAmount.toLocaleString()} or 0</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Input
                          type="number"
                          placeholder="0"
                          value={lateFeeAllocation || ""}
                          onChange={(e) => setLateFeeAllocation(parseFloat(e.target.value) || 0)}
                          className={cn("w-[120px] text-right text-[13px]", isPartialLateFee && "border-destructive")}
                        />
                        <button
                          type="button"
                          onClick={() => setLateFeeAllocation(lateFeeAmount)}
                          className="text-[10px] text-destructive underline cursor-pointer bg-transparent border-0 p-0"
                        >
                          Fill RS {lateFeeAmount.toLocaleString()}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Total Allocated</p>
                      {totalAllocated !== (formik.values?.amount || 0) && (formik.values?.amount || 0) > 0 && (
                        <p className={cn("text-[10px] mt-0.5", isOverAllocated ? "text-destructive" : "text-amber-600")}>
                          {isOverAllocated
                            ? `RS ${(totalAllocated - (formik.values?.amount || 0)).toLocaleString()} over`
                            : `RS ${((formik.values?.amount || 0) - totalAllocated).toLocaleString()} unallocated`
                          }
                        </p>
                      )}
                    </div>
                    <p className={cn("text-[14px] font-bold tabular-nums", isOverAllocated ? "text-destructive" : "text-foreground")}>
                      RS {totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>

                {/* Per-unit breakdown */}
                {rent?.useUnitBreakdown && selectedUnits.length > 0 && (
                  <div className="rounded-lg border border-border p-4 bg-background space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">Per-unit rent</p>
                      <p className={cn("text-[11px] font-medium", unitAllocationMismatch ? "text-destructive" : "text-muted-foreground")}>
                        {unitAllocationMismatch
                          ? `RS ${manualUnitRentTotal.toFixed(0)} ≠ RS ${rentAllocation.toFixed(0)}`
                          : `Must sum to RS ${rentAllocation.toLocaleString()}`
                        }
                      </p>
                    </div>
                    <div className="space-y-2">
                      {selectedUnits.map((unit) => (
                        <div key={unit.id} className="flex items-center gap-3">
                          <div className="flex-1">
                            <p className="text-[12px] font-medium text-foreground">{unit.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Remaining RS {unit.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <Input
                            type="number"
                            className="w-[120px] text-right text-[12px]"
                            value={unitRentAllocations[unit.id] ?? ""}
                            placeholder="0"
                            max={unit.remaining}
                            onChange={(e) =>
                              setUnitRentAllocations((prev) => ({
                                ...prev,
                                [unit.id]: parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ══ Payment Details ═══════════════════════════════════════════════ */}
          <section>
            <SectionLabel>Payment Details</SectionLabel>
            <div className="space-y-4">
              {/* Method */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">Method *</Label>
                <Select
                  value={formik.values?.paymentMethod || ""}
                  onValueChange={(v) => {
                    formik.setFieldValue("paymentMethod", v);
                    if (!paymentMethodRequiresBankAccount(v)) {
                      setSelectedBankAccountId("");
                      formik.setFieldValue("bankAccountId", "");
                      formik.setFieldValue("bankAccountCode", "");
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method…" />
                  </SelectTrigger>
                  <SelectContent>
                    {getLedgerPaymentMethodSelectOptions().map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ══ Cheque Details ════════════════════════════════════════════════ */}
              {isCheque && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <SectionLabel>Cheque Details</SectionLabel>
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                      Pending clearance
                    </span>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[12px]">Cheque Number *</Label>
                        <Input
                          placeholder="e.g. 001234"
                          value={formik.values?.chequeNumber || ""}
                          onChange={(e) => formik.setFieldValue("chequeNumber", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[12px]">Issuing Bank *</Label>
                        <Input
                          placeholder="e.g. Nabil Bank"
                          value={formik.values?.chequeBankName || ""}
                          onChange={(e) => formik.setFieldValue("chequeBankName", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[12px]">Account Holder <span className="font-normal text-muted-foreground">(optional)</span></Label>
                        <Input
                          placeholder="Name on cheque"
                          value={formik.values?.chequeAccountName || ""}
                          onChange={(e) => formik.setFieldValue("chequeAccountName", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[12px]">Branch <span className="font-normal text-muted-foreground">(optional)</span></Label>
                        <Input
                          placeholder="e.g. New Baneshwor"
                          value={formik.values?.chequeBranch || ""}
                          onChange={(e) => formik.setFieldValue("chequeBranch", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Bank Account */}
              {needsBankAccount && (
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Deposit To *</Label>
                  <BankAccountSelect
                    bankAccounts={bankAccounts}
                    value={selectedBankAccountId ? String(selectedBankAccountId) : ""}
                    onValueChange={(id) => {
                      const bank = bankAccounts.find((b) => String(b._id) === String(id));
                      setSelectedBankAccountId(id);
                      formik.setFieldValue("bankAccountId", id);
                      formik.setFieldValue("bankAccountCode", bank?.accountCode || "");
                    }}
                    showBalance
                    triggerClassName="w-full"
                  />
                  {needsBankAccount && !formik.values?.bankAccountId && (
                    <p className="text-[11px] text-destructive">Select a bank account to continue.</p>
                  )}
                </div>
              )}

              {/* Payment Date */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">Payment Date *</Label>
                <DualCalendarTailwind
                  container={portalContainerRef.current}
                  onChange={(english, nepali) => {
                    if (english && nepali) {
                      formik.setFieldValue("paymentDate", new Date(english));
                      formik.setFieldValue("nepaliDate", nepali);
                    } else {
                      formik.setFieldValue("paymentDate", null);
                      formik.setFieldValue("nepaliDate", null);
                    }
                  }}
                />
              </div>

              {/* Transaction Ref */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">Transaction Reference <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                  placeholder="e.g. CHQ-12345"
                  value={formik.values?.transactionRef || ""}
                  onChange={(e) => formik.setFieldValue("transactionRef", e.target.value)}
                  className="text-[13px]"
                />
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label className="text-[12px]">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                  placeholder="e.g. Payment for Unit A"
                  value={formik.values?.note || ""}
                  onChange={(e) => formik.setFieldValue("note", e.target.value)}
                  className="text-[13px]"
                />
              </div>
            </div>
          </section>



        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-6 py-4 bg-background">
        {/* Validation errors */}
        {hasErrors && (
          <div className="flex flex-col gap-0.5 mb-3 px-3 py-2.5 rounded-lg bg-destructive/8 border border-destructive/20">
            {!selectedUnits.length && (
              <p className="text-[11px] text-destructive">Select at least one unit.</p>
            )}
            {isOverAllocated && (
              <p className="text-[11px] text-destructive">Allocation exceeds payment amount.</p>
            )}
            {isElecOverAllocated && (
              <p className="text-[11px] text-destructive">Electricity allocation exceeds bill for one or more units.</p>
            )}
            {isPartialLateFee && (
              <p className="text-[11px] text-destructive">Late fee must be RS {lateFeeAmount.toLocaleString()} or 0.</p>
            )}
            {unitAllocationMismatch && (
              <p className="text-[11px] text-destructive">Unit allocations must sum to RS {rentAllocation.toFixed(2)}.</p>
            )}
            {needsBankAccount && !formik.values?.bankAccountId && (
              <p className="text-[11px] text-destructive">Select a bank account.</p>
            )}
            {isCheque && !formik.values?.chequeNumber?.trim() && (
              <p className="text-[11px] text-destructive">Enter cheque number.</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          {/* Balance status */}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {summaryState === "full" ? "Fully allocated" : summaryState === "over" ? "Over-allocated" : "Balance remaining"}
            </p>
            <p className={cn(
              "text-[16px] font-bold tabular-nums",
              summaryState === "full" ? "text-emerald-600"
                : summaryState === "over" ? "text-destructive"
                  : "text-amber-600"
            )}>
              RS {Math.abs(balanceOwed).toLocaleString()}
              {summaryState === "over" && " over"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="text-[13px] px-4"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitDisabled}
              className="text-[13px] px-6 font-semibold"
              onClick={handleSubmit}
            >
              {tdsUploading ? "Uploading…" : "Submit Payment"}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  );
};
