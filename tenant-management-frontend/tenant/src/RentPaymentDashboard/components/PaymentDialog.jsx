import React from "react";
import { Zap } from "lucide-react";
import {
  DialogContent,
} from "@/components/ui/dialog";
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
} from "@/constants/paymentMethods.js";
import BankAccountSelect from "@/components/BankAccountSelect.jsx";
import { toast } from "sonner";


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
        // All raw paisa values from backend — only divide to get rupees
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
            ? `${unit.block.name} – ${unit.innerBlock?.name || ""}`.trim()
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

    // Non-breakdown: read backend totals directly
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

  // ── TDS verification state ─────────────────────────────────────────────────
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
      paymentStatus: "paid",
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

  // Electricity over-allocation: any record allocated more than its due
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
    (needsBankAccount && !formik.values?.bankAccountCode) ||
    unitAllocationMismatch ||
    tdsUploading;

  // ── Summary tone ──────────────────────────────────────────────────────────
  const summaryState =
    balanceOwed === 0 ? "full"
      : balanceOwed > 0 ? "partial"
        : "over";

  const portalContainerRef = React.useRef(null);

  return (
    <DialogContent className="max-w-full sm:max-w-[720px] lg:max-w-[860px] p-0 overflow-hidden max-h-dvh sm:max-h-[90vh] flex flex-col bg-background rounded-none sm:rounded-lg">
      <div ref={portalContainerRef} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3.5 sm:px-6 sm:py-5 border-b border-border flex items-start justify-between shrink-0 bg-muted/30">
        <div>
          <h2 className="text-[18px] font-bold text-foreground">Record Payment</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {rent.nepaliMonth} {rent.nepaliYear}
            {rent?.tenant?.name && (
              <span className="text-muted-foreground/60"> · {rent.tenant.name}</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">

        {/* ════ LEFT COLUMN — What you're paying ════ */}
        <div className="flex-none sm:flex-1 overflow-visible sm:overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 border-b sm:border-b-0 sm:border-r border-border">

          {/* ── Due Summary strip ──────────────────────────────────────────── */}
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <Label>Amount Due</Label>
            <div className={cn(
              "grid gap-2",
              (hasLateFee && totalElecDue > 0) ? "grid-cols-2 sm:grid-cols-4" :
              (hasLateFee || totalElecDue > 0) ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"
            )}>
              {/* Rent */}
              <div className="py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1">
                  Rent {tdsAmountPaisa > 0 ? "(net TDS)" : ""}
                </p>
                <p className="text-[20px] font-bold text-foreground leading-none">
                  RS {rentAmount.toLocaleString()}
                </p>
                {tdsAmountPaisa > 0 && (
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    TDS RS {(tdsAmountPaisa / 100).toLocaleString()} withheld
                  </p>
                )}
              </div>

              {/* CAM */}
              <div className="py-2 border-l border-border pl-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1">CAM</p>
                <p className="text-[20px] font-bold text-foreground leading-none">
                  RS {camAmount.toLocaleString()}
                </p>
              </div>

              {/* Electricity */}
              {totalElecDue > 0 && (
                <div className="py-2 border-l border-border pl-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1 flex items-center gap-1">
                    <Zap className="size-3" />
                    Electricity
                  </p>
                  <p className="text-[20px] font-bold text-foreground leading-none">
                    RS {totalElecDue.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {electricityRecords.length} reading{electricityRecords.length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {/* Late Fee */}
              {hasLateFee && (
                <div className="col-span-2 sm:col-span-1 py-2 pl-3 pr-2 border-l border-destructive/30 bg-destructive/5 rounded-r-md">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">Late Fee</p>
                    <span className="bg-destructive/10 text-destructive border border-destructive/20 rounded text-[9px] font-semibold px-1.5 py-px">
                      Penalty
                    </span>
                  </div>
                  <p className="text-[20px] font-bold text-destructive leading-none">
                    RS {lateFeeAmount.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">Full payment required</p>
                </div>
              )}
            </div>

            <div className="border-t border-border mt-3 pt-3 flex justify-between items-center">
              <p className="text-[12px] text-muted-foreground">Total Due</p>
              <p className="text-[17px] font-bold text-foreground">RS {grandTotalDue.toLocaleString()}</p>
            </div>

            {/* ── TDS Verification ───────────────────────────────────────────── */}
            {tdsAmountPaisa > 0 && (
              <div className={cn(
                "mt-4 p-3 rounded-md border",
                rent?.tdsPaidToGovernment
                  ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                  : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className={cn(
                        "text-[13px] font-semibold",
                        rent?.tdsPaidToGovernment ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                      )}>
                        TDS Payment to Government
                      </p>
                      {rent?.tdsPaidToGovernment && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <p className={cn(
                      "text-[11px] opacity-90",
                      rent?.tdsPaidToGovernment ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {rent?.tdsPaidToGovernment
                        ? `Verified on ${rent.tdsPaidDate ? new Date(rent.tdsPaidDate).toLocaleDateString() : "N/A"}`
                        : `Tenant must pay RS${(tdsAmountPaisa / 100).toLocaleString()} to government`}
                    </p>
                  </div>

                  {!rent?.tdsPaidToGovernment && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={tdsPaidToGovt}
                        onChange={(e) => setTdsPaidToGovt(e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-primary"
                      />
                      <span className="text-[12px] font-medium">Verified Paid</span>
                    </label>
                  )}
                </div>

                {tdsPaidToGovt && !rent?.tdsPaidToGovernment && (
                  <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Payment Date</Label>
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
                        <Label>Receipt / Reference <span className="font-normal">(optional)</span></Label>
                        <Input
                          placeholder="Receipt number or reference"
                          value={tdsNotes}
                          onChange={(e) => setTdsNotes(e.target.value)}
                          className="text-[13px]"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Upload TDS Receipt <span className="font-normal">(optional)</span></Label>
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
                        <p className="text-[10px] text-destructive mt-1">{tdsDocumentError}</p>
                      )}
                      {tdsDocument && !tdsDocumentError && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Selected: {tdsDocument.name} ({(tdsDocument.size / 1024).toFixed(1)} KB)
                        </p>
                      )}
                      {tdsUploadedPath && (
                        <p className="text-[10px] text-emerald-600 mt-1">Uploaded receipt attached successfully.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Unit Selector ──────────────────────────────────────────────── */}
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <Label>Units</Label>
              <Label className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium cursor-pointer">
                <Input
                  type="checkbox"
                  className="w-3.5 h-3.5 cursor-pointer accent-primary"
                  checked={allSelected}
                  onChange={(e) =>
                    setSelectedUnitIds(e.target.checked ? units.map((u) => u.id) : [])
                  }
                />
                Select all
              </Label>
            </div>

            <div className="flex flex-col gap-1.5">
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
                      "w-full text-left rounded-md border px-3 py-2.5 transition-all cursor-pointer",
                      selected
                        ? "border-primary/60 bg-primary/5"
                        : "border-border bg-background hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between py-2">
                      {/* LEFT: selection + identity */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "size-4 rounded-full border-2 flex items-center justify-center shrink-0 transition",
                            selected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40"
                          )}
                        >
                          {selected && (
                            <div className="size-1.5 rounded-full bg-primary-foreground" />
                          )}
                        </div>

                        <div className="truncate">
                          <p className="text-[13px] font-medium text-foreground truncate">
                            {unit.name}
                          </p>

                          {/* subtle metadata */}
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                            {unit.label && <span>{unit.label}</span>}

                            {unit.hasOutstanding && (
                              <span className="text-amber-600 font-medium">
                                • Outstanding
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT: financials */}
                      <div className="text-right">
                        {/* PRIMARY: net payable */}
                        <p className="text-[14px] font-semibold text-foreground">
                          RS {unit.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          net payable
                        </p>

                        {/* SECONDARY: breakdown */}
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5 space-y-[1px]">
                          <p>
                            Gross RS {unit.gross?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "-"}
                          </p>

                          {unit.tds > 0 && (
                            <p className="text-amber-600">
                              TDS RS {unit.tds.toLocaleString(undefined, { maximumFractionDigits: 0 })} withheld
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {!selectedUnits.length && (
              <p className="text-[11px] text-destructive mt-2">
                Select at least one unit to continue.
              </p>
            )}
          </div>

          {/* ── Allocation ─────────────────────────────────────────────────── */}
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <Label>Allocation</Label>

            {/* Tab toggle */}
            <div className="grid grid-cols-2 bg-background border border-border rounded-md p-0.5 mb-4">
              {[
                { value: "auto", label: "Quick Payment" },
                { value: "manual", label: "Custom Allocation" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setAllocationMode(tab.value)}
                  className={cn(
                    "rounded-sm py-1.5 text-[12px] cursor-pointer border-0 transition-all",
                    allocationMode === tab.value
                      ? "bg-card text-primary font-semibold shadow-sm"
                      : "bg-transparent text-muted-foreground font-normal hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Auto tab ──────────────────────────────────────────────────── */}
            {allocationMode === "auto" && (
              <div className="flex flex-col gap-3">
                <div className="space-y-1.5">
                  <Label>Amount to Pay (Rs)</Label>
                  <Input
                    type="number"
                    placeholder={`Full due: RS ${grandTotalDue.toLocaleString()}`}
                    value={formik.values?.amount || ""}
                    onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0, rent, electricityRecords)}
                    onBlur={(e) => { if (!e.target.value) handleAmountChange(grandTotalDue, rent, electricityRecords); }}
                    className="text-base font-semibold"
                  />
                </div>

                <div className="border border-border rounded-md overflow-hidden bg-background">
                  {/* Rent row */}
                  <div className="px-3.5 py-2.5 flex justify-between items-center">
                    <div>
                      <p className="text-[12px] font-semibold text-foreground/80">Rent</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-px">Due RS {rentAmount.toLocaleString()}</p>
                    </div>
                    <p className={cn("text-[13px] font-bold", rentAllocation > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                      RS {rentAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>

                  {camAmount > 0 && (
                    <div className="px-3.5 py-2.5 flex justify-between items-center border-t border-border">
                      <div>
                        <p className="text-[12px] font-semibold text-foreground/80">CAM</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-px">Due RS {camAmount.toLocaleString()}</p>
                      </div>
                      <p className={cn("text-[13px] font-bold", camAllocation > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                        RS {camAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  )}

                  {/* Electricity rows — one per reading */}
                  {totalElecDue > 0 && electricityRecords.map((elec) => {
                    const due = elec.remainingAmount ?? Math.max(0, (elec.totalAmount || 0) - (elec.paidAmount || 0));
                    if (due <= 0) return null;
                    const unitName = elec.unit?.name || elec.subMeter?.name || "Unit";
                    const alloc = electricityAllocations.find((a) => a.electricityId === elec._id);
                    return (
                      <div key={elec._id} className="px-3.5 py-2.5 flex justify-between items-center border-t border-border">
                        <div>
                          <p className="text-[12px] font-semibold text-foreground/80 flex items-center gap-1">
                            <Zap className="size-3 text-amber-500" />{unitName}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-px">Electricity · Due RS {due.toLocaleString()}</p>
                        </div>
                        <p className={cn("text-[13px] font-bold", (alloc?.amount || 0) > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                          RS {(alloc?.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    );
                  })}

                  {hasLateFee && (
                    <div className="px-3.5 py-2.5 flex justify-between items-center border-t border-border bg-destructive/5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-semibold text-destructive">Late Fee</p>
                          <span className="bg-destructive/10 text-destructive border border-destructive/20 rounded text-[9px] font-semibold px-1.5 py-px">
                            Separate
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 mt-px">
                          Due RS {lateFeeAmount.toLocaleString()} · full only
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[13px] font-bold", (lateFeeAllocation || 0) > 0 ? "text-destructive" : "text-muted-foreground/40")}>
                          RS {(lateFeeAllocation || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        {(lateFeeAllocation || 0) === 0 && paymentAmount > 0 && (
                          <p className="text-[10px] text-muted-foreground/70">
                            +RS {lateFeeAmount.toLocaleString()} to cover
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Per-unit breakdown */}
                  {autoUnitAllocations.length > 0 && (
                    <div className="px-3.5 py-2.5 border-t border-border">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                        Unit breakdown
                      </p>
                      <div className="flex flex-col gap-1">
                        {autoUnitAllocations.map((alloc) => {
                          const unit = units.find((u) => u.id === alloc.unitId);
                          return (
                            <div key={alloc.unitId} className="flex justify-between items-center">
                              <span className="text-[11px] text-muted-foreground">{unit?.name || alloc.unitId}</span>
                              <span className="text-[11px] font-semibold text-foreground/80">
                                RS {alloc.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="px-3.5 py-2.5 flex justify-between items-center border-t border-border">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Total Allocated
                    </p>
                    <p className="text-[13px] font-bold text-foreground">
                      RS {totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Manual tab ────────────────────────────────────────────────── */}
            {allocationMode === "manual" && (
              <div className="flex flex-col gap-3">
                <div className="space-y-1.5">
                  <Label>Total Amount to Pay (Rs)</Label>
                  <Input
                    type="number"
                    placeholder={`Full due: RS ${grandTotalDue.toLocaleString()}`}
                    value={formik.values?.amount || ""}
                    onChange={(e) => formik.setFieldValue("amount", parseFloat(e.target.value) || 0)}
                    className="text-base font-semibold"
                  />
                </div>

                <div className="border border-border rounded-md overflow-hidden bg-background">
                  {/* Rent */}
                  <div className="px-3.5 py-2.5 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-foreground/80">Rent</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-px">Due RS {rentAmount.toLocaleString()}</p>
                    </div>
                    <Input
                      type="number"
                      placeholder="0"
                      value={rentAllocation || ""}
                      onChange={(e) => setRentAllocation(parseFloat(e.target.value) || 0)}
                      className="w-[130px] text-right text-[13px]"
                    />
                  </div>

                  {/* CAM */}
                  <div className="px-3.5 py-2.5 flex items-center gap-3 border-t border-border">
                    <div className="flex-1">
                      <p className="text-[12px] font-semibold text-foreground/80">CAM</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-px">Due RS {camAmount.toLocaleString()}</p>
                    </div>
                    <Input
                      type="number"
                      placeholder="0"
                      value={camAllocation || ""}
                      onChange={(e) => setCamAllocation(parseFloat(e.target.value) || 0)}
                      className="w-[130px] text-right text-[13px]"
                    />
                  </div>

                  {/* Electricity inputs — manual mode */}
                  {totalElecDue > 0 && electricityRecords.map((elec) => {
                    const due = elec.remainingAmount ?? Math.max(0, (elec.totalAmount || 0) - (elec.paidAmount || 0));
                    if (due <= 0) return null;
                    const unitName = elec.unit?.name || elec.subMeter?.name || "Unit";
                    const currentAlloc = electricityAllocations.find((a) => a.electricityId === elec._id);
                    const isOver = (currentAlloc?.amount || 0) > due + 0.01;
                    return (
                      <div key={elec._id} className="px-3.5 py-2.5 flex items-center gap-3 border-t border-border">
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold text-foreground/80 flex items-center gap-1">
                            <Zap className="size-3 text-amber-500" />{unitName}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-px">Electricity · Due RS {due.toLocaleString()}</p>
                          {isOver && (
                            <p className="text-[10px] text-destructive mt-0.5 font-medium">
                              Cannot exceed RS {due.toLocaleString()}
                            </p>
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
                          className={cn("w-[130px] text-right text-[13px]", isOver && "border-destructive")}
                        />
                      </div>
                    );
                  })}

                  {/* Late Fee */}
                  {hasLateFee && (
                    <div className="px-3.5 py-2.5 flex items-center gap-3 border-t border-border bg-destructive/5">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-semibold text-destructive">Late Fee</p>
                          <span className="bg-destructive/10 text-destructive border border-destructive/20 rounded text-[9px] font-semibold px-1.5 py-px">
                            All or nothing
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 mt-px">Due RS {lateFeeAmount.toLocaleString()}</p>
                        {isPartialLateFee && (
                          <p className="text-[10px] text-destructive mt-0.5 font-medium">
                            Enter RS {lateFeeAmount.toLocaleString()} or 0
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Input
                          type="number"
                          placeholder="0"
                          value={lateFeeAllocation || ""}
                          onChange={(e) => setLateFeeAllocation(parseFloat(e.target.value) || 0)}
                          className={cn("w-[130px] text-right text-[13px]", isPartialLateFee && "border-destructive")}
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

                  {/* Running total */}
                  <div className="px-3.5 py-2.5 flex justify-between items-center border-t border-border">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Total Allocated
                      </p>
                      {totalAllocated !== (formik.values?.amount || 0) && (formik.values?.amount || 0) > 0 && (
                        <p className={cn("text-[10px] mt-px", isOverAllocated ? "text-destructive" : "text-amber-600")}>
                          {isOverAllocated
                            ? `RS ${(totalAllocated - (formik.values?.amount || 0)).toLocaleString()} over`
                            : `RS ${((formik.values?.amount || 0) - totalAllocated).toLocaleString()} unallocated`}
                        </p>
                      )}
                    </div>
                    <p className={cn("text-[13px] font-bold", isOverAllocated ? "text-destructive" : "text-foreground")}>
                      RS {totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>

                {/* Per-unit allocations */}
                {rent?.useUnitBreakdown && selectedUnits.length > 0 && (
                  <div className="border border-border rounded-md p-3.5 bg-background">
                    <div className="flex justify-between items-center mb-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
                        Per-unit rent
                      </p>
                      <p className={cn("text-[10px] font-medium", unitAllocationMismatch ? "text-destructive" : "text-muted-foreground")}>
                        {unitAllocationMismatch
                          ? `Total RS ${manualUnitRentTotal.toFixed(0)} ≠ rent RS ${rentAllocation.toFixed(0)}`
                          : `Must sum to Rs${rentAllocation.toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {selectedUnits.map((unit) => (
                        <div key={unit.id} className="flex items-center gap-2.5">
                          <div className="flex-1">
                            <p className="text-[12px] font-medium text-foreground/80">{unit.name}</p>
                            <p className="text-[10px] text-muted-foreground/70">
                              Remaining RS {unit.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <Input
                            type="number"
                            className="w-[130px] text-right text-[12px]"
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
          </div>
        </div>

        {/* ════ RIGHT COLUMN — How you're paying + sticky submit ════ */}
        <div className="w-full lg:w-[320px] shrink-0 flex flex-col bg-muted/20 overflow-visible sm:overflow-y-auto">

          {/* Scrollable form fields */}
          <div className="flex-1 p-4 sm:p-5 flex flex-col gap-4 overflow-visible sm:overflow-y-auto">
            <Label className="font-bold">Payment Details</Label>

            {/* Method */}
            <div className="space-y-1.5">
              <Label className="font-bold">Payment Method</Label>
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

            {/* Bank Account */}
            {needsBankAccount && (
              <div className="space-y-1.5">
                <Label>Deposit To *</Label>
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
                {needsBankAccount && !formik.values?.bankAccountCode && (
                  <p className="text-[11px] text-destructive">Select a bank account to continue.</p>
                )}
              </div>
            )}

            {/* Payment Date */}
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
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
              <Label>
                Txn Reference <span className="font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g., CHQ-12345"
                value={formik.values?.transactionRef || ""}
                onChange={(e) => formik.setFieldValue("transactionRef", e.target.value)}
                className="text-[12px]"
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label>
                Note <span className="font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g., Payment for Unit A"
                value={formik.values?.note || ""}
                onChange={(e) => formik.setFieldValue("note", e.target.value)}
                className="text-[12px]"
              />
            </div>
          </div>

          {/* ── Sticky footer: totals + errors + buttons ──────────────────── */}
          <div className="border-t border-border px-4 py-3 sm:px-5 sm:py-4 bg-muted/20 shrink-0 sticky bottom-0 sm:static z-10">

            {/* Summary totals */}
            <div className={cn(
              "rounded-md p-3 mb-3 border",
              summaryState === "full"
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800"
                : summaryState === "over"
                  ? "bg-destructive/10 border-destructive/20"
                  : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
            )}>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[
                  { label: "Due", value: `RS${grandTotalDue.toLocaleString()}` },
                  { label: "Allocated", value: `RS${totalAllocated.toLocaleString()}` },
                  { label: "Remaining", value: `RS ${balanceOwed.toLocaleString()}` },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      {item.label}
                    </p>
                    <p className="text-[13px] font-bold text-foreground mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              <p className={cn(
                "text-[10px] font-medium text-center",
                summaryState === "full" ? "text-emerald-600"
                  : summaryState === "over" ? "text-destructive"
                    : "text-amber-600"
              )}>
                {balanceOwed < 0
                  ? "Allocation exceeds total due."
                  : balanceOwed === 0
                    ? " Fully allocated — clears selected dues."
                    : "Partial payment — balance stays outstanding."}
              </p>
            </div>

            {/* Validation errors */}
            {(!selectedUnits.length || isOverAllocated || isElecOverAllocated || isPartialLateFee || unitAllocationMismatch ||
              (needsBankAccount && !formik.values?.bankAccountCode)) && (
                <div className="bg-destructive/10 border border-destructive/20 rounded flex flex-col gap-0.5 px-2.5 py-2 mb-2.5">
                  {!selectedUnits.length && (
                    <p className="text-[11px] text-destructive">Select at least one unit.</p>
                  )}
                  {isOverAllocated && (
                    <p className="text-[11px] text-destructive">Allocation exceeds payment amount.</p>
                  )}
                  {isElecOverAllocated && (
                    <p className="text-[11px] text-destructive">Electricity allocation exceeds bill amount for one or more units.</p>
                  )}
                  {isPartialLateFee && (
                    <p className="text-[11px] text-destructive">
                      Late fee must be RS {lateFeeAmount.toLocaleString()} or 0.
                    </p>
                  )}
                  {unitAllocationMismatch && (
                    <p className="text-[11px] text-destructive">
                      Unit allocations must sum to RS {rentAllocation.toFixed(2)}.
                    </p>
                  )}
                  {needsBankAccount && !formik.values?.bankAccountCode && (
                    <p className="text-[11px] text-destructive">Select a bank account.</p>
                  )}
                </div>
              )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-[13px]"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSubmitDisabled}
                className="flex-[2] text-[13px]"
                onClick={async (e) => {
                  e.preventDefault();
                  const payload = buildPayload();
                  await formik.setValues({ ...formik.values, ...payload });

                  try {
                    const api = (await import("../../../plugins/axios")).default;


                    if (
                      tdsPaidToGovt &&
                      !rent?.tdsPaidToGovernment &&
                      tdsDocument &&
                      !tdsUploadedPath
                    ) {
                      setTdsUploading(true);
                      const uploadForm = new FormData();
                      uploadForm.append("tdsDocument", tdsDocument);
                      const uploadRes = await api.post(
                        `/api/rent/${rent._id}/tds/upload-document`,
                        uploadForm,
                      );
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
                        const response = await api.patch(
                          `/api/rent/${rent._id}/tds/mark-paid`,
                          tdsPayload,
                        );
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
                    const toast = (await import("sonner")).toast;
                    toast.error(error?.response?.data?.message || error?.message || "Payment failed. Please try again.");
                  } finally {
                    setTdsUploading(false);
                  }
                }}
              >
                {tdsUploading ? "Uploading TDS..." : "Submit Payment"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  );
};
