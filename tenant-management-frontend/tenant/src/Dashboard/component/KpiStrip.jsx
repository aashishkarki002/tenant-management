import React, { useEffect, useRef, useState } from "react";
import {
    Wallet, Building2, AlertCircle, CheckCircle2, ChevronRight,
    Users, Receipt,
} from "lucide-react";
import { Link } from "react-router-dom";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(val) {
    if (val == null || val === "") return "—";
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}k`;
    return `₹${n.toLocaleString()}`;
}

function fmtFull(val) {
    if (val == null) return "—";
    return `₹${Number(val).toLocaleString()}`;
}

// ─── Stacked animated bar ─────────────────────────────────────────────────────
//
// Single element, single width transition. The rent/CAM colour split lives
// inside a linear-gradient so both colours travel together as the bar grows.
// No seam, no two-bar effect, no stagger.
//
// Gradient maths:
//   totalPct  = rentPct + camPct        (filled width as % of track)
//   rentShare = (rentPct / totalPct) × 100  (rent's portion of the filled bar)
//
//   The gradient stop is expressed as % of the element's own width (= filled
//   width), so the colour boundary stays proportionally correct at every point
//   during animation — not just at the final value.
//
//   A ±1.5% soft blend zone at the boundary replaces a hard colour cut.
//
// Easing: cubic-bezier(0.34, 1.56, 0.64, 1) — mild spring, ~3% overshoot.
// Double-rAF: lets React flush the 0-reset before starting the transition so
// the browser always sees a 0 → target change and plays the full animation.

function StackedBar({ rentPct = 0, camPct = 0 }) {
    const totalPct = Math.min(100, rentPct + camPct);
    const [displayPct, setDisplayPct] = useState(0);
    const rafRef = useRef(null);

    useEffect(() => {
        setDisplayPct(0);
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = requestAnimationFrame(() => {
                setDisplayPct(totalPct);
            });
        });
        return () => cancelAnimationFrame(rafRef.current);
    }, [totalPct]);

    const hasCam = camPct > 0;
    const rentShare = totalPct > 0 ? (rentPct / totalPct) * 100 : 100;
    const blendStart = Math.max(0, rentShare - 1.5);
    const blendEnd = Math.min(100, rentShare + 1.5);

    const background = hasCam
        ? `linear-gradient(to right, var(--color-success) ${blendStart}%, var(--color-info) ${blendEnd}%)`
        : "var(--color-success)";

    return (
        <div
            className="mt-3 h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--color-muted)" }}
            title={`Rent: ${rentPct}% · CAM: ${camPct}%`}
        >
            <div
                style={{
                    height: "100%",
                    width: `${displayPct}%`,
                    background,
                    borderRadius: "9999px",
                    transition: "width 750ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                    willChange: "width",
                }}
            />
        </div>
    );
}

// ─── Simple single-fill bar ───────────────────────────────────────────────────

function SimpleBar({ pct = 0, colorVar }) {
    const [width, setWidth] = useState(0);
    const rafRef = useRef(null);

    useEffect(() => {
        setWidth(0);
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = requestAnimationFrame(() => setWidth(pct));
        });
        return () => cancelAnimationFrame(rafRef.current);
    }, [pct]);

    return (
        <div
            className="mt-3 h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--color-muted)" }}
        >
            <div
                style={{
                    height: "100%",
                    width: `${width}%`,
                    backgroundColor: colorVar ?? "var(--color-muted)",
                    borderRadius: "9999px",
                    transition: "width 750ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                    willChange: "width",
                }}
            />
        </div>
    );
}

// ─── Tile ─────────────────────────────────────────────────────────────────────

function Tile({
    label, value, sub, icon: Icon,
    iconBgStyle = { backgroundColor: "var(--color-muted)" },
    iconColorStyle = { color: "var(--color-text-strong)" },
    valueStyle = { color: "var(--color-text-strong)" },
    borderColor = "var(--color-border)",
    bar,
    dots,
    to,
    loading,
}) {
    return (
        <Link
            to={to}
            className="group rounded-2xl border flex flex-col overflow-hidden transition-all duration-150 hover:shadow-sm"
            style={{
                backgroundColor: "var(--color-surface)",
                borderColor,
            }}
        >
            {/* Body */}
            <div className="flex items-start justify-between px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">

                    {/* Label */}
                    <p
                        className="text-[10px] font-medium tracking-[0.18em] uppercase mb-2"
                        style={{ color: "var(--color-text-sub)" }}
                    >
                        {label}
                    </p>

                    {/* Hero value */}
                    {loading
                        ? (
                            <div
                                className="animate-pulse rounded h-7 w-24"
                                style={{ backgroundColor: "var(--color-muted)" }}
                            />
                        )
                        : (
                            <p
                                className="text-base sm:text-xl lg:text-2xl font-bold tabular-nums leading-none truncate"
                                style={valueStyle}
                            >
                                {value}
                            </p>
                        )
                    }

                    {/* Sub-label */}
                    {!loading && sub && (
                        <p
                            className="text-[11px] mt-1.5 leading-tight font-medium"
                            style={{ color: "var(--color-text-sub)" }}
                        >
                            {sub}
                        </p>
                    )}

                    {/* Bar */}
                    {!loading && bar && (
                        bar.type === "stacked"
                            ? <StackedBar rentPct={bar.rentPct} camPct={bar.camPct} />
                            : <SimpleBar pct={bar.pct} colorVar={bar.colorVar} />
                    )}

                    {/* Dots */}
                    {!loading && dots && (
                        <div className="flex items-center gap-1.5 mt-3">
                            {dots.map((d, i) => (
                                <span
                                    key={i}
                                    className={`w-2 h-2 rounded-full ${d.pulse ? "animate-pulse" : ""}`}
                                    style={{ background: d.color }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Icon badge */}
                <div className="rounded-xl p-2 shrink-0" style={iconBgStyle}>
                    <Icon className="w-4 h-4" style={iconColorStyle} />
                </div>
            </div>


        </Link>
    );
}

// ─── KpiStrip ─────────────────────────────────────────────────────────────────

export default function KpiStrip({ stats, loading }) {
    const kpi = stats?.kpi ?? {};
    const attention = stats?.attention ?? {};

    // ── Tile 1: Collected
    const rentPct = kpi.rentPct ?? 0;
    const camPct = kpi.camPct ?? 0;
    const hasCam = (kpi.camBilled ?? 0) > 0;

    const collectedSub = kpi.totalBilled > 0
        ? hasCam
            ? `${kpi.collectionRate ?? 0}% of ${fmt(kpi.totalBilled)} · Rent ${fmt(kpi.rentCollected)} + CAM ${fmt(kpi.camCollected)}`
            : `${kpi.collectionRate ?? 0}% of ${fmt(kpi.totalBilled)} target`
        : "This month";

    // ── Tile 2: Outstanding — 4-phase aware
    const allClear = kpi.allClear ?? false;
    const outstanding = kpi.totalRemaining ?? null;
    const collectedPct = kpi.collectionRate ?? 0;
    const tenantsPaid = kpi.tenantsPaid ?? 0;
    const activeTenants = kpi.activeTenants ?? 0;
    const tenantCoverageRate = kpi.tenantCoverageRate ?? 0;
    const tenantsWithBalance = kpi.tenantsWithBalance ?? 0;
    const collectionPhase = kpi.collectionPhase ?? "overdue";
    const daysUntilDue = kpi.daysUntilDue ?? null;
    const trulyOverdueCount = kpi.trulyOverdueCount ?? attention.overdueCount ?? 0;
    const tenantsPending = activeTenants > 0 ? activeTenants - tenantsPaid : tenantsWithBalance;

    // Billing frequency counts — sub-label copy only, never hero numbers
    const pendingMonthly = kpi.pendingMonthly ?? 0;
    const pendingQuarterly = kpi.pendingQuarterly ?? 0;
    const overdueMonthly = kpi.overdueMonthly ?? 0;
    const overdueQuarterly = kpi.overdueQuarterly ?? 0;

    // Only show the split when both types coexist — one type alone is noise
    function freqTag(monthly, quarterly) {
        if (monthly > 0 && quarterly > 0) {
            return ` · ${monthly} monthly · ${quarterly} quarterly`;
        }
        return "";
    }

    const tilePhase = allClear ? "all_clear" : collectionPhase;

    const outstandingTileProps = (() => {
        switch (tilePhase) {

            case "all_clear":
                return {
                    label: "Collection Coverage",
                    value: activeTenants > 0 ? `${tenantsPaid}/${activeTenants}` : "—",
                    valueStyle: tenantCoverageRate >= 100
                        ? { color: "var(--color-success)" }
                        : tenantCoverageRate >= 80
                            ? { color: "var(--color-text-strong)" }
                            : { color: "var(--color-warning)" },
                    sub: tenantCoverageRate >= 100
                        ? "All tenants paid this month"
                        : `${tenantsPending} tenant${tenantsPending !== 1 ? "s" : ""} pending this month`,
                    bar: {
                        type: "simple",
                        pct: tenantCoverageRate,
                        colorVar: tenantCoverageRate >= 100
                            ? "var(--color-success)"
                            : tenantCoverageRate >= 80
                                ? "var(--color-warning)"
                                : "var(--color-danger)",
                    },
                    icon: tenantCoverageRate >= 100 ? CheckCircle2 : Users,
                    iconBgStyle: tenantCoverageRate >= 100
                        ? { backgroundColor: "var(--color-success-bg)" }
                        : { backgroundColor: "var(--color-muted)" },
                    iconColorStyle: tenantCoverageRate >= 100
                        ? { color: "var(--color-success)" }
                        : { color: "var(--color-text-strong)" },
                    borderColor: "var(--color-border)",
                };

            case "pending":
                return {
                    label: "Pending Collection",
                    value: outstanding != null ? fmtFull(outstanding) : "—",
                    valueStyle: { color: "var(--color-text-strong)" },
                    sub: daysUntilDue != null && daysUntilDue > 0
                        ? `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}${freqTag(pendingMonthly, pendingQuarterly)}`
                        : `${activeTenants} tenant${activeTenants !== 1 ? "s" : ""} billed${freqTag(pendingMonthly, pendingQuarterly)}`,
                    bar: {
                        type: "simple",
                        pct: collectedPct,
                        colorVar: collectedPct >= 80 ? "var(--color-success)" : "var(--color-info)",
                    },
                    icon: Receipt,
                    iconBgStyle: { backgroundColor: "var(--color-muted)" },
                    iconColorStyle: { color: "var(--color-text-sub)" },
                    borderColor: "var(--color-border)",
                };

            case "due_soon":
                return {
                    label: "Collection Due Soon",
                    value: outstanding != null ? fmtFull(outstanding) : "—",
                    valueStyle: { color: "var(--color-warning)" },
                    sub: daysUntilDue != null && daysUntilDue > 0
                        ? `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}${freqTag(pendingMonthly, pendingQuarterly)} yet to pay`
                        : `Due today${freqTag(pendingMonthly, pendingQuarterly)} yet to pay`,
                    bar: {
                        type: "simple",
                        pct: collectedPct,
                        colorVar: collectedPct >= 60 ? "var(--color-warning)" : "var(--color-danger)",
                    },
                    icon: AlertCircle,
                    iconBgStyle: { backgroundColor: "var(--color-warning-bg)" },
                    iconColorStyle: { color: "var(--color-warning)" },
                    borderColor: "var(--color-warning-border)",
                };

            case "overdue":
            default:
                return {
                    label: "Outstanding",
                    value: outstanding != null ? fmtFull(outstanding) : "—",
                    valueStyle: { color: "var(--color-danger)" },
                    sub: `${trulyOverdueCount} overdue${freqTag(overdueMonthly, overdueQuarterly)}`,
                    bar: {
                        type: "simple",
                        pct: collectedPct,
                        colorVar: collectedPct >= 80
                            ? "var(--color-success)"
                            : collectedPct >= 50
                                ? "var(--color-warning)"
                                : "var(--color-danger)",
                    },
                    icon: AlertCircle,
                    iconBgStyle: { backgroundColor: "var(--color-danger-bg)" },
                    iconColorStyle: { color: "var(--color-danger)" },
                    borderColor: "var(--color-danger-border)",
                };
        }
    })();

    // ── Tile 3: Vacancy
    const vacantUnits = kpi.vacantUnits ?? 0;
    const fullyOccupied = kpi.fullyOccupied ?? false;
    const occupancyRate = kpi.occupancyRate ?? 0;
    const totalUnits = kpi.totalUnits ?? 0;
    const occupiedUnits = kpi.occupiedUnits ?? 0;
    const vacancyRevenueLost = kpi.vacancyRevenueLost ?? 0;

    const occBarColorVar = occupancyRate >= 95 ? "var(--color-success)" : "var(--color-warning)";

    const vacancyTileProps = fullyOccupied
        ? {
            label: "Occupancy",
            value: `${occupiedUnits}/${totalUnits}`,
            valueStyle: { color: "var(--color-success)" },
            sub: "All units occupied",
            bar: { type: "simple", pct: 100, colorVar: "var(--color-success)" },
            icon: Building2,
            iconBgStyle: { backgroundColor: "var(--color-success-bg)" },
            iconColorStyle: { color: "var(--color-success)" },
            borderColor: "var(--color-border)",
            to: "/dashboard/units",
        }
        : {
            label: "Vacancy",
            value: `${vacantUnits} unit${vacantUnits !== 1 ? "s" : ""} vacant`,
            valueStyle: vacantUnits === 0
                ? { color: "var(--color-success)" }
                : occupancyRate >= 80
                    ? { color: "var(--color-text-strong)" }
                    : { color: "var(--color-warning)" },
            sub: vacancyRevenueLost > 0
                ? `~${fmt(vacancyRevenueLost)}/mo not collecting`
                : `${occupancyRate}% occupied · ${occupiedUnits}/${totalUnits} units`,
            bar: { type: "simple", pct: occupancyRate, colorVar: occBarColorVar },
            icon: Building2,
            iconBgStyle: occupancyRate >= 80
                ? { backgroundColor: "var(--color-muted)" }
                : { backgroundColor: "var(--color-warning-bg)" },
            iconColorStyle: occupancyRate >= 80
                ? { color: "var(--color-text-strong)" }
                : { color: "var(--color-warning)" },
            borderColor: occupancyRate < 80 ? "var(--color-warning-border)" : "var(--color-border)",
            to: "/dashboard/units",
        };

    // ── Tile 4: Late Fees
    const hasActiveFees = kpi.hasActiveFees ?? false;
    const lateFeeOutstanding = kpi.lateFeeOutstanding ?? 0;
    const lateFeeTenantsCharged = kpi.lateFeeTenantsCharged ?? 0;
    const feeCollectionRate = kpi.feeCollectionRate ?? 0;

    const lateFeeTileProps = hasActiveFees
        ? {
            label: "Late Fees",
            value: fmt(lateFeeOutstanding),
            valueStyle: lateFeeOutstanding > 0
                ? { color: "var(--color-danger)" }
                : { color: "var(--color-success)" },
            sub: `${lateFeeTenantsCharged} tenant${lateFeeTenantsCharged !== 1 ? "s" : ""} being charged · ${feeCollectionRate}% cleared`,
            bar: {
                type: "simple",
                pct: feeCollectionRate,
                colorVar: feeCollectionRate >= 80
                    ? "var(--color-success)"
                    : feeCollectionRate >= 40
                        ? "var(--color-warning)"
                        : "var(--color-danger)",
            },
            icon: Receipt,
            iconBgStyle: { backgroundColor: "var(--color-danger-bg)" },
            iconColorStyle: { color: "var(--color-danger)" },
            borderColor: "var(--color-danger-border)",
        }
        : {
            label: "Late Fees",
            value: "None",
            valueStyle: { color: "var(--color-success)" },
            sub: "All tenants paying on time",
            bar: { type: "simple", pct: 100, colorVar: "var(--color-success)" },
            icon: Receipt,
            iconBgStyle: { backgroundColor: "var(--color-success-bg)" },
            iconColorStyle: { color: "var(--color-success)" },
            borderColor: "var(--color-border)",
        };

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1 — Collected */}
            <Tile
                loading={loading}
                label="Collected"
                value={fmtFull(kpi.totalReceived)}
                sub={collectedSub}
                bar={{ type: "stacked", rentPct, camPct }}
                icon={Wallet}
                iconBgStyle={{ backgroundColor: "var(--color-muted)" }}
                iconColorStyle={{ color: "var(--color-text-strong)" }}
                to="/rent-payment"
            />

            {/* 2 — Outstanding / Collection Coverage */}
            <Tile loading={loading} to="/dashboard/transactions" {...outstandingTileProps} />

            {/* 3 — Vacancy */}
            <Tile loading={loading} {...vacancyTileProps} />

            {/* 4 — Late Fees */}
            <Tile loading={loading} to="/rent-payment" {...lateFeeTileProps} />
        </div>
    );
}