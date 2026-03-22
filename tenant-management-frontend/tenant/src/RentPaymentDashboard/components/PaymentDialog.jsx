/**
 * PaymentDialog.jsx
 *
 * REDESIGN: Two-column split layout (desktop) / single-column stacked layout (mobile).
 *   Desktop (≥768px):
 *     Left  (scrollable) — What you're paying: Due summary, unit picker, allocation.
 *     Right (fixed)      — How you're paying:  Method, bank, date, ref/note.
 *     Right footer       — Always-visible totals + Submit. No scrolling required.
 *   Mobile (<768px):
 *     Single scrollable column — left content stacks above right content.
 *     Sticky footer            — totals + Submit pinned to viewport bottom.
 *     Full-screen sheet        — 100dvh, no border-radius on dialog edges.
 *
 * Late fee changes (unchanged from original):
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
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveId(val) {
  if (!val) return null;
  if (val._id) return val._id.toString();
  return val.toString();
}

function getOwnershipLabel(entity) {
  if (!entity || typeof entity !== "object") return null;
  if (entity.name) return entity.name;
  if (entity.type === "head_office") return "HQ";
  if (entity.type === "company") return "Company";
  if (entity.type === "private") return "Private";
  return null;
}

/**
 * Proportional allocation — mirrors allocatePaymentProportionally on the backend.
 * Allocates against rent principal only (not CAM or late fee).
 */
