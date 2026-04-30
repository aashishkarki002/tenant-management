import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Wrench, Zap } from "lucide-react";
import { formatRupeesCompact } from "@/lib/formatters";

// ─── Reduced-motion preference ────────────────────────────────────────────────
function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(
        () =>
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const handler = (e) => setReduced(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return reduced;
}

// ─── Keyframe injection (once) ────────────────────────────────────────────────
const KPI_STYLE = [
    "@keyframes kpi-pulse{0%,100%{opacity:1}50%{opacity:.55}}",
    "@keyframes kpi-tick-in{0%{opacity:0;transform:scaleY(0.3) scaleX(0.7)}60%{opacity:1;transform:scaleY(1.12) scaleX(1)}100%{opacity:1;transform:scaleY(1) scaleX(1)}}",
].join("");

function KpiStyleOnce() {
    useEffect(() => {
        if (document.getElementById("kpi-strip-style")) return;
        const el = document.createElement("style");
        el.id = "kpi-strip-style";
        el.textContent = KPI_STYLE;
        document.head.appendChild(el);
    }, []);
    return null;
}

// ─── Trend pill ────────────────────────────────────────────────────────────────
const TREND_CLS = {
    up: "text-[color:var(--color-success)] bg-[color:var(--color-success-bg)] border border-[color:var(--color-success-border)]",
    down: "text-[color:var(--color-danger)] bg-[color:var(--color-danger-bg)] border border-[color:var(--color-danger-border)]",
    flat: "text-[color:var(--color-text-sub)] bg-[color:var(--color-surface-raised)] border border-[color:var(--color-border)]",
};

function TrendPill({ dir = "flat", children }) {
    return (
        <span
            className={`inline-flex items-center gap-[3px] px-[7px] py-[3px] rounded-full text-[10px] font-semibold leading-none whitespace-nowrap ${TREND_CLS[dir]}`}
        >
            {dir === "up" && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17l10-10M7 7h10v10" />
                </svg>
            )}
            {dir === "down" && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 7L7 17M17 17H7V7" />
                </svg>
            )}
            {children}
        </span>
    );
}

// ─── Animated bar pct hook ─────────────────────────────────────────────────────
function useAnimatedPct(target) {
    const reduced = usePrefersReducedMotion();
    const [pct, setPct] = useState(0);
    const raf = useRef(null);
    useEffect(() => {
        if (reduced) { setPct(target); return; }
        setPct(0);
        raf.current = requestAnimationFrame(() => {
            raf.current = requestAnimationFrame(() => setPct(target));
        });
        return () => cancelAnimationFrame(raf.current);
    }, [target, reduced]);
    return pct;
}

// ─── Simple animated bar ───────────────────────────────────────────────────────
function SimpleBar({ pct, colorVar }) {
    const display = useAnimatedPct(Math.min(100, pct));
    return (
        <div className="h-[6px] rounded-full overflow-hidden bg-[color:var(--color-muted-fill)]">
            <span
                className="block h-full rounded-full transition-[width] duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${display}%`, background: colorVar ?? "var(--color-accent)" }}
            />
        </div>
    );
}

// ─── Occupancy bar ─────────────────────────────────────────────────────────────
function OccBar({ pct }) {
    const display = useAnimatedPct(Math.min(100, pct));
    return (
        <div className="h-[6px] rounded-full overflow-hidden bg-[color:var(--color-muted-fill)]">
            <span
                className="block h-full rounded-full transition-[width] duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)] bg-[color:var(--color-accent)]"
                style={{ width: `${display}%` }}
            />
        </div>
    );
}

