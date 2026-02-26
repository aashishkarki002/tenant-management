/**
 * PaymentDialog.jsx
 *
 * Updated to support late fee allocation as a separate revenue bucket.
 *
 * Late fee changes:
 *   - Due summary shows Rent / CAM / Late Fee as three distinct line items
 *   - Auto mode: amount fills rent → CAM → late fee (full-or-nothing on late fee)
 *   - Manual mode: third input for late fee allocation; full-or-nothing enforced in UI
 *   - buildPayload() emits allocations.lateFee = { rentId, amount } when > 0
 *   - Backend routes lateFee allocation to LATE_FEE_PAYMENT_RECEIVED journal
 *     and writes to latePaidAmountPaisa, NOT paidAmountPaisa
 *   - Validation: partial late fee payment blocked (must be 0 or full remaining)
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DualCalendarTailwind from "../../components/dualDate";
import { getPaymentAmounts, normalizeStatus } from "../utils/paymentUtil";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveId(val) {
  if (!val) return null;
  if (val._id) return val._id.toString();
  return val.toString();
}

/**
 * Proportional allocation — mirrors allocatePaymentProportionally on the backend.
 * Allocates against rent principal only (not CAM or late fee).
 *
 * FIX: remaining = (rentAmountPaisa - tdsAmountPaisa) - paidAmountPaisa
 */