function proportionalAllocate(unitBreakdown, totalRupees) {
  const totalEffectiveRemainingPaisa = unitBreakdown.reduce((sum, u) => {
    const effective = (u.rentAmountPaisa || 0);
    return sum + Math.max(0, effective - (u.paidAmountPaisa || 0));
  }, 0);

  if (totalEffectiveRemainingPaisa === 0) return [];

  const totalPaymentPaisa = Math.round(totalRupees * 100);
  let remaining = totalPaymentPaisa;
  const unpaidUnits = unitBreakdown.filter((u) => {
    const eff = (u.rentAmountPaisa || 0);
    return eff - (u.paidAmountPaisa || 0) > 0;
  });
  const result = [];

  unpaidUnits.forEach((u, idx) => {
    const unitEffectivePaisa = (u.rentAmountPaisa || 0);
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

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p style={{
      color: "var(--color-text-weak)",
      fontSize: "10px",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      marginBottom: "10px",
    }}>
      {children}
    </p>
  );
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
  const isMobile = useIsMobile();

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
      paymentMethod: (formik.values?.paymentMethod || "").toLowerCase().trim(),
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
  const summaryState =
    balanceOwed === 0 ? "full"
      : balanceOwed > 0 ? "partial"
        : "over";

  const portalContainerRef = React.useRef(null);

  // ── Inline style tokens ───────────────────────────────────────────────────
  const S = {
    surface: { backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" },
    surfaceRaised: { backgroundColor: "var(--color-surface-raised)", border: "1px solid var(--color-border)" },
    textStrong: { color: "var(--color-text-strong)" },
    textBody: { color: "var(--color-text-body)" },
    textSub: { color: "var(--color-text-sub)" },
    textWeak: { color: "var(--color-text-weak)" },
    accentText: { color: "var(--color-accent)" },
    accentBg: { backgroundColor: "var(--color-accent-light)", border: "1px solid var(--color-accent-mid)" },
    danger: { color: "var(--color-danger)" },
    dangerBg: { backgroundColor: "var(--color-danger-bg)", border: "1px solid var(--color-danger-border)" },
    warning: { color: "var(--color-warning)" },
    warningBg: { backgroundColor: "var(--color-warning-bg)", border: "1px solid var(--color-warning-border)" },
    success: { color: "var(--color-success)" },
    successBg: { backgroundColor: "var(--color-success-bg)", border: "1px solid var(--color-success-border)" },
    border: { border: "1px solid var(--color-border)" },
    divider: { borderTop: "1px solid var(--color-border)" },
  };

  return (
    <DialogContent
      style={{
        maxWidth: "860px",
        width: "100%",
        padding: 0,
        overflow: "hidden",
        maxHeight: isMobile ? "100dvh" : "90vh",
        height: isMobile ? "100dvh" : "auto",
        margin: isMobile ? "0" : undefined,
        borderRadius: isMobile ? "0" : undefined,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
      }}
    >
      <div ref={portalContainerRef} />

      {/* ── Dialog Header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: isMobile ? "14px 16px 12px" : "20px 24px 16px",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexShrink: 0,
        backgroundColor: "var(--color-surface-raised)",
      }}>
        <div>
          <h2 style={{ ...S.textStrong, fontSize: "18px", fontWeight: 700, margin: 0 }}>
            Record Payment
          </h2>
          <p style={{ ...S.textSub, fontSize: "13px", marginTop: "2px" }}>
            {rent.nepaliMonth} {rent.nepaliYear}
            {rent?.tenant?.name && (
              <span style={{ ...S.textWeak }}> · {rent.tenant.name}</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Two-column body (desktop) / single-column body (mobile) ─────── */}
      <div style={{ display: "flex", flex: 1, overflow: isMobile ? "auto" : "hidden", minHeight: 0, flexDirection: isMobile ? "column" : "row" }}>

        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN — What you're paying
        ════════════════════════════════════════════════════════════════ */}
        <div style={{
          flex: isMobile ? "none" : "1 1 0",
          overflowY: isMobile ? "visible" : "auto",
          padding: isMobile ? "16px" : "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          borderRight: isMobile ? "none" : "1px solid var(--color-border)",
          borderBottom: isMobile ? "1px solid var(--color-border)" : "none",
        }}>

          {/* ── Due Summary strip ──────────────────────────────────────── */}
          <div style={{
            ...S.surfaceRaised,
            borderRadius: "var(--radius-lg)",
            padding: "16px",
            boxShadow: "var(--shadow-card)",
          }}>
            <SectionLabel>Amount Due</SectionLabel>
            <div style={{
              display: "grid",
              gridTemplateColumns: hasLateFee
                ? (isMobile ? "1fr 1fr" : "1fr 1fr 1fr")
                : "1fr 1fr",
              gap: isMobile ? "8px" : "4px",
            }}>
              {/* Rent */}
              <div style={{ padding: "8px 0" }}>
                <p style={{ ...S.textWeak, fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  Rent {tdsAmountPaisa > 0 ? "(net TDS)" : ""}
                </p>
                <p style={{ ...S.textStrong, fontSize: "20px", fontWeight: 700, lineHeight: 1 }}>
                  ₹{rentAmount.toLocaleString()}
                </p>
                {tdsAmountPaisa > 0 && (
                  <p style={{ ...S.warning, fontSize: "10px", marginTop: "3px" }}>
                    TDS ₹{(tdsAmountPaisa / 100).toLocaleString()} withheld
                  </p>
                )}
              </div>

              {/* CAM */}
              <div style={{ padding: "8px 0", borderLeft: "1px solid var(--color-border)", paddingLeft: "12px" }}>
                <p style={{ ...S.textWeak, fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                  CAM
                </p>
                <p style={{ ...S.textStrong, fontSize: "20px", fontWeight: 700, lineHeight: 1 }}>
                  ₹{camAmount.toLocaleString()}
                </p>
              </div>

              {/* Late Fee */}
              {hasLateFee && (
                <div style={{
                  padding: "8px 0",
                  borderLeft: "1px solid var(--color-danger-border)",
                  paddingLeft: "12px",
                  backgroundColor: "var(--color-danger-bg)",
                  borderRadius: "0 var(--radius-md) var(--radius-md) 0",
                  paddingRight: "8px",
                  gridColumn: isMobile ? "1 / -1" : "auto",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <p style={{ ...S.danger, fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Late Fee
                    </p>
                    <span style={{
                      backgroundColor: "var(--color-danger-bg)",
                      color: "var(--color-danger)",
                      border: "1px solid var(--color-danger-border)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "9px",
                      fontWeight: 600,
                      padding: "1px 5px",
                    }}>
                      Penalty
                    </span>
                  </div>
                  <p style={{ ...S.danger, fontSize: "20px", fontWeight: 700, lineHeight: 1 }}>
                    ₹{lateFeeAmount.toLocaleString()}
                  </p>
                  <p style={{ ...S.textWeak, fontSize: "10px", marginTop: "3px" }}>Full payment required</p>
                </div>
              )}
            </div>

            <div style={{ ...S.divider, marginTop: "12px", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ ...S.textSub, fontSize: "12px" }}>Total Due</p>
              <p style={{ ...S.textStrong, fontSize: "17px", fontWeight: 700 }}>₹{totalDue.toLocaleString()}</p>
            </div>
          </div>

          {/* ── Unit Selector ──────────────────────────────────────────── */}
          <div style={{
            ...S.surfaceRaised,
            borderRadius: "var(--radius-lg)",
            padding: "16px",
            boxShadow: "var(--shadow-card)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <SectionLabel style={{ margin: 0 }}>Units</SectionLabel>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", ...S.textSub, fontSize: "11px", fontWeight: 500, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ accentColor: "var(--color-accent)", width: "13px", height: "13px", cursor: "pointer" }}
                  checked={allSelected}
                  onChange={(e) =>
                    setSelectedUnitIds(e.target.checked ? units.map((u) => u.id) : [])
                  }
                />
                Select all
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
                    style={{
                      width: "100%",
                      textAlign: "left",
                      borderRadius: "var(--radius-md)",
                      border: selected
                        ? "1.5px solid var(--color-accent)"
                        : "1.5px solid var(--color-border)",
                      backgroundColor: selected
                        ? "var(--color-accent-light)"
                        : "var(--color-surface)",
                      padding: isMobile ? "14px 14px" : "10px 12px",
                      cursor: "pointer",
                      transition: "all 0.1s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {/* Radio dot */}
                        <div style={{
                          width: "16px", height: "16px", borderRadius: "50%",
                          border: selected ? "2px solid var(--color-accent)" : "2px solid var(--color-muted)",
                          backgroundColor: selected ? "var(--color-accent)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          {selected && <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#fff" }} />}
                        </div>
                        <div>
                          <p style={{ ...S.textStrong, fontSize: "13px", fontWeight: 600 }}>{unit.name}</p>
                          {unit.label && <p style={{ ...S.textWeak, fontSize: "11px" }}>{unit.label}</p>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {unit.hasOutstanding && (
                          <span style={{
                            ...S.warningBg, ...S.warning,
                            borderRadius: "var(--radius-sm)",
                            fontSize: "9px", fontWeight: 600,
                            padding: "2px 6px",
                            textTransform: "uppercase", letterSpacing: "0.05em",
                            display: "block", marginBottom: "2px",
                          }}>
                            Outstanding
                          </span>
                        )}
                        <p style={{ ...S.textStrong, fontSize: "13px", fontWeight: 700 }}>
                          ₹{unit.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        <p style={{ ...S.textWeak, fontSize: "10px" }}>remaining</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {!selectedUnits.length && (
              <p style={{ ...S.danger, fontSize: "11px", marginTop: "8px" }}>
                Select at least one unit to continue.
              </p>
            )}
          </div>

          {/* ── Allocation ─────────────────────────────────────────────── */}
          <div style={{
            ...S.surfaceRaised,
            borderRadius: "var(--radius-lg)",
            padding: "16px",
            boxShadow: "var(--shadow-card)",
          }}>
            <SectionLabel>Allocation</SectionLabel>

            <Tabs value={allocationMode} onValueChange={setAllocationMode}>
              {/* Tab toggle */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                backgroundColor: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                padding: "3px",
                marginBottom: "16px",
                border: "1px solid var(--color-border)",
              }}>
                {[
                  { value: "auto", label: "Quick Payment" },
                  { value: "manual", label: "Custom Allocation" },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setAllocationMode(tab.value)}
                    style={{
                      borderRadius: "var(--radius-sm)",
                      padding: "6px 0",
                      fontSize: "12px",
                      fontWeight: allocationMode === tab.value ? 600 : 400,
                      cursor: "pointer",
                      border: "none",
                      backgroundColor: allocationMode === tab.value
                        ? "var(--color-surface-raised)"
                        : "transparent",
                      color: allocationMode === tab.value
                        ? "var(--color-accent)"
                        : "var(--color-text-sub)",
                      boxShadow: allocationMode === tab.value
                        ? "var(--shadow-card)"
                        : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Auto tab ─────────────────────────────────── */}
              {allocationMode === "auto" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ ...S.textBody, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Amount to Pay (Rs)
                    </label>
                    <Input
                      type="number"
                      placeholder={`Full due: ₹${totalDue.toLocaleString()}`}
                      value={formik.values?.amount || ""}
                      onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0, rent)}
                      onBlur={(e) => { if (!e.target.value) handleAmountChange(totalDue, rent); }}
                      style={{ fontSize: "16px", fontWeight: 600 }}
                    />
                  </div>

                  {/* Auto allocation breakdown */}
                  <div style={{
                    ...S.border,
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    backgroundColor: "var(--color-surface)",
                  }}>
                    {/* Rent row */}
                    <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ ...S.textBody, fontSize: "12px", fontWeight: 600 }}>Rent</p>
                        <p style={{ ...S.textWeak, fontSize: "10px", marginTop: "1px" }}>
                          Due ₹{rentAmount.toLocaleString()}
                        </p>
                      </div>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: rentAllocation > 0 ? "var(--color-text-strong)" : "var(--color-muted)" }}>
                        ₹{rentAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>

                    {camAmount > 0 && (
                      <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--color-border)" }}>
                        <div>
                          <p style={{ ...S.textBody, fontSize: "12px", fontWeight: 600 }}>CAM</p>
                          <p style={{ ...S.textWeak, fontSize: "10px", marginTop: "1px" }}>
                            Due ₹{camAmount.toLocaleString()}
                          </p>
                        </div>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: camAllocation > 0 ? "var(--color-text-strong)" : "var(--color-muted)" }}>
                          ₹{camAllocation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    )}

                    {hasLateFee && (
                      <div style={{
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderTop: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-danger-bg)",
                      }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <p style={{ ...S.danger, fontSize: "12px", fontWeight: 600 }}>Late Fee</p>
                            <span style={{
                              backgroundColor: "var(--color-danger-bg)",
                              color: "var(--color-danger)",
                              border: "1px solid var(--color-danger-border)",
                              borderRadius: "var(--radius-sm)",
                              fontSize: "9px", fontWeight: 600,
                              padding: "1px 5px",
                            }}>
                              Separate
                            </span>
                          </div>
                          <p style={{ ...S.textWeak, fontSize: "10px", marginTop: "1px" }}>
                            Due ₹{lateFeeAmount.toLocaleString()} · full only
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ fontSize: "13px", fontWeight: 700, color: (lateFeeAllocation || 0) > 0 ? "var(--color-danger)" : "var(--color-muted)" }}>
                            ₹{(lateFeeAllocation || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                          {(lateFeeAllocation || 0) === 0 && paymentAmount > 0 && (
                            <p style={{ ...S.textWeak, fontSize: "10px" }}>
                              +₹{lateFeeAmount.toLocaleString()} to cover
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Per-unit breakdown */}
                    {autoUnitAllocations.length > 0 && (
                      <div style={{
                        padding: "10px 14px",
                        borderTop: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                      }}>
                        <p style={{ ...S.textWeak, fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
                          Unit breakdown
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          {autoUnitAllocations.map((alloc) => {
                            const unit = units.find((u) => u.id === alloc.unitId);
                            return (
                              <div key={alloc.unitId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ ...S.textSub, fontSize: "11px" }}>{unit?.name || alloc.unitId}</span>
                                <span style={{ ...S.textBody, fontSize: "11px", fontWeight: 600 }}>
                                  ₹{alloc.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div style={{
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                    }}>
                      <p style={{ ...S.textSub, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Total Allocated
                      </p>
                      <p style={{ ...S.textStrong, fontSize: "13px", fontWeight: 700 }}>
                        ₹{totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Manual tab ───────────────────────────────── */}
              {allocationMode === "manual" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ ...S.textBody, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Total Amount to Pay (Rs)
                    </label>
                    <Input
                      type="number"
                      placeholder="Enter total payment amount"
                      value={formik.values?.amount || ""}
                      onChange={(e) => formik.setFieldValue("amount", parseFloat(e.target.value) || 0)}
                      style={{ fontSize: "16px", fontWeight: 600 }}
                    />
                  </div>

                  <div style={{
                    ...S.border,
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    backgroundColor: "var(--color-surface)",
                  }}>
                    {/* Rent */}
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ ...S.textBody, fontSize: "12px", fontWeight: 600 }}>Rent</p>
                        <p style={{ ...S.textWeak, fontSize: "10px", marginTop: "1px" }}>
                          Due ₹{rentAmount.toLocaleString()}
                        </p>
                      </div>
                      <div style={{ width: "130px" }}>
                        <Input
                          type="number"
                          placeholder="0"
                          value={rentAllocation || ""}
                          onChange={(e) => setRentAllocation(parseFloat(e.target.value) || 0)}
                          style={{ textAlign: "right", fontSize: "13px" }}
                        />
                      </div>
                    </div>

                    {/* CAM */}
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "12px", borderTop: "1px solid var(--color-border)" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ ...S.textBody, fontSize: "12px", fontWeight: 600 }}>CAM</p>
                        <p style={{ ...S.textWeak, fontSize: "10px", marginTop: "1px" }}>
                          Due ₹{camAmount.toLocaleString()}
                        </p>
                      </div>
                      <div style={{ width: "130px" }}>
                        <Input
                          type="number"
                          placeholder="0"
                          value={camAllocation || ""}
                          onChange={(e) => setCamAllocation(parseFloat(e.target.value) || 0)}
                          style={{ textAlign: "right", fontSize: "13px" }}
                        />
                      </div>
                    </div>

                    {/* Late Fee */}
                    {hasLateFee && (
                      <div style={{
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        borderTop: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-danger-bg)",
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <p style={{ ...S.danger, fontSize: "12px", fontWeight: 600 }}>Late Fee</p>
                            <span style={{
                              backgroundColor: "var(--color-danger-bg)",
                              color: "var(--color-danger)",
                              border: "1px solid var(--color-danger-border)",
                              borderRadius: "var(--radius-sm)",
                              fontSize: "9px", fontWeight: 600,
                              padding: "1px 5px",
                            }}>
                              All or nothing
                            </span>
                          </div>
                          <p style={{ ...S.textWeak, fontSize: "10px", marginTop: "1px" }}>
                            Due ₹{lateFeeAmount.toLocaleString()}
                          </p>
                          {isPartialLateFee && (
                            <p style={{ ...S.danger, fontSize: "10px", marginTop: "2px", fontWeight: 500 }}>
                              Enter ₹{lateFeeAmount.toLocaleString()} or 0
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                          <div style={{ width: "130px" }}>
                            <Input
                              type="number"
                              placeholder="0"
                              value={lateFeeAllocation || ""}
                              onChange={(e) => setLateFeeAllocation(parseFloat(e.target.value) || 0)}
                              style={{
                                textAlign: "right",
                                fontSize: "13px",
                                borderColor: isPartialLateFee ? "var(--color-danger)" : undefined,
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setLateFeeAllocation(lateFeeAmount)}
                            style={{
                              ...S.danger,
                              background: "none",
                              border: "none",
                              fontSize: "10px",
                              cursor: "pointer",
                              textDecoration: "underline",
                              padding: 0,
                            }}
                          >
                            Fill ₹{lateFeeAmount.toLocaleString()}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Running total */}
                    <div style={{
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface)",
                    }}>
                      <div>
                        <p style={{ ...S.textSub, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Total Allocated
                        </p>
                        {totalAllocated !== (formik.values?.amount || 0) && (formik.values?.amount || 0) > 0 && (
                          <p style={{
                            fontSize: "10px",
                            marginTop: "1px",
                            color: isOverAllocated ? "var(--color-danger)" : "var(--color-warning)",
                          }}>
                            {isOverAllocated
                              ? `₹${(totalAllocated - (formik.values?.amount || 0)).toLocaleString()} over`
                              : `₹${((formik.values?.amount || 0) - totalAllocated).toLocaleString()} unallocated`}
                          </p>
                        )}
                      </div>
                      <p style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: isOverAllocated ? "var(--color-danger)" : "var(--color-text-strong)",
                      }}>
                        ₹{totalAllocated.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>

                  {/* Per-unit allocations */}
                  {rent?.useUnitBreakdown && selectedUnits.length > 0 && (
                    <div style={{
                      ...S.border,
                      borderRadius: "var(--radius-md)",
                      padding: "12px 14px",
                      backgroundColor: "var(--color-surface)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <p style={{ ...S.textStrong, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Per-unit rent
                        </p>
                        <p style={{
                          fontSize: "10px",
                          fontWeight: 500,
                          color: unitAllocationMismatch ? "var(--color-danger)" : "var(--color-text-sub)",
                        }}>
                          {unitAllocationMismatch
                            ? `Total ₹${manualUnitRentTotal.toFixed(0)} ≠ rent ₹${rentAllocation.toFixed(0)}`
                            : `Must sum to ₹${rentAllocation.toLocaleString()}`}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {selectedUnits.map((unit) => (
                          <div key={unit.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ ...S.textBody, fontSize: "12px", fontWeight: 500 }}>{unit.name}</p>
                              <p style={{ ...S.textWeak, fontSize: "10px" }}>
                                Remaining ₹{unit.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <Input
                              type="number"
                              style={{ width: "130px", textAlign: "right", fontSize: "12px" }}
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
            </Tabs>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT COLUMN — How you're paying + sticky submit
        ════════════════════════════════════════════════════════════════ */}
        <div style={{
          width: isMobile ? "100%" : "300px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--color-surface-raised)",
          overflowY: isMobile ? "visible" : "auto",
        }}>
          {/* Scrollable form fields */}
          <div style={{ flex: 1, padding: isMobile ? "16px" : "20px", display: "flex", flexDirection: "column", gap: "16px", overflowY: isMobile ? "visible" : "auto" }}>
            <SectionLabel>Payment Details</SectionLabel>

            {/* Method */}
            <div>
              <label style={{ ...S.textBody, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Payment Method
              </label>
              <Select
                value={formik.values?.paymentMethod || ""}
                onValueChange={(v) => formik.setFieldValue("paymentMethod", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bank Account */}
            {needsBankAccount && (
              <div>
                <label style={{ ...S.textBody, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Deposit To *
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {bankAccounts.map((bank) => {
                    const isSelected = selectedBankAccountId === bank._id;
                    return (
                      <button
                        key={bank._id}
                        type="button"
                        onClick={() => {
                          setSelectedBankAccountId(bank._id);
                          formik.setFieldValue("bankAccountId", bank._id);
                          formik.setFieldValue("bankAccountCode", bank.accountCode || "");
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: isMobile ? "14px 14px" : "10px 12px",
                          borderRadius: "var(--radius-md)",
                          border: isSelected
                            ? "1.5px solid var(--color-accent)"
                            : "1.5px solid var(--color-border)",
                          backgroundColor: isSelected
                            ? "var(--color-accent-light)"
                            : "var(--color-surface)",
                          cursor: "pointer",
                          transition: "all 0.1s",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            {getOwnershipLabel(bank.entityId) && (
                              <span style={{
                                ...S.textWeak,
                                fontSize: "9px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                border: "1px solid var(--color-border)",
                                borderRadius: "var(--radius-sm)",
                                padding: "1px 5px",
                                display: "inline-block",
                                marginBottom: "3px",
                              }}>
                                {getOwnershipLabel(bank.entityId)}
                              </span>
                            )}
                            <p style={{ ...S.textStrong, fontSize: "12px", fontWeight: 600 }}>{bank.bankName}</p>
                            <p style={{ ...S.textWeak, fontSize: "10px" }}>
                              **** {bank.accountNumber?.slice(-4) || "****"}
                            </p>
                            {bank.accountCode && (
                              <p style={{ ...S.textWeak, fontSize: "10px", fontFamily: "monospace" }}>
                                {bank.accountCode}
                              </p>
                            )}
                          </div>
                          <div style={{ textAlign: "right", marginLeft: "8px" }}>
                            <p style={{ ...S.textWeak, fontSize: "9px", fontWeight: 600, textTransform: "uppercase" }}>Bal</p>
                            <p style={{ ...S.textStrong, fontSize: "12px", fontWeight: 600 }}>
                              ₹{bank.balance?.toLocaleString() || "0"}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="var(--color-accent)">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span style={{ ...S.accentText, fontSize: "10px", fontWeight: 600 }}>Selected</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {needsBankAccount && !formik.values?.bankAccountCode && (
                  <p style={{ ...S.danger, fontSize: "11px", marginTop: "6px" }}>
                    Select a bank account to continue.
                  </p>
                )}
              </div>
            )}

            {/* Payment Date */}
            <div>
              <label style={{ ...S.textBody, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Payment Date
              </label>
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
            <div>
              <label style={{ ...S.textBody, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Txn Reference{" "}
                <span style={{ ...S.textWeak, fontWeight: 400 }}>(optional)</span>
              </label>
              <Input
                placeholder="e.g., CHQ-12345"
                value={formik.values?.transactionRef || ""}
                onChange={(e) => formik.setFieldValue("transactionRef", e.target.value)}
                style={{ fontSize: "12px" }}
              />
            </div>

            {/* Note */}
            <div>
              <label style={{ ...S.textBody, fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Note{" "}
                <span style={{ ...S.textWeak, fontWeight: 400 }}>(optional)</span>
              </label>
              <Input
                placeholder="e.g., Payment for Unit A"
                value={formik.values?.note || ""}
                onChange={(e) => formik.setFieldValue("note", e.target.value)}
                style={{ fontSize: "12px" }}
              />
            </div>
          </div>

          {/* ── Sticky footer: totals + errors + buttons ─────────────── */}
          <div style={{
            borderTop: "1px solid var(--color-border)",
            padding: isMobile ? "12px 16px" : "16px 20px",
            backgroundColor: "var(--color-surface-raised)",
            flexShrink: 0,
            position: isMobile ? "sticky" : "static",
            bottom: 0,
            zIndex: 10,
          }}>
            {/* Summary totals */}
            <div style={{
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              marginBottom: "12px",
              backgroundColor:
                summaryState === "full" ? "var(--color-success-bg)"
                  : summaryState === "over" ? "var(--color-danger-bg)"
                    : "var(--color-warning-bg)",
              border:
                summaryState === "full" ? "1px solid var(--color-success-border)"
                  : summaryState === "over" ? "1px solid var(--color-danger-border)"
                    : "1px solid var(--color-warning-border)",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: isMobile ? "8px" : "4px", marginBottom: "8px" }}>
                {[
                  { label: "Due", value: `₹${totalDue.toLocaleString()}` },
                  { label: "Allocated", value: `₹${totalAllocated.toLocaleString()}` },
                  { label: "Remaining", value: `₹${balanceOwed.toLocaleString()}` },
                ].map((item) => (
                  <div key={item.label} style={{ textAlign: "center" }}>
                    <p style={{ ...S.textWeak, fontSize: "9px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {item.label}
                    </p>
                    <p style={{ ...S.textStrong, fontSize: "13px", fontWeight: 700, marginTop: "2px" }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <p style={{
                fontSize: "10px",
                fontWeight: 500,
                textAlign: "center",
                color:
                  summaryState === "full" ? "var(--color-success)"
                    : summaryState === "over" ? "var(--color-danger)"
                      : "var(--color-warning)",
              }}>
                {balanceOwed < 0
                  ? "Allocation exceeds total due."
                  : balanceOwed === 0
                    ? "✓ Fully allocated — clears selected dues."
                    : "Partial payment — balance stays outstanding."}
              </p>
            </div>

            {/* Validation errors */}
            {(!selectedUnits.length || isOverAllocated || isPartialLateFee || unitAllocationMismatch ||
              (needsBankAccount && !formik.values?.bankAccountCode)) && (
                <div style={{
                  ...S.dangerBg,
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 10px",
                  marginBottom: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}>
                  {!selectedUnits.length && (
                    <p style={{ ...S.danger, fontSize: "11px" }}>Select at least one unit.</p>
                  )}
                  {isOverAllocated && (
                    <p style={{ ...S.danger, fontSize: "11px" }}>Allocation exceeds payment amount.</p>
                  )}
                  {isPartialLateFee && (
                    <p style={{ ...S.danger, fontSize: "11px" }}>
                      Late fee must be ₹{lateFeeAmount.toLocaleString()} or 0.
                    </p>
                  )}
                  {unitAllocationMismatch && (
                    <p style={{ ...S.danger, fontSize: "11px" }}>
                      Unit allocations must sum to ₹{rentAllocation.toFixed(2)}.
                    </p>
                  )}
                  {needsBankAccount && !formik.values?.bankAccountCode && (
                    <p style={{ ...S.danger, fontSize: "11px" }}>Select a bank account.</p>
                  )}
                </div>
              )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  backgroundColor: "transparent",
                  color: "var(--color-text-body)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: isMobile ? "12px 0" : "9px 0",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "border-color 0.1s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--color-text-sub)")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitDisabled}
                onClick={async (e) => {
                  e.preventDefault();
                  const payload = buildPayload();
                  await formik.setValues({ ...formik.values, ...payload });
                  await formik.handleSubmit();
                  if (formik.isValid) onClose();
                }}
                style={{
                  flex: 2,
                  backgroundColor: isSubmitDisabled
                    ? "var(--color-muted)"
                    : "var(--color-accent)",
                  color: isSubmitDisabled
                    ? "var(--color-text-weak)"
                    : "#ffffff",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  padding: isMobile ? "12px 0" : "9px 0",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isSubmitDisabled ? "not-allowed" : "pointer",
                  transition: "background-color 0.15s",
                }}
                onMouseOver={(e) => {
                  if (!isSubmitDisabled) e.currentTarget.style.backgroundColor = "var(--color-accent-hover)";
                }}
                onMouseOut={(e) => {
                  if (!isSubmitDisabled) e.currentTarget.style.backgroundColor = "var(--color-accent)";
                }}
              >
                Submit Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  );
};