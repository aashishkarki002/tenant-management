// src/pages/component/KpiStrip.jsx
//
// DISPLAY-ONLY — zero calculations live here.
// All numbers come pre-computed from stats.kpi (set by normalizeDashboardStats
// in UseStats.js). This component's only job is to render what it receives.
//
// STACKED BAR (Collected tile):
//   The bar represents 100% of totalBilled (rent + CAM combined).
//   Two fills animate in sequence:
//     1. Rent segment  — primary burgundy — animates first (CSS transition)
//     2. CAM segment   — lighter rose/blush — animates after a 300ms delay
//   Together they show how much of the total billing has been collected,
//   and visually split the collection between rent and CAM.
//
//   Example: totalBilled=100, rentCollected=70, camCollected=10
//     → rentPct=70  → bar fills 70% in dark burgundy
//     → camPct=10   → bar continues to 80% in light rose
//     → remaining 20% is the empty track

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
// Renders two CSS-transitioned fills in a single track.
// Both start at 0 on mount; after a single rAF tick they transition to their
// target widths. CAM fill is delayed by 300ms so rent animates first.

function StackedBar({ rentPct = 0, camPct = 0, dark = false }) {
    const [rentWidth, setRentWidth] = useState(0);
    const [camWidth, setCamWidth] = useState(0);
    const rafRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        // Reset to 0 first so re-renders also animate
        setRentWidth(0);
        setCamWidth(0);
        rafRef.current = requestAnimationFrame(() => {
            setRentWidth(rentPct);
            timerRef.current = setTimeout(() => setCamWidth(camPct), 300);
        });
        return () => {
            cancelAnimationFrame(rafRef.current);
            clearTimeout(timerRef.current);
        };
    }, [rentPct, camPct]);

    const track = dark ? "#521C1C" : "#EEE9E5";
    const rentColor = dark ? "#DDA8A8" : "#3D1414";
    const camColor = dark ? "rgba(255,195,170,0.5)" : "rgba(180,100,80,0.38)";

    return (
        <div
            className="mt-3 h-1.5 rounded-full overflow-hidden relative"
            style={{ background: track }}
            title={`Rent: ${rentPct}% · CAM: ${camPct}%`}
        >
            {/* Rent fill — animates first */}
            <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                    width: `${rentWidth}%`,
                    background: rentColor,
                    transition: "width 700ms cubic-bezier(0.4,0,0.2,1)",
                }}
            />
            {/* CAM fill — appended right after rent, animates second */}
            <div
                className="absolute inset-y-0 rounded-full"
                style={{
                    left: `${rentWidth}%`,
                    width: `${camWidth}%`,
                    background: camColor,
                    transition:
                        "width 600ms cubic-bezier(0.4,0,0.2,1) 300ms, left 700ms cubic-bezier(0.4,0,0.2,1)",
                }}
            />
        </div>
    );
}

// ─── Simple single-fill bar (for other tiles) ─────────────────────────────────

function SimpleBar({ pct = 0, color, dark = false }) {
    const [width, setWidth] = useState(0);
    const rafRef = useRef(null);

    useEffect(() => {
        setWidth(0);
        rafRef.current = requestAnimationFrame(() => setWidth(pct));
        return () => cancelAnimationFrame(rafRef.current);
    }, [pct]);

    return (
        <div
            className="mt-3 h-1.5 rounded-full overflow-hidden"
            style={{ background: dark ? "#521C1C" : "#EEE9E5" }}
        >
            <div
                className="h-full rounded-full"
                style={{
                    width: `${width}%`,
                    background: color,
                    transition: "width 700ms cubic-bezier(0.4,0,0.2,1)",
                }}
            />
        </div>
    );
}

// ─── Multi-segment bar (Revenue Mix tile) ────────────────────────────────────
//
// Renders N proportional segments side by side in a single track.