// ─── Tenant status row ─────────────────────────────────────────────────────────
function TenantStatusRow({ label, count, total, colorVar, sub }) {
    const pct = total > 0 ? (count / total) * 100 : 0;
    const display = useAnimatedPct(pct);
    if (count <= 0) return null;
    return (
        <div className="flex flex-col gap-[4px]">
            <div className="flex items-center justify-between text-[10.5px]">
                <span className="flex items-center gap-[5px] font-medium text-[color:var(--color-text-sub)]">
                    <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: colorVar }} />
                    {label}
                </span>
                <span className="font-mono font-semibold tabular-nums text-[color:var(--color-text-strong)]">
                    {count}
                    {sub && (
                        <span className="font-sans font-normal text-[9.5px] text-[color:var(--color-text-sub)] ml-[5px]">
                            {sub}
                        </span>
                    )}
                </span>
            </div>
            <div className="h-[5px] rounded-full overflow-hidden bg-[color:var(--color-muted-fill)]">
                <span
                    className="block h-full rounded-full transition-[width] duration-[750ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ width: `${display}%`, background: colorVar }}
                />
            </div>
        </div>
    );
}

// ─── Tenant status viz ─────────────────────────────────────────────────────────
function TenantStatusViz({ activeTenants, tenantsPaid, partiallyPaid, trulyOverdueCount, daysUntilDue, oldestOverdueDays, pendingCheques }) {
    const pending = Math.max(0, activeTenants - tenantsPaid - partiallyPaid - trulyOverdueCount);
    const dueSub = daysUntilDue != null && daysUntilDue > 0 ? `due in ${Math.round(daysUntilDue)}d` : null;
    const overdueSub = oldestOverdueDays > 0 ? `${oldestOverdueDays}d longest` : null;
    return (
        <div className="flex flex-col gap-[8px]">
            <TenantStatusRow
                label="Paid"
                count={tenantsPaid}
                total={activeTenants}
                colorVar="var(--color-success)"
            />
            <TenantStatusRow
                label="Partial"
                count={partiallyPaid}
                total={activeTenants}
                colorVar="var(--color-warning)"
            />
            <TenantStatusRow
                label="Pending"
                count={pending}
                total={activeTenants}
                colorVar="var(--color-accent)"
                sub={dueSub}
            />
            <TenantStatusRow
                label="Overdue"
                count={trulyOverdueCount}
                total={activeTenants}
                colorVar="var(--color-danger)"
                sub={overdueSub}
            />
            {pendingCheques > 0 && (
                <div className="flex items-center gap-[5px] text-[9.5px] font-medium text-[color:var(--color-text-sub)] pt-[3px] border-t border-[color:var(--color-border)]">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <path d="M2 10h20" />
                    </svg>
                    {pendingCheques} cheque{pendingCheques !== 1 ? "s" : ""} pending clearance
                </div>
            )}
        </div>
    );
}

// ─── Fulfillment Ring ──────────────────────────────────────────────────────────
const RING_R = 34;
const RING_C = 2 * Math.PI * RING_R;

const ARC = {
    mRent: "var(--color-accent)",
    mCam: "var(--color-info, #38bdf8)",
    qRent: "var(--color-warning)",
    qCam: "var(--color-success)",
};

function RingGroupHeader({ label }) {
    return (
        <div className="text-[9px] font-bold tracking-[0.1em] uppercase text-[color:var(--color-text-sub)] pt-[3px]">
            {label}
        </div>
    );
}

function RingRow({ swColor, label, value, weak }) {
    return (
        <div className="grid items-center gap-[6px] text-[11px] font-medium leading-[1.2]" style={{ gridTemplateColumns: "auto 1fr auto" }}>
            <span className="w-[7px] h-[7px] rounded-[2px] shrink-0" style={{ background: swColor }} />
            <span className="text-[color:var(--color-text-sub)]">{label}</span>
            <span
                className={`font-mono tabular-nums font-semibold ${weak ? "text-[color:var(--color-text-sub)]" : "text-[color:var(--color-text-strong)]"}`}
            >
                {value}
            </span>
        </div>
    );
}