function proportionalAllocate(unitBreakdown, totalRupees) {
  const totalEffectiveRemainingPaisa = unitBreakdown.reduce((sum, u) => {
    const effective = (u.rentAmountPaisa || 0)
    return sum + Math.max(0, effective - (u.paidAmountPaisa || 0));
  }, 0);

  if (totalEffectiveRemainingPaisa === 0) return [];

  const totalPaymentPaisa = Math.round(totalRupees * 100);
  let remaining = totalPaymentPaisa;
  const unpaidUnits = unitBreakdown.filter((u) => {
    const eff = (u.rentAmountPaisa || 0)
    return eff - (u.paidAmountPaisa || 0) > 0;
  });
  const result = [];

  unpaidUnits.forEach((u, idx) => {
    const unitEffectivePaisa = (u.rentAmountPaisa || 0)
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

// ─── Component ────────────────────────────────────────────────────────────────

export const PaymentDialog = ({
  rent,
  cams,
  bankAccounts,
  formik,
  allocationMode,
  setAllocationMode,
  rentAllocation,
  setRentAllocation,
  camAllocation,
  setCamAllocation,
  lateFeeAllocation,
  setLateFeeAllocation,
  selectedBankAccountId,
  setSelectedBankAccountId,
  handleAmountChange,
  onClose,
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
    const hasBreakdown =
      rent?.useUnitBreakdown &&
      Array.isArray(rent.unitBreakdown) &&
      rent.unitBreakdown.length > 0;

    if (hasBreakdown) {
      return rent.unitBreakdown.map((ub) => {
        const unit = ub.unit;
        const id = resolveId(unit);

        const effectivePaisa = ub.rentAmountPaisa || 0;
        const rentDue = effectivePaisa / 100;
        const paidSoFar = (ub.paidAmountPaisa || 0) / 100;
        const remaining = rentDue - paidSoFar;

        return {
          id,
          name: unit?.name || id || "Unit",
          label: unit?.block?.name
            ? `${unit.block.name} – ${unit.innerBlock?.name || ""}`.trim()
            : "",
          rentDue,
          paidSoFar,
          remaining,
          hasOutstanding: remaining > 0,
          _breakdownRef: ub,
        };
      });
    }

    // Single-unit fallback — use effective rent from getPaymentAmounts()
    const paidSoFar = (rent?.paidAmountPaisa || 0) / 100;
    return [
      {
        id: resolveId(rent?.units?.[0]) || rent?._id || "primary",
        name: rent?.units?.[0]?.name || "Primary Unit",
        label: `${rent?.innerBlock?.name || ""} ${rent?.block?.name || ""}`.trim(),
        rentDue: rentAmount,
        paidSoFar,
        remaining: rentAmount - paidSoFar,
        hasOutstanding: rentAmount - paidSoFar > 0,
        _breakdownRef: null,
      },
    ];
  }, [rent, rentAmount]);

  // ── Selected units ────────────────────────────────────────────────────────
  const [selectedUnitIds, setSelectedUnitIds] = React.useState(
    units.filter((u) => u.hasOutstanding).map((u) => u.id),
  );

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

  // ── Derived amounts ───────────────────────────────────────────────────────
  const paymentAmount = formik.values?.amount || 0;
  const totalAllocated = rentAllocation + camAllocation + (lateFeeAllocation || 0);
  const balanceOwed = totalDue - totalAllocated;
  const isOverAllocated = totalAllocated > paymentAmount && paymentAmount > 0;

  // Partial late fee guard: if lateFeeAllocation is set it must equal the full
  // remaining late fee (backend enforces this — show error in UI preemptively)
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
      paymentMethod: formik.values?.paymentMethod,
      paymentStatus: "paid",
      note: formik.values?.note || "",
      bankAccountId: formik.values?.bankAccountId || null,
      bankAccountCode: formik.values?.bankAccountCode || null,
      transactionRef: formik.values?.transactionRef || null,
      allocations: {},
    };

    // Rent allocation
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

    // CAM allocation
    if (camAllocation > 0 && matchingCam?._id) {
      payload.allocations.cam = { camId: matchingCam._id, paidAmount: camAllocation };
    }

    // Late fee allocation — separate revenue bucket (LATE_FEE_PAYMENT_RECEIVED journal)
    // Backend: writes to latePaidAmountPaisa, NOT paidAmountPaisa
    if ((lateFeeAllocation || 0) > 0) {
      payload.allocations.lateFee = {
        rentId: rent._id,
        amount: lateFeeAllocation,
      };
    }

    return payload;
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const needsBankAccount =
    formik.values?.paymentMethod === "bank_transfer" ||
    formik.values?.paymentMethod === "cheque";

  const isSubmitDisabled =
    !selectedUnits.length ||
    isOverAllocated ||
    isPartialLateFee ||
    !paymentAmount ||
    !formik.values?.paymentMethod ||
    !formik.values?.paymentDate ||
    (needsBankAccount && !formik.values?.bankAccountCode) ||
    unitAllocationMismatch;

  // ── Summary tone ──────────────────────────────────────────────────────────
  const summaryTone =
    balanceOwed === 0
      ? { container: "border-emerald-200 bg-emerald-50", accent: "text-emerald-700" }
      : balanceOwed > 0
        ? { container: "border-amber-200 bg-amber-50", accent: "text-amber-700" }
        : { container: "border-rose-200 bg-rose-50", accent: "text-rose-700" };

  const portalContainerRef = React.useRef(null);

  return (
    <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto bg-slate-50">
      <div ref={portalContainerRef} />
      <DialogHeader className="pb-4">
        <DialogTitle className="text-2xl font-semibold text-slate-900">
          Record Payment
        </DialogTitle>
        <p className="text-sm text-slate-500 mt-1">
          Billing Period: {rent.nepaliMonth} {rent.nepaliYear}
        </p>
      </DialogHeader>

      {/* ── Due summary ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
        <div className={`grid gap-4 ${hasLateFee ? "grid-cols-3" : "grid-cols-2"}`}>
          {/* Rent */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wide">
              Rent Due (net of TDS)
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              ₹{rentAmount.toLocaleString()}
            </p>
            {tdsAmountPaisa > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                TDS: ₹{(tdsAmountPaisa / 100).toLocaleString()} withheld
              </p>
            )}
          </div>

          {/* CAM */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wide">
              CAM Due
            </p>
            <p className="text-2xl font-semibold text-slate-900">
              ₹{camAmount.toLocaleString()}
            </p>
          </div>

          {/* Late fee — only shown when charged */}
          {hasLateFee && (
            <div>
              <p className="text-xs font-semibold text-rose-500 uppercase mb-2 tracking-wide flex items-center gap-1.5">
                Late Fee
                <Badge className="text-[10px] px-1.5 py-0 bg-rose-100 text-rose-700 border border-rose-200">
                  Penalty
                </Badge>
              </p>
              <p className="text-2xl font-semibold text-rose-700">
                ₹{lateFeeAmount.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Separate revenue · full payment required
              </p>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-slate-900">Total Due</p>
          <p className="text-3xl font-semibold text-slate-900">
            ₹{totalDue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ── 1️⃣ Select Units ─────────────────────────────────────────────── */}
      <section className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Select Units</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose one or more units to include in this payment.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300 accent-slate-900 cursor-pointer"
              checked={allSelected}
              onChange={(e) =>
                setSelectedUnitIds(e.target.checked ? units.map((u) => u.id) : [])
              }
            />
            Select all units
          </label>
        </div>

        <div className="space-y-3">
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
                className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 ${selected
                  ? "border-slate-900/80 bg-slate-900/[0.02]"
                  : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center w-5 h-5 rounded-full border-2 ${selected
                        ? "border-slate-900 bg-slate-900"
                        : "border-slate-300 bg-white"
                        }`}
                    >
                      {selected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{unit.name}</p>
                      {unit.label && (
                        <p className="text-xs text-slate-500 mt-0.5">{unit.label}</p>
                      )}
                      {unit.hasOutstanding && (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                          Outstanding
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Remaining
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">
                      ₹{unit.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Rent Due (net)
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      ₹{unit.rentDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Paid So Far
                    </p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      ₹{unit.paidSoFar.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!selectedUnits.length && (
          <p className="text-xs text-slate-500">Select at least one unit to continue.</p>
        )}
      </section>

      {/* ── 2️⃣ Allocation Mode ──────────────────────────────────────────── */}
      <section className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Allocation Mode</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Quick Payment auto-distributes proportionally. Custom lets you specify
            exact amounts per unit.
          </p>
        </div>

        <Tabs value={allocationMode} onValueChange={setAllocationMode} className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-0.5 rounded-full">
            <TabsTrigger
              value="auto"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-xs font-medium"
            >
              Quick Payment
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-xs font-medium"
            >
              Custom Allocation
            </TabsTrigger>
          </TabsList>

          {/* Quick Payment */}
          <TabsContent value="auto" className="space-y-4 pt-2">
            {/* Amount input */}
            <div className="space-y-2">
              <label htmlFor="amount-quick" className="text-sm font-semibold text-slate-900">
                Amount to Pay (Rs)
              </label>
              <Input
                id="amount-quick"
                type="number"
                placeholder={`Full due: ₹${totalDue.toLocaleString()}`}
                value={formik.values?.amount || ""}
                onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0, rent)}
                onBlur={(e) => { if (!e.target.value) handleAmountChange(totalDue, rent); }}
                className="text-lg"
              />
            </div>

            {/* Auto-computed allocation breakdown — always visible once amount > 0 */}
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Rent</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Due: ₹{rentAmount.toLocaleString()}
                  </p>
                </div>
                <p className={`text-sm font-bold ${rentAllocation > 0 ? "text-slate-900" : "text-slate-300"}`}>
                  ₹{rentAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>

              {camAmount > 0 && (
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">CAM</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Due: ₹{camAmount.toLocaleString()}
                    </p>
                  </div>
                  <p className={`text-sm font-bold ${camAllocation > 0 ? "text-slate-900" : "text-slate-300"}`}>
                    ₹{camAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              )}

              {hasLateFee && (
                <div className="px-4 py-2.5 flex items-center justify-between bg-rose-50/60">
                  <div>
                    <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                      Late Fee
                      <span className="text-[9px] font-medium bg-rose-100 text-rose-600 border border-rose-200 rounded-full px-1.5 py-px">
                        Separate revenue
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Due: ₹{lateFeeAmount.toLocaleString()} · full payment only
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${(lateFeeAllocation || 0) > 0 ? "text-rose-700" : "text-slate-300"}`}>
                      ₹{(lateFeeAllocation || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    {(lateFeeAllocation || 0) === 0 && paymentAmount > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Add ₹{(lateFeeAmount).toLocaleString()} to cover
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Per-unit breakdown when multi-unit */}
              {autoUnitAllocations.length > 0 && (
                <div className="px-4 py-3 bg-slate-50/60">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Unit breakdown
                  </p>
                  <div className="space-y-1.5">
                    {autoUnitAllocations.map((alloc) => {
                      const unit = units.find((u) => u.id === alloc.unitId);
                      return (
                        <div key={alloc.unitId} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{unit?.name || alloc.unitId}</span>
                          <span className="font-semibold text-slate-800">
                            ₹{alloc.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Total line */}
              <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total Allocated</p>
                <p className="text-sm font-bold text-slate-900">
                  ₹{totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Custom Allocation */}
          <TabsContent value="manual" className="space-y-4 pt-2">
            {/* Total amount */}
            <div className="space-y-2">
              <label htmlFor="amount-manual" className="text-sm font-semibold text-slate-900">
                Total Amount to Pay (Rs)
              </label>
              <Input
                id="amount-manual"
                type="number"
                placeholder="Enter total payment amount"
                value={formik.values?.amount || ""}
                onChange={(e) => formik.setFieldValue("amount", parseFloat(e.target.value) || 0)}
                className="text-lg"
              />
            </div>

            {/* Allocation inputs — each pre-filled with their due amount */}
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">

              {/* Rent */}
              <div className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-700">Rent</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Total due: ₹{rentAmount.toLocaleString()}
                  </p>
                </div>
                <div className="w-36">
                  <Input
                    id="rent-allocation"
                    type="number"
                    placeholder="0"
                    value={rentAllocation || ""}
                    onChange={(e) => setRentAllocation(parseFloat(e.target.value) || 0)}
                    className="text-right text-sm"
                  />
                </div>
              </div>

              {/* CAM */}
              <div className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-700">CAM</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Total due: ₹{camAmount.toLocaleString()}
                  </p>
                </div>
                <div className="w-36">
                  <Input
                    id="cam-allocation"
                    type="number"
                    placeholder="0"
                    value={camAllocation || ""}
                    onChange={(e) => setCamAllocation(parseFloat(e.target.value) || 0)}
                    className="text-right text-sm"
                  />
                </div>
              </div>

              {/* Late Fee — only rendered when a fee has been charged */}
              {hasLateFee && (
                <div className="px-4 py-3 flex items-center gap-4 bg-rose-50/40">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                      Late Fee
                      <span className="text-[9px] font-medium bg-rose-100 text-rose-600 border border-rose-200 rounded-full px-1.5 py-px">
                        All or nothing
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Total due: ₹{lateFeeAmount.toLocaleString()} · must pay full amount or leave 0
                    </p>
                    {isPartialLateFee && (
                      <p className="text-[11px] text-rose-600 mt-0.5 font-medium">
                        Enter ₹{lateFeeAmount.toLocaleString()} or 0
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <div className="w-36">
                      <Input
                        id="late-fee-allocation"
                        type="number"
                        placeholder="0"
                        value={lateFeeAllocation || ""}
                        onChange={(e) => setLateFeeAllocation(parseFloat(e.target.value) || 0)}
                        className={`text-right text-sm ${isPartialLateFee ? "border-rose-400 focus-visible:ring-rose-400" : ""}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setLateFeeAllocation(lateFeeAmount)}
                      className="text-[11px] text-rose-600 underline underline-offset-2 hover:text-rose-800"
                    >
                      Fill ₹{lateFeeAmount.toLocaleString()}
                    </button>
                  </div>
                </div>
              )}

              {/* Running total */}
              <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total Allocated</p>
                  {totalAllocated !== (formik.values?.amount || 0) && (formik.values?.amount || 0) > 0 && (
                    <p className={`text-[11px] mt-0.5 ${isOverAllocated ? "text-rose-600" : "text-amber-600"}`}>
                      {isOverAllocated
                        ? `₹${(totalAllocated - (formik.values?.amount || 0)).toLocaleString()} over`
                        : `₹${((formik.values?.amount || 0) - totalAllocated).toLocaleString()} unallocated`}
                    </p>
                  )}
                </div>
                <p className={`text-sm font-bold ${isOverAllocated ? "text-rose-700" : "text-slate-900"}`}>
                  ₹{totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {/* Per-unit rent allocation (multi-unit only) */}
            {rent?.useUnitBreakdown && selectedUnits.length > 0 && (
              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                    Per-unit rent allocation
                  </p>
                  <p className={`text-xs font-medium ${unitAllocationMismatch ? "text-rose-600" : "text-slate-500"}`}>
                    {unitAllocationMismatch
                      ? `Total ₹${manualUnitRentTotal.toFixed(0)} ≠ rent ₹${rentAllocation.toFixed(0)}`
                      : `Must sum to ₹${rentAllocation.toLocaleString()}`}
                  </p>
                </div>
                <div className="space-y-3">
                  {selectedUnits.map((unit) => (
                    <div key={unit.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-900">{unit.name}</p>
                        <p className="text-[11px] text-slate-500">
                          Remaining ₹{unit.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <Input
                        type="number"
                        className="w-36 text-sm text-right"
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
                {unitAllocationMismatch && (
                  <p className="text-xs text-rose-600">
                    Unit allocations must exactly match the rent allocation amount.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* ── 3️⃣ Payment Details ──────────────────────────────────────────── */}
      <section className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-900">Payment Details</p>

        {/* Method */}
        <div className="space-y-2">
          <label htmlFor="payment-method" className="text-sm font-medium text-slate-900">
            Payment Method
          </label>
          <Select
            value={formik.values?.paymentMethod || ""}
            onValueChange={(v) => formik.setFieldValue("paymentMethod", v)}
          >
            <SelectTrigger id="payment-method">
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bank account picker — shown for bank_transfer AND cheque */}
        {(formik.values?.paymentMethod === "bank_transfer" ||
          formik.values?.paymentMethod === "cheque") && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-900">
                Deposit To *
              </label>
              <div className="grid gap-3">
                {bankAccounts.map((bank) => (
                  <button
                    key={bank._id}
                    type="button"
                    onClick={() => {
                      setSelectedBankAccountId(bank._id);
                      formik.setFieldValue("bankAccountId", bank._id);
                      // FIX: set bankAccountCode so journal builder can route to
                      // the correct ledger account (e.g. "1010-NABIL")
                      formik.setFieldValue("bankAccountCode", bank.accountCode || "");
                    }}
                    className={`w-full text-left p-4 border-2 rounded-lg cursor-pointer transition-colors ${selectedBankAccountId === bank._id
                      ? "border-slate-900 bg-slate-900/[0.03]"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{bank.bankName}</p>
                        <p className="text-xs text-slate-500">
                          **** **** {bank.accountNumber?.slice(-4) || "****"}
                        </p>
                        {bank.accountCode && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            {bank.accountCode}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                          Balance
                        </p>
                        <p className="font-semibold text-slate-900 text-sm">
                          ₹{bank.balance?.toLocaleString() || "0"}
                        </p>
                      </div>
                      {selectedBankAccountId === bank._id && (
                        <div className="ml-3 text-slate-900">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {needsBankAccount && !formik.values?.bankAccountCode && (
                <p className="text-xs text-rose-600">Select a bank account to continue.</p>
              )}
            </div>
          )}

        {/* Payment Date */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-900">Payment Date</label>
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
        <div className="space-y-2">
          <label htmlFor="transaction-ref" className="text-sm font-medium text-slate-900">
            Transaction Reference{" "}
            <span className="text-slate-500 font-normal">(Optional)</span>
          </label>
          <Input
            id="transaction-ref"
            placeholder="e.g., CHQ-12345 or Bank Ref ID"
            value={formik.values?.transactionRef || ""}
            onChange={(e) => formik.setFieldValue("transactionRef", e.target.value)}
          />
        </div>

        {/* Note */}
        <div className="space-y-2">
          <label htmlFor="note" className="text-sm font-medium text-slate-900">
            Note{" "}
            <span className="text-slate-500 font-normal">(Optional)</span>
          </label>
          <Input
            id="note"
            placeholder="e.g., Payment for Unit A and Unit B"
            value={formik.values?.note || ""}
            onChange={(e) => formik.setFieldValue("note", e.target.value)}
          />
        </div>
      </section>

      {/* ── 4️⃣ Final Summary ────────────────────────────────────────────── */}
      <section className={`mt-6 mb-2 rounded-xl border px-5 py-4 ${summaryTone.container}`}>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Final Summary
          </p>

          {/* Allocation breakdown */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Rent</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                ₹{rentAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">CAM</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                ₹{camAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className={`rounded-lg px-3 py-2 ${(lateFeeAllocation || 0) > 0 ? "bg-rose-50/80" : "bg-white/60"}`}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Late Fee</p>
              <p className={`mt-0.5 font-semibold ${(lateFeeAllocation || 0) > 0 ? "text-rose-700" : "text-slate-400"}`}>
                ₹{(lateFeeAllocation || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-4 items-center justify-between">
            <p className={`text-xs font-medium ${summaryTone.accent}`}>
              {balanceOwed < 0
                ? "Allocation exceeds total due. Reduce the amount or allocations."
                : balanceOwed === 0
                  ? "Fully allocated. This payment clears the selected dues."
                  : "Partially allocated. Remaining balance will stay outstanding."}
            </p>
            <div className="grid grid-cols-3 gap-4 text-right min-w-[260px]">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">Total Due</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  ₹{totalDue.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">Allocated</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  ₹{totalAllocated.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">Remaining</p>
                <p className={`mt-1 text-base font-semibold ${summaryTone.accent}`}>
                  ₹{balanceOwed.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DialogFooter className="mt-2 border-t border-slate-200 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {(!selectedUnits.length || isOverAllocated || isPartialLateFee || unitAllocationMismatch ||
          (needsBankAccount && !formik.values?.bankAccountCode)) && (
            <div className="text-xs text-rose-600">
              {!selectedUnits.length && <p>Select at least one unit before submitting.</p>}
              {isOverAllocated && <p>Allocation total cannot exceed the payment amount.</p>}
              {isPartialLateFee && (
                <p>Late fee must be paid in full (₹{lateFeeAmount.toLocaleString()}) or not at all.</p>
              )}
              {unitAllocationMismatch && (
                <p>Per-unit rent allocations must sum to ₹{rentAllocation.toFixed(2)}.</p>
              )}
              {needsBankAccount && !formik.values?.bankAccountCode && (
                <p>Select a bank account to route the journal entry.</p>
              )}
            </div>
          )}

        <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitDisabled}
            onClick={async (e) => {
              e.preventDefault();
              const payload = buildPayload();
              await formik.setValues({ ...formik.values, ...payload });
              await formik.handleSubmit();
              if (formik.isValid) onClose();
            }}
          >
            Submit Payment
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
};