function Tile({
    label, value, sub, icon: Icon, iconBg, iconColor,
    valueColor, borderColor,
    bar,       // { type: "stacked", rentPct, camPct } | { type: "simple", pct, color }
    dots,
    to,
    dark = false,
    loading,
}) {
    const bg = dark ? "#3D1414" : "#FDFCFA";
    const border = borderColor ?? (dark ? "#521C1C" : "#DDD6D0");

    return (
        <Link
            to={to}
            className="group rounded-2xl border flex flex-col overflow-hidden
        transition-all duration-150 hover:shadow-md hover:-translate-y-px"
            style={{ background: bg, borderColor: border }}
        >
            {/* Body */}
            <div className="flex items-start justify-between px-4 pt-4 pb-3 gap-3">
                <div className="flex-1 min-w-0">

                    {/* Label */}
                    <p
                        className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-2"
                        style={{ color: dark ? "#8B3030" : "#AFA097" }}
                    >
                        {label}
                    </p>

                    {/* Hero value */}
                    {loading
                        ? <div className={`animate-pulse rounded h-7 w-24 ${dark ? "bg-white/10" : "bg-[#EEE9E5]"}`} />
                        : (
                            <p
                                className="text-2xl font-bold tabular-nums leading-none"
                                style={{ color: valueColor ?? (dark ? "white" : "#1C1A18") }}
                            >
                                {value}
                            </p>
                        )
                    }

                    {/* Sub-label */}
                    {!loading && sub && (
                        <p
                            className="text-[11px] mt-1.5 leading-tight"
                            style={{ color: dark ? "#C47272" : "#948472" }}
                        >
                            {sub}
                        </p>
                    )}

                    {/* Bar */}
                    {!loading && bar && (
                        bar.type === "stacked"
                            ? <StackedBar rentPct={bar.rentPct} camPct={bar.camPct} dark={dark} />
                            : <SimpleBar pct={bar.pct} color={bar.color} dark={dark} />
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
                <div className="rounded-xl p-2 shrink-0" style={{ background: iconBg }}>
                    <Icon className="w-4 h-4" style={{ color: iconColor }} />
                </div>
            </div>

            {/* Footer */}
            <div
                className="flex items-center justify-between px-4 py-2 border-t mt-auto"
                style={{ borderColor: dark ? "#521C1C" : "#EEE9E5" }}
            >
                <span
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: dark ? "#C47272" : "#948472" }}
                >
                    View details
                </span>
                <ChevronRight
                    className="w-3 h-3 group-hover:translate-x-0.5 transition-transform"
                    style={{ color: dark ? "#C47272" : "#C8BDB6" }}
                />
            </div>
        </Link>
    );
}

// ─── KpiStrip ─────────────────────────────────────────────────────────────────
//
// DISPLAY ONLY — reads exclusively from stats.kpi.
// No arithmetic, no fallbacks, no derived values here.