function FulfillmentRing({
    totalBilled, monthlyRent, monthlyCam, quarterlyRent, quarterlyCam,
    totalReceived, collectionRate,
}) {
    const reduced = usePrefersReducedMotion();
    const safeTotal = totalBilled > 0 ? totalBilled : 1;
    const toArc = (v) => Math.max(0, Math.min(RING_C, (v / safeTotal) * RING_C));

    const mRentArc = toArc(monthlyRent);
    const mCamArc = toArc(monthlyCam);
    const qRentArc = toArc(quarterlyRent);
    const qCamArc = toArc(quarterlyCam);

    const off0 = 0;
    const off1 = -(mRentArc);
    const off2 = -(mRentArc + mCamArc);
    const off3 = -(mRentArc + mCamArc + qRentArc);

    const [drawn, setDrawn] = useState(false);
    const drawRaf = useRef(null);
    useEffect(() => {
        setDrawn(false);
        if (reduced) { setDrawn(true); return; }
        drawRaf.current = requestAnimationFrame(() => {
            drawRaf.current = requestAnimationFrame(() => setDrawn(true));
        });
        return () => cancelAnimationFrame(drawRaf.current);
    }, [mRentArc, mCamArc, qRentArc, qCamArc, reduced]);

    const da = (arc) => `${drawn ? arc : 0} ${RING_C}`;
    const tr = (delay) =>
        reduced ? "none" : `stroke-dasharray 750ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`;

    const remaining = Math.max(0, totalBilled - totalReceived);
    const hasQuarterly = quarterlyRent > 0 || quarterlyCam > 0;

    return (
        <div className="grid items-center gap-3" style={{ gridTemplateColumns: "86px 1fr" }}>
            {/* Donut */}
            <div className="relative w-[86px] h-[86px] shrink-0">
                <svg width="86" height="86" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="40" cy="40" r={RING_R} stroke="var(--color-muted-fill)" strokeWidth={10} fill="none" />
                    {mRentArc > 0 && (
                        <circle cx="40" cy="40" r={RING_R} stroke={ARC.mRent} strokeWidth={10} fill="none"
                            strokeLinecap="butt" strokeDasharray={da(mRentArc)} strokeDashoffset={`${off0}`}
                            style={{ transition: tr(0) }} />
                    )}
                    {mCamArc > 0 && (
                        <circle cx="40" cy="40" r={RING_R} stroke={ARC.mCam} strokeWidth={10} fill="none"
                            strokeLinecap="butt" strokeDasharray={da(mCamArc)} strokeDashoffset={`${off1}`}
                            style={{ transition: tr(80) }} />
                    )}
                    {qRentArc > 0 && (
                        <circle cx="40" cy="40" r={RING_R} stroke={ARC.qRent} strokeWidth={10} fill="none"
                            strokeLinecap="butt" strokeDasharray={da(qRentArc)} strokeDashoffset={`${off2}`}
                            style={{ transition: tr(160) }} />
                    )}
                    {qCamArc > 0 && (
                        <circle cx="40" cy="40" r={RING_R} stroke={ARC.qCam} strokeWidth={10} fill="none"
                            strokeLinecap="butt" strokeDasharray={da(qCamArc)} strokeDashoffset={`${off3}`}
                            style={{ transition: tr(240) }} />
                    )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[19px] font-bold leading-none font-mono tabular-nums text-[color:var(--color-text-strong)]">
                        {collectionRate}%
                    </span>
                    <span className="text-[8.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--color-text-sub)] mt-[3px]">
                        of {formatRupeesCompact(totalBilled)}
                    </span>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-[3px] min-w-0">
                <RingGroupHeader label="Monthly" />
                {monthlyRent > 0 && <RingRow swColor={ARC.mRent} label="Rent" value={formatRupeesCompact(monthlyRent)} />}
                {monthlyCam > 0 && <RingRow swColor={ARC.mCam} label="CAM" value={formatRupeesCompact(monthlyCam)} />}
                {hasQuarterly && (
                    <>
                        <RingGroupHeader label="Quarterly" />
                        {quarterlyRent > 0 && <RingRow swColor={ARC.qRent} label="Rent" value={formatRupeesCompact(quarterlyRent)} />}
                        {quarterlyCam > 0 && <RingRow swColor={ARC.qCam} label="CAM" value={formatRupeesCompact(quarterlyCam)} />}
                    </>
                )}
                {remaining > 0 && (
                    <RingRow swColor="var(--color-muted-fill)" label="Remaining" value={formatRupeesCompact(remaining)} weak />
                )}
            </div>
        </div>
    );
}

// ─── Attention chip ────────────────────────────────────────────────────────────
function AttentionChip({ count, label, colorVar, Icon }) {
    return (
        <span
            className="inline-flex items-center gap-[3px] pl-[5px] pr-[7px] py-[3px] rounded-full text-[10px] font-semibold whitespace-nowrap"
            style={{
                background: `color-mix(in srgb, ${colorVar} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${colorVar} 25%, transparent)`,
                color: colorVar,
            }}
        >
            <Icon style={{ width: 9, height: 9 }} />
            {count} {label}
        </span>
    );
}

// ─── KPI card shell ────────────────────────────────────────────────────────────
function KpiCard({ to, loading, label, trend, value, valueSuffix, children, borderColor }) {
    const inner = (
        <div
            className="bg-[color:var(--color-surface-raised)] rounded-[14px] p-[12px_14px_11px] shadow-[var(--shadow-card)] flex flex-col gap-2 min-w-0 h-full box-border"
            style={{ border: `1px solid ${borderColor ?? "var(--color-border)"}` }}
        >
            {/* Top row */}
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-text-sub)]">
                    {label}
                </span>
                {trend}
            </div>

            {/* Hero value */}
            {loading ? (
                <div className="h-6 w-[120px] rounded-md bg-[color:var(--color-muted-fill)] animate-pulse" />
            ) : (
                <span className="text-[22px] font-bold leading-[1.05] font-mono tabular-nums tracking-[-0.01em] text-[color:var(--color-text-strong)]">
                    {value}
                    {valueSuffix && (
                        <small className="text-[11px] font-medium font-sans text-[color:var(--color-text-weak)] ml-1">
                            {valueSuffix}
                        </small>
                    )}
                </span>
            )}

            {/* Slot */}
            {!loading && children}
        </div>
    );

    if (!to) return inner;
    return (
        <Link
            to={to}
            className="no-underline block h-full transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[14px]"
        >
            {inner}
        </Link>
    );
}

// ─── KpiStrip ─────────────────────────────────────────────────────────────────
export default function KpiStrip({ stats, loading }) {
    const kpi = stats?.kpi ?? {};
    const attention = stats?.attention ?? {};

    // ── Card 1: Collected ───────────────────────────────────────────────────────
    const totalReceived = kpi.totalReceived ?? 0;
    const rentCollected = kpi.rentCollected ?? 0;
    const camCollected = kpi.camCollected ?? 0;
    const lateFeeCollected = kpi.lateFeeCollected ?? kpi.lateFeeOutstanding ?? 0;
    const totalBilled = kpi.totalBilled ?? 0;
    const collectionRate = kpi.collectionRate ?? 0;

    const monthlyRent = kpi.monthlyRent ?? rentCollected;
    const monthlyCam = kpi.monthlyCam ?? 0;
    const quarterlyRent = kpi.quarterlyRent ?? 0;
    const quarterlyCam = kpi.quarterlyCam ?? (kpi.monthlyCam != null ? 0 : camCollected);

    const cRate = collectionRate >= 80 ? "up" : collectionRate >= 50 ? "flat" : "down";

    // ── Card 2: Tenant Status ───────────────────────────────────────────────────
    const allClear = kpi.allClear ?? false;
    const collectionPhase = kpi.collectionPhase ?? "overdue";
    const daysUntilDue = kpi.daysUntilDue ?? null;
    const activeTenants = kpi.activeTenants ?? 0;
    const tenantsPaid = kpi.tenantsPaid ?? 0;
    const trulyOverdueCount = kpi.trulyOverdueCount ?? attention.overdueCount ?? 0;
    const partiallyPaid = kpi.partiallyPaid ?? 0;
    const oldestOverdueDays = kpi.oldestOverdueDays ?? 0;
    const pendingCheques = kpi.pendingCheques ?? 0;

    const tilePhase = allClear ? "all_clear" : collectionPhase;
    const pendingCount = Math.max(0, activeTenants - tenantsPaid - partiallyPaid - trulyOverdueCount);
    const paidRatio = activeTenants > 0 ? `${tenantsPaid}/${activeTenants}` : "—";
    const paidPct = activeTenants > 0 ? Math.round((tenantsPaid / activeTenants) * 100) : 0;

    let outLabel, outTrend, outBorderColor;

    if (tilePhase === "all_clear") {
        outLabel = "Tenant Status";
        outTrend = <TrendPill dir="up">All paid</TrendPill>;
        outBorderColor = "var(--color-success-border)";
    } else if (tilePhase === "pending") {
        outLabel = "Tenant Status";
        outTrend = pendingCount > 0
            ? <TrendPill dir="flat">{pendingCount} pending{daysUntilDue != null ? ` · ${Math.round(daysUntilDue)}d` : ""}</TrendPill>
            : <TrendPill dir="up">All on track</TrendPill>;
        outBorderColor = pendingCount > 0 ? "var(--color-border)" : "var(--color-success-border)";
    } else if (tilePhase === "due_soon") {
        outLabel = "Tenant Status · Due Soon";
        outTrend = <TrendPill dir="down">{pendingCount} pending · {Math.round(daysUntilDue ?? 0)}d</TrendPill>;
        outBorderColor = "var(--color-warning-border)";
    } else {
        outLabel = "Tenant Status · Overdue";
        outTrend = <TrendPill dir="down">{trulyOverdueCount} overdue</TrendPill>;
        outBorderColor = "var(--color-danger-border)";
    }

    // ── Card 3: Occupancy ───────────────────────────────────────────────────────
    const occupancyRate = kpi.occupancyRate ?? 0;
    const totalUnits = kpi.totalUnits ?? 0;
    const occupiedUnits = kpi.occupiedUnits ?? 0;
    const vacantUnits = kpi.vacantUnits ?? 0;
    const underNotice = kpi.underNotice ?? attention.expiringLeases ?? 0;
    const fullyOccupied = kpi.fullyOccupied ?? false;
    const occDir = fullyOccupied ? "up" : occupancyRate >= 80 ? "flat" : "down";

    // ── Card 4: Needs Attention ─────────────────────────────────────────────────
    const overdueAlerts = kpi.trulyOverdueCount ?? attention.overdueCount ?? 0;
    const expiringLeases = Array.isArray(stats?.contractsEndingSoon)
        ? stats.contractsEndingSoon.filter((c) => (c.daysUntilEnd ?? 999) <= 45).length
        : attention.expiringLeases ?? 0;
    const openMaintenance = Array.isArray(stats?.maintenance)
        ? stats.maintenance.filter((m) =>
            ["OPEN", "IN_PROGRESS"].includes((m.status ?? "").toUpperCase())
        ).length
        : 0;
    const generatorAlerts = Array.isArray(stats?.generatorsDueService)
        ? stats.generatorsDueService.length
        : 0;

    const totalAttention = overdueAlerts + expiringLeases + openMaintenance + generatorAlerts;
    const allGood = totalAttention === 0;
    const attDir = allGood ? "up" : overdueAlerts > 0 ? "down" : "flat";
    const attBorderColor = allGood
        ? "var(--color-border)"
        : overdueAlerts > 0
            ? "var(--color-danger-border)"
            : "var(--color-warning-border)";

    return (
        <div className="grid gap-[10px] items-stretch grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <KpiStyleOnce />

            {/* 1 · Collected */}
            <KpiCard
                to="/rent-payment"
                loading={loading}
                label="Collected · MTD"
                trend={<TrendPill dir={cRate}>{collectionRate}%</TrendPill>}
                value={formatRupeesCompact(totalReceived)}
            >
                <FulfillmentRing
                    totalBilled={totalBilled}
                    monthlyRent={monthlyRent}
                    monthlyCam={monthlyCam}
                    quarterlyRent={quarterlyRent}
                    quarterlyCam={quarterlyCam}
                    totalReceived={totalReceived}
                    collectionRate={collectionRate}
                />
            </KpiCard>

            {/* 2 · Tenant Status */}
            <KpiCard
                to="/dashboard/transactions"
                loading={loading}
                label={outLabel}
                trend={outTrend}
                value={paidRatio}
                valueSuffix={activeTenants > 0 ? `· ${paidPct}% paid` : undefined}
                borderColor={outBorderColor}
            >
                <TenantStatusViz
                    activeTenants={activeTenants}
                    tenantsPaid={tenantsPaid}
                    partiallyPaid={partiallyPaid}
                    trulyOverdueCount={trulyOverdueCount}
                    daysUntilDue={daysUntilDue}
                    oldestOverdueDays={oldestOverdueDays}
                    pendingCheques={pendingCheques}
                />
            </KpiCard>

            {/* 3 · Occupancy */}
            <KpiCard
                to="/dashboard/units"
                loading={loading}
                label="Occupancy"
                trend={
                    <TrendPill dir={occDir}>
                        {fullyOccupied ? "Full" : `${occupancyRate}%`}
                    </TrendPill>
                }
                value={totalUnits > 0 ? `${occupiedUnits}/${totalUnits}` : `${occupancyRate}%`}
                valueSuffix={totalUnits > 0 ? `· ${occupancyRate}% occupied` : undefined}
                borderColor={occupancyRate < 70 ? "var(--color-warning-border)" : "var(--color-border)"}
            >
                <OccBar pct={occupancyRate} />
                <div className="flex justify-between text-[10.5px] font-medium text-[color:var(--color-text-sub)]">
                    <span>{vacantUnits} vacant</span>
                    {underNotice > 0 && (
                        <span>
                            <b className="text-[color:var(--color-text-strong)] font-semibold">{underNotice}</b>{" "}
                            under notice
                        </span>
                    )}
                </div>
            </KpiCard>

            {/* 4 · Needs Attention */}
            <KpiCard
                to="/dashboard"
                loading={loading}
                label="Needs Attention"
                trend={
                    allGood ? (
                        <TrendPill dir="up">All clear</TrendPill>
                    ) : (
                        <TrendPill dir={attDir}>
                            {totalAttention} item{totalAttention !== 1 ? "s" : ""}
                        </TrendPill>
                    )
                }
                value={allGood ? "Clear" : String(totalAttention)}
                borderColor={attBorderColor}
            >
                {allGood ? (
                    <>
                        <SimpleBar pct={100} colorVar="var(--color-success)" />
                        <span className="text-[10.5px] text-[color:var(--color-text-sub)]">
                            No overdue rents, expiring leases, or open maintenance
                        </span>
                    </>
                ) : (
                    <div className="flex flex-wrap gap-[5px]">
                        {overdueAlerts > 0 && (
                            <AttentionChip
                                count={overdueAlerts}
                                label="overdue"
                                colorVar="var(--color-danger)"
                                Icon={AlertTriangle}
                            />
                        )}
                        {expiringLeases > 0 && (
                            <AttentionChip
                                count={expiringLeases}
                                label={expiringLeases === 1 ? "lease" : "leases"}
                                colorVar="var(--color-warning)"
                                Icon={CalendarClock}
                            />
                        )}
                        {openMaintenance > 0 && (
                            <AttentionChip
                                count={openMaintenance}
                                label="maint."
                                colorVar="var(--color-text-sub)"
                                Icon={Wrench}
                            />
                        )}
                        {generatorAlerts > 0 && (
                            <AttentionChip
                                count={generatorAlerts}
                                label={generatorAlerts === 1 ? "generator" : "generators"}
                                colorVar="var(--color-warning)"
                                Icon={Zap}
                            />
                        )}
                    </div>
                )}
            </KpiCard>
        </div>
    );
}