export default function KpiStrip({ stats, loading }) {
    const kpi = stats?.kpi ?? {};
    const attention = stats?.attention ?? {};  // still needed for tile 2 overdueCount

    // ── Tile 1: Collected ──────────────────────────────────────────────────────
    const rentPct = kpi.rentPct ?? 0;
    const camPct = kpi.camPct ?? 0;
    const hasCam = (kpi.camBilled ?? 0) > 0;

    const collectedSub = kpi.totalBilled > 0
        ? hasCam
            ? `${kpi.collectionRate ?? 0}% of ${fmt(kpi.totalBilled)} · Rent ${fmt(kpi.rentCollected)} + CAM ${fmt(kpi.camCollected)}`
            : `${kpi.collectionRate ?? 0}% of ${fmt(kpi.totalBilled)} target`
        : "This month";

    // ── Tile 2: Outstanding / Collection Coverage ─────────────────────────────
    //
    // Two distinct states depending on whether there are outstanding dues:
    //
    //   HAS DUES  → show outstanding amount + overdue tenant count
    //               bar = how much of total billed has been collected (progress)
    //
    //   ALL CLEAR → flip to "Collection Coverage": X/Y tenants paid this month
    //               bar = tenant coverage rate (how many tenants fully paid)
    //               This answers "are we actually done collecting?" not just "is balance 0?"
    //
    // This keeps the tile useful in both states — it always answers a real question.
    const allClear = kpi.allClear ?? false;
    const outstanding = kpi.totalRemaining ?? null;
    const overdueCount = attention.overdueCount ?? 0;
    const collectedPct = kpi.collectionRate ?? 0;
    const tenantsPaid = kpi.tenantsPaid ?? 0;
    const activeTenants = kpi.activeTenants ?? 0;
    const tenantCoverageRate = kpi.tenantCoverageRate ?? 0;
    const tenantsWithBalance = kpi.tenantsWithBalance ?? 0;
    const tenantsPending = activeTenants > 0 ? activeTenants - tenantsPaid : tenantsWithBalance;

    const outstandingTileProps = allClear
        ? {
            // ── All clear: show tenant coverage ──────────────────────────────
            label: 'Collection Coverage',
            value: activeTenants > 0 ? `${tenantsPaid}/${activeTenants}` : '—',
            valueColor: tenantCoverageRate >= 100 ? '#2E7A4A'
                : tenantCoverageRate >= 80 ? '#1C1A18'
                    : '#C4721A',
            sub: tenantCoverageRate >= 100
                ? 'All tenants paid this month'
                : `${tenantsPending} tenant${tenantsPending !== 1 ? 's' : ''} pending this month`,
            bar: {
                type: 'simple',
                pct: tenantCoverageRate,
                color: tenantCoverageRate >= 100 ? '#2E7A4A'
                    : tenantCoverageRate >= 80 ? '#C4721A'
                        : '#B02020',
            },
            icon: tenantCoverageRate >= 100 ? CheckCircle2 : Users,
            iconBg: tenantCoverageRate >= 100 ? '#D4EDE0' : '#EEE9E5',
            iconColor: tenantCoverageRate >= 100 ? '#2E7A4A' : '#3D1414',
            borderColor: '#DDD6D0',
        }
        : {
            // ── Has dues: show outstanding balance ────────────────────────────
            label: 'Outstanding',
            value: outstanding != null ? fmtFull(outstanding) : '—',
            valueColor: '#B02020',
            sub: `${overdueCount} tenant${overdueCount !== 1 ? 's' : ''} overdue`,
            bar: {
                type: 'simple',
                pct: collectedPct,
                color: collectedPct >= 80 ? '#2E7A4A' : collectedPct >= 50 ? '#C4721A' : '#B02020',
            },
            icon: AlertCircle,
            iconBg: '#F5D5D5',
            iconColor: '#B02020',
            borderColor: 'rgba(176,32,32,0.3)',
        };

    // ── Tile 3: Vacancy (replaces plain Occupancy %) ──────────────────────────
    //
    // DUAL STATE:
    //   HAS VACANCIES  → show vacant unit count + estimated monthly revenue gap.
    //                    "3 units vacant · ₹45k/mo not collecting"
    //                    Bar = occupancy rate, colored by severity.
    //   FULLY OCCUPIED → flip to a positive signal. "Full occupancy" with the
    //                    occupied/total count. Bar is solid green.
    //
    // Why: "87% occupied" is data. "3 units vacant, losing ₹45k/mo" is insight.
    const vacantUnits = kpi.vacantUnits ?? 0;
    const fullyOccupied = kpi.fullyOccupied ?? false;
    const occupancyRate = kpi.occupancyRate ?? 0;
    const totalUnits = kpi.totalUnits ?? 0;
    const occupiedUnits = kpi.occupiedUnits ?? 0;
    const vacancyRevenueLost = kpi.vacancyRevenueLost ?? 0;

    const occBarColor = occupancyRate >= 95 ? "#2E7A4A"
        : occupancyRate >= 80 ? "#C4721A"
            : "#B02020";

    const vacancyTileProps = fullyOccupied
        ? {
            label: "Occupancy",
            value: `${occupiedUnits}/${totalUnits}`,
            valueColor: "#2E7A4A",
            sub: "All units occupied",
            bar: { type: "simple", pct: 100, color: "#2E7A4A" },
            icon: Building2,
            iconBg: "#D4EDE0",
            iconColor: "#2E7A4A",
            borderColor: "#DDD6D0",
            to: "/dashboard/units",
        }
        : {
            label: "Vacancy",
            value: `${vacantUnits} unit${vacantUnits !== 1 ? "s" : ""} vacant`,
            valueColor: vacantUnits === 0 ? "#2E7A4A" : occupancyRate >= 80 ? "#1C1A18" : "#B02020",
            sub: vacancyRevenueLost > 0
                ? `~${fmt(vacancyRevenueLost)}/mo not collecting`
                : `${occupancyRate}% occupied · ${occupiedUnits}/${totalUnits} units`,
            bar: { type: "simple", pct: occupancyRate, color: occBarColor },
            icon: Building2,
            iconBg: occupancyRate >= 80 ? "#EEE9E5" : "#F5D5D5",
            iconColor: occupancyRate >= 80 ? "#3D1414" : "#B02020",
            borderColor: occupancyRate < 80 ? "rgba(176,32,32,0.25)" : "#DDD6D0",
            to: "/dashboard/units",
        };

    // ── Tile 4: Late Fees ──────────────────────────────────────────────────────
    //
    // The late fee engine runs daily and accrues penalties on overdue tenants,
    // but this data has never appeared on the dashboard. This tile fixes that.
    //
    // TWO STATES:
    //   HAS ACTIVE FEES → outstanding late fee amount + tenants being charged.
    //     "₹12,400 outstanding · 4 tenants charged"
    //     Bar = fee collection rate (what % of accrued fees have been paid).
    //     Low bar = fees growing faster than they're being cleared → escalating risk.
    //     This is a different signal from Outstanding (principal) — a tenant can
    //     have paid their rent but still owe late fees from a prior late payment.
    //
    //   NO ACTIVE FEES → positive confirmation: "No late fees this month"
    //     This is genuinely meaningful. It means tenants are paying on time.
    //     Completely different from Outstanding=0 (which just means balances cleared).
    //
    const hasActiveFees = kpi.hasActiveFees ?? false;
    const lateFeeOutstanding = kpi.lateFeeOutstanding ?? 0;
    const lateFeeAccrued = kpi.lateFeeAccrued ?? 0;
    const lateFeeTenantsCharged = kpi.lateFeeTenantsCharged ?? 0;
    const feeCollectionRate = kpi.feeCollectionRate ?? 0;

    const lateFeeTileProps = hasActiveFees
        ? {
            label: "Late Fees",
            value: fmt(lateFeeOutstanding),
            valueColor: lateFeeOutstanding > 0 ? "#B02020" : "#2E7A4A",
            sub: `${lateFeeTenantsCharged} tenant${lateFeeTenantsCharged !== 1 ? "s" : ""} being charged · ${feeCollectionRate}% cleared`,
            bar: {
                type: "simple",
                pct: feeCollectionRate,
                color: feeCollectionRate >= 80 ? "#2E7A4A"
                    : feeCollectionRate >= 40 ? "#C4721A"
                        : "#B02020",
            },
            icon: Receipt,
            iconBg: "#F5D5D5",
            iconColor: "#B02020",
            borderColor: "rgba(176,32,32,0.25)",
        }
        : {
            label: "Late Fees",
            value: "None",
            valueColor: "#2E7A4A",
            sub: "All tenants paying on time",
            bar: { type: "simple", pct: 100, color: "#2E7A4A" },
            icon: Receipt,
            iconBg: "#D4EDE0",
            iconColor: "#2E7A4A",
            borderColor: "#DDD6D0",
        };

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

            {/* 1 — Collected */}
            <Tile dark loading={loading} label="Collected"
                value={fmtFull(kpi.totalReceived)} sub={collectedSub}
                bar={{ type: "stacked", rentPct, camPct }}
                icon={Wallet} iconBg="rgba(255,255,255,0.08)" iconColor="#DDA8A8"
                to="/rent-payment"
            />

            {/* 2 — Outstanding / Collection Coverage */}
            <Tile loading={loading} to="/dashboard/transactions" {...outstandingTileProps} />

            {/* 3 — Vacancy */}
            <Tile loading={loading} {...vacancyTileProps} />

            {/* 4 — Late Fees: the only tile that surfaces penalty data */}
            <Tile loading={loading} to="/rent-payment" {...lateFeeTileProps} />

        </div>
    );
}