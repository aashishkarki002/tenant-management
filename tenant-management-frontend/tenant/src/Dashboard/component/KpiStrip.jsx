import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// ─── Reduced-motion preference ────────────────────────────────────────────────
function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(
        () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
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

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmt(val) {
    if (val == null || val === "") return "—";
    const n = Number(val);
    if (Number.isNaN(n)) return String(val);
    if (n >= 1_000_000) return `Rs. ${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 100_000)   return `Rs. ${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000)     return `Rs. ${(n / 1_000).toFixed(0)}k`;
    return `Rs. ${n.toLocaleString()}`;
}

// ─── Trend pill ────────────────────────────────────────────────────────────────

function TrendPill({ dir = "flat", children }) {
    const styles = {
        up:   { color: "var(--color-success)",  background: "var(--color-success-bg)",  border: "1px solid var(--color-success-border)" },
        down: { color: "var(--color-danger)",   background: "var(--color-danger-bg)",   border: "1px solid var(--color-danger-border)"  },
        flat: { color: "var(--color-text-sub)", background: "var(--color-surface-raised)", border: "1px solid var(--color-border)"     },
    };
    return (
        <span
            style={{
                ...styles[dir],
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "3px 7px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 600,
                lineHeight: 1,
                whiteSpace: "nowrap",
            }}
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

// ─── Animated bar base ─────────────────────────────────────────────────────────

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

// ─── Segmented bar (Collected card) ───────────────────────────────────────────

function SegmentedBar({ segments }) {
    // segments: [{ pct, color }]
    const total = Math.min(100, segments.reduce((s, x) => s + x.pct, 0));
    const [display, setDisplay] = useState(false);
    const raf = useRef(null);
    useEffect(() => {
        setDisplay(false);
        raf.current = requestAnimationFrame(() => {
            raf.current = requestAnimationFrame(() => setDisplay(true));
        });
        return () => cancelAnimationFrame(raf.current);
    }, [total]);

    return (
        <div style={{
            height: 6, borderRadius: 999, overflow: "hidden", display: "flex",
            background: "var(--color-muted-fill)",
        }}>
            {segments.map((seg, i) => (
                <span
                    key={i}
                    style={{
                        display: "block",
                        height: "100%",
                        width: display ? `${seg.pct}%` : "0%",
                        background: seg.color,
                        transition: `width 750ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 60}ms`,
                    }}
                />
            ))}
        </div>
    );
}

function SegLegend({ items }) {
    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px 10px",
            fontSize: 10.5,
            fontWeight: 500,
            color: "var(--color-text-sub)",
            lineHeight: 1.2,
        }}>
            {items.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: item.color, flexShrink: 0 }} />
                        <span style={{ color: "var(--color-text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.label}
                        </span>
                    </span>
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--color-text-strong)", whiteSpace: "nowrap", marginLeft: 6 }}>
                        {item.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Aging ladder (Outstanding card) ──────────────────────────────────────────

function AgingLadder({ buckets }) {
    // buckets: [{ label, color, count, amount, flex }]
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
            <div style={{ display: "flex", gap: 2, borderRadius: 6, overflow: "hidden", height: 26 }}>
                {buckets.map((b, i) => (
                    <div
                        key={i}
                        style={{
                            flex: b.flex ?? 1,
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            padding: "0 6px",
                            background: b.color,
                            fontSize: 11,
                            fontWeight: 700,
                            fontFamily: "var(--font-mono, monospace)",
                            fontVariantNumeric: "tabular-nums",
                            color: "#fff",
                        }}
                    >
                        {b.count != null && (
                            <span style={{
                                position: "absolute",
                                top: -2,
                                left: 4,
                                fontSize: 9,
                                fontWeight: 600,
                                fontFamily: "var(--font-sans, sans-serif)",
                                background: "var(--color-surface)",
                                color: "var(--color-text-strong)",
                                padding: "2px 5px",
                                borderRadius: 999,
                                border: "1px solid var(--color-border)",
                            }}>
                                {b.count}
                            </span>
                        )}
                        {b.amount}
                    </div>
                ))}
            </div>
            <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
                fontSize: 9.5,
                fontWeight: 500,
                color: "var(--color-text-sub)",
                letterSpacing: "0.04em",
            }}>
                {buckets.map((b, i) => (
                    <span key={i} style={{
                        textAlign: i === 0 ? "left" : "right",
                        paddingRight: i === 0 ? 0 : 6,
                        paddingLeft: i === 0 ? 2 : 0,
                    }}>
                        {b.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ─── Occupancy bar (Occupancy card) ───────────────────────────────────────────

function OccBar({ pct }) {
    const display = useAnimatedPct(Math.min(100, pct));
    return (
        <div style={{ height: 6, background: "var(--color-muted-fill)", borderRadius: 999, overflow: "hidden" }}>
            <span style={{
                display: "block",
                height: "100%",
                width: `${display}%`,
                background: "var(--color-accent)",
                borderRadius: 999,
                transition: "width 750ms cubic-bezier(0.22, 1, 0.36, 1)",
            }} />
        </div>
    );
}

// ─── Fulfillment Ring (Collected card) ────────────────────────────────────────

const RING_R = 34;
const RING_C = 2 * Math.PI * RING_R; // ≈ 213.63

function RingRow({ swColor, label, value, weak }) {
    return (
        <div style={{
            display: "grid", gridTemplateColumns: "auto 1fr auto",
            alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 500, fontFamily: "var(--font-sans, sans-serif)",
            lineHeight: 1.2,
        }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: swColor, flexShrink: 0 }} />
            <span style={{ color: "var(--color-text-sub)" }}>{label}</span>
            <span style={{
                fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums",
                color: weak ? "var(--color-text-sub)" : "var(--color-text-strong)",
                fontWeight: 600,
            }}>
                {value}
            </span>
        </div>
    );
}

// Arc colors: monthly=blue family, quarterly=warm family
const ARC = {
    mRent: "var(--color-accent)",
    mCam:  "var(--color-info, #38bdf8)",
    qRent: "var(--color-warning)",
    qCam:  "var(--color-success)",
};

function RingGroupHeader({ label }) {
    return (
        <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--color-text-sub)",
            paddingTop: 3,
        }}>
            {label}
        </div>
    );
}

function FulfillmentRing({ totalBilled, monthlyRent, monthlyCam, quarterlyRent, quarterlyCam, totalReceived, collectionRate }) {
    const reduced = usePrefersReducedMotion();
    const safeTotal = totalBilled > 0 ? totalBilled : 1;
    const toArc = (v) => Math.max(0, Math.min(RING_C, (v / safeTotal) * RING_C));

    const mRentArc = toArc(monthlyRent);
    const mCamArc  = toArc(monthlyCam);
    const qRentArc = toArc(quarterlyRent);
    const qCamArc  = toArc(quarterlyCam);

    // Cumulative start offsets (negative = advance clockwise)
    const off0 = 0;
    const off1 = -(mRentArc);
    const off2 = -(mRentArc + mCamArc);
    const off3 = -(mRentArc + mCamArc + qRentArc);

    // Draw-in animation: animate stroke-dasharray from "0 C" → "arc C"
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

    const da  = (arc) => `${drawn ? arc : 0} ${RING_C}`;
    const tr  = (delay) => reduced ? "none" : `stroke-dasharray 750ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`;

    const remaining = Math.max(0, totalBilled - totalReceived);
    const hasQuarterly = quarterlyRent > 0 || quarterlyCam > 0;

    return (
        <div style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 12, alignItems: "center" }}>
            {/* Donut ring — 4 arcs draw in clockwise, staggered */}
            <div style={{ position: "relative", width: 86, height: 86, flexShrink: 0 }}>
                <svg width="86" height="86" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="40" cy="40" r={RING_R}
                        stroke="var(--color-muted-fill)" strokeWidth={10} fill="none" />
                    {mRentArc > 0 && (
                        <circle cx="40" cy="40" r={RING_R}
                            stroke={ARC.mRent} strokeWidth={10} fill="none"
                            strokeLinecap="butt"
                            strokeDasharray={da(mRentArc)}
                            strokeDashoffset={`${off0}`}
                            style={{ transition: tr(0) }} />
                    )}
                    {mCamArc > 0 && (
                        <circle cx="40" cy="40" r={RING_R}
                            stroke={ARC.mCam} strokeWidth={10} fill="none"
                            strokeLinecap="butt"
                            strokeDasharray={da(mCamArc)}
                            strokeDashoffset={`${off1}`}
                            style={{ transition: tr(80) }} />
                    )}
                    {qRentArc > 0 && (
                        <circle cx="40" cy="40" r={RING_R}
                            stroke={ARC.qRent} strokeWidth={10} fill="none"
                            strokeLinecap="butt"
                            strokeDasharray={da(qRentArc)}
                            strokeDashoffset={`${off2}`}
                            style={{ transition: tr(160) }} />
                    )}
                    {qCamArc > 0 && (
                        <circle cx="40" cy="40" r={RING_R}
                            stroke={ARC.qCam} strokeWidth={10} fill="none"
                            strokeLinecap="butt"
                            strokeDasharray={da(qCamArc)}
                            strokeDashoffset={`${off3}`}
                            style={{ transition: tr(240) }} />
                    )}
                </svg>
                <div style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", textAlign: "center",
                    pointerEvents: "none",
                }}>
                    <span style={{
                        fontSize: 19, fontWeight: 700, lineHeight: 1,
                        fontFamily: "var(--font-mono, monospace)",
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--color-text-strong)",
                    }}>
                        {collectionRate}%
                    </span>
                    <span style={{
                        fontSize: 8.5, fontWeight: 600, letterSpacing: "0.08em",
                        textTransform: "uppercase", color: "var(--color-text-sub)", marginTop: 3,
                    }}>
                        of {fmt(totalBilled)}
                    </span>
                </div>
            </div>

            {/* Grouped legend: Monthly → Rent + CAM, Quarterly → Rent + CAM */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <RingGroupHeader label="Monthly" />
                {monthlyRent > 0 && <RingRow swColor={ARC.mRent} label="Rent" value={fmt(monthlyRent)} />}
                {monthlyCam  > 0 && <RingRow swColor={ARC.mCam}  label="CAM"  value={fmt(monthlyCam)}  />}

                {hasQuarterly && (
                    <>
                        <RingGroupHeader label="Quarterly" />
                        {quarterlyRent > 0 && <RingRow swColor={ARC.qRent} label="Rent" value={fmt(quarterlyRent)} />}
                        {quarterlyCam  > 0 && <RingRow swColor={ARC.qCam}  label="CAM"  value={fmt(quarterlyCam)}  />}
                    </>
                )}

                {remaining > 0 && (
                    <RingRow swColor="var(--color-muted-fill)" label="Remaining" value={fmt(remaining)} weak />
                )}
            </div>
        </div>
    );
}

// ─── Cycle Strip (Pending card) ───────────────────────────────────────────────

function CycleLane({ title, subtitle, cells, type, paidCount, nowIdx, closingLabel, sweepDelay = 0 }) {
    const reduced = usePrefersReducedMotion();
    const [animPaid, setAnimPaid] = useState(reduced ? paidCount : 0);
    // tick phases: "hidden" → "entering" (kpi-tick-in, 300ms) → "pulsing" (kpi-pulse ∞)
    const [tickPhase, setTickPhase] = useState(reduced ? "pulsing" : "hidden");
    const raf = useRef(null);
    const timers = useRef([]);

    useEffect(() => {
        timers.current.forEach(clearTimeout);
        cancelAnimationFrame(raf.current);

        if (reduced) {
            setAnimPaid(paidCount);
            setTickPhase("pulsing");
            return;
        }

        setAnimPaid(0);
        setTickPhase("hidden");

        const SWEEP_MS = 520;
        const startDelay = sweepDelay;

        const t0 = setTimeout(() => {
            const t = performance.now();
            function frame(now) {
                const progress = Math.min(1, (now - t) / SWEEP_MS);
                // ease-out quad: decelerates as it approaches nowIdx
                const eased = 1 - (1 - progress) * (1 - progress);
                setAnimPaid(Math.round(eased * paidCount));
                if (progress < 1) {
                    raf.current = requestAnimationFrame(frame);
                } else {
                    // Sweep done — pop the tick in
                    setTickPhase("entering");
                    const t1 = setTimeout(() => setTickPhase("pulsing"), 320);
                    timers.current.push(t1);
                }
            }
            raf.current = requestAnimationFrame(frame);
        }, startDelay);
        timers.current = [t0];

        return () => {
            timers.current.forEach(clearTimeout);
            cancelAnimationFrame(raf.current);
        };
    }, [paidCount, nowIdx, reduced, sweepDelay]);

    return (
        <div style={{ display: "grid", gridTemplateColumns: "68px 1fr auto", alignItems: "center", gap: 8 }}>
            {/* Lane label */}
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", flexDirection: "column", gap: 2 }}>
                <b style={{ color: "var(--color-text-strong)", fontWeight: 700 }}>{title}</b>
                <span style={{ fontSize: 9.5, fontWeight: 500, color: "var(--color-text-sub)", letterSpacing: "0.04em", textTransform: "none" }}>
                    {subtitle}
                </span>
            </div>

            {/* Cell track */}
            <div style={{
                display: "flex", gap: 2, height: 18, padding: 2, borderRadius: 5,
                background: "var(--color-bg)", border: "1px solid var(--color-border)", overflow: "hidden",
            }}>
                {Array.from({ length: cells }, (_, i) => {
                    const isPaid = i < animPaid;
                    const isNow = tickPhase !== "hidden" && i === nowIdx;
                    const tickAnim =
                        tickPhase === "entering" ? "kpi-tick-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both"
                        : tickPhase === "pulsing"  ? "kpi-pulse 1.6s ease-in-out infinite"
                        : "none";
                    return (
                        <div
                            key={i}
                            style={{
                                flex: 1, borderRadius: 2, minWidth: 0, position: "relative",
                                background: isPaid
                                    ? (type === "q" ? "var(--color-warning)" : "var(--color-accent)")
                                    : "var(--color-muted-fill)",
                                boxShadow: isNow ? "0 0 0 1.5px var(--color-text-strong)" : "none",
                                animation: isNow ? tickAnim : "none",
                                zIndex: isNow ? 1 : 0,
                            }}
                        />
                    );
                })}
            </div>

            {/* Closing label */}
            <div style={{ fontSize: 10, fontWeight: 500, color: "var(--color-text-sub)", textAlign: "right", minWidth: 48, lineHeight: 1.2 }}>
                {closingLabel && (
                    <>
                        <b style={{ display: "block", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: "var(--color-text-strong)", fontVariantNumeric: "tabular-nums" }}>
                            {closingLabel}
                        </b>
                        to close
                    </>
                )}
            </div>
        </div>
    );
}

function CycleStrip({ collectionRate, daysUntilDue, tenantsPaid, activeTenants, pendingQuarterly }) {
    const MONTHLY = 30;
    const QUARTERLY = 12;

    // Estimate current day in the monthly cycle
    const nowIdx = daysUntilDue != null && daysUntilDue >= 0
        ? Math.max(0, Math.min(MONTHLY - 1, MONTHLY - Math.round(daysUntilDue) - 1))
        : Math.round((collectionRate / 100) * (MONTHLY - 1));

    const tenantRate = activeTenants > 0 ? tenantsPaid / activeTenants : collectionRate / 100;
    const mPaid = Math.round(tenantRate * (nowIdx + 1));

    // Quarterly: 12-week cycle, progresses at 1/3 pace of monthly
    const qNowIdx = Math.min(QUARTERLY - 1, Math.round(nowIdx / (MONTHLY / QUARTERLY)));
    const qPaid   = pendingQuarterly > 0 ? Math.max(0, qNowIdx - 1) : qNowIdx;

    const mClosedPct = Math.round(tenantRate * 100);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <CycleLane
                title="Monthly"
                subtitle="30-day cycle"
                cells={MONTHLY}
                type="m"
                paidCount={mPaid}
                nowIdx={nowIdx}
                sweepDelay={0}
                closingLabel={daysUntilDue != null && daysUntilDue > 0 ? `${Math.round(daysUntilDue)}d` : null}
            />
            <CycleLane
                title="Quarterly"
                subtitle="12-week cycle"
                cells={QUARTERLY}
                type="q"
                paidCount={qPaid}
                nowIdx={qNowIdx}
                sweepDelay={160}
                closingLabel={daysUntilDue != null && daysUntilDue > 0 ? `${Math.round(daysUntilDue * 3)}d` : null}
            />
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                paddingTop: 6, borderTop: "1px dashed var(--color-border)",
                fontSize: 10.5, fontWeight: 500, color: "var(--color-text-sub)",
            }}>
                <span>
                    Monthly <b style={{ fontFamily: "var(--font-mono, monospace)", fontVariantNumeric: "tabular-nums", color: "var(--color-text-strong)" }}>
                        {mClosedPct}%
                    </b> closed
                </span>
                <span style={{ color: "var(--color-text-weak)" }}>▲ = today</span>
            </div>
        </div>
    );
}

// ─── Simple animated bar ───────────────────────────────────────────────────────

function SimpleBar({ pct, colorVar }) {
    const display = useAnimatedPct(Math.min(100, pct));
    return (
        <div style={{ height: 6, background: "var(--color-muted-fill)", borderRadius: 999, overflow: "hidden" }}>
            <span style={{
                display: "block",
                height: "100%",
                width: `${display}%`,
                background: colorVar ?? "var(--color-accent)",
                borderRadius: 999,
                transition: "width 750ms cubic-bezier(0.22, 1, 0.36, 1)",
            }} />
        </div>
    );
}

// ─── KPI card shell ────────────────────────────────────────────────────────────

function KpiCard({ to, loading, label, trend, value, valueSuffix, children, borderColor }) {
    const inner = (
        <div style={{
            background: "var(--color-surface-raised)",
            border: `1px solid ${borderColor ?? "var(--color-border)"}`,
            borderRadius: 14,
            padding: "12px 14px 11px",
            boxShadow: "var(--shadow-card)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 0,
            height: "100%",
            boxSizing: "border-box",
        }}>
            {/* Top row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--color-text-sub)",
                }}>
                    {label}
                </span>
                {trend}
            </div>

            {/* Hero value */}
            {loading ? (
                <div style={{
                    height: 24,
                    width: 120,
                    borderRadius: 6,
                    background: "var(--color-muted-fill)",
                    animation: "pulse 1.5s ease-in-out infinite",
                }} />
            ) : (
                <span style={{
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1.05,
                    fontFamily: "var(--font-mono, monospace)",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.01em",
                    color: "var(--color-text-strong)",
                }}>
                    {value}
                    {valueSuffix && (
                        <small style={{
                            fontSize: 11,
                            fontWeight: 500,
                            fontFamily: "var(--font-sans, sans-serif)",
                            color: "var(--color-text-weak)",
                            marginLeft: 4,
                        }}>
                            {valueSuffix}
                        </small>
                    )}
                </span>
            )}

            {/* Slot for chart / bar / legend */}
            {!loading && children}
        </div>
    );

    if (!to) return inner;
    return (
        <Link
            to={to}
            style={{ textDecoration: "none", display: "block", height: "100%" }}
            className="transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[14px]"
        >
            {inner}
        </Link>
    );
}

// ─── KpiStrip ─────────────────────────────────────────────────────────────────

export default function KpiStrip({ stats, loading }) {
    const kpi = stats?.kpi ?? {};
    const attention = stats?.attention ?? {};

    // ── Card 1: Collected ─────────────────────────────────────────────────────
    const totalReceived  = kpi.totalReceived  ?? 0;
    const rentCollected  = kpi.rentCollected  ?? 0;
    const camCollected   = kpi.camCollected   ?? 0;
    const lateFeeCollected = kpi.lateFeeCollected ?? kpi.lateFeeOutstanding ?? 0;
    const otherCollected = Math.max(0, totalReceived - rentCollected - camCollected - lateFeeCollected);
    const totalBilled    = kpi.totalBilled    ?? 0;
    const collectionRate = kpi.collectionRate ?? 0;

    // Granular monthly / quarterly breakdown for the ring
    // Falls back to treating all rent as monthly and all CAM as quarterly
    const monthlyRent   = kpi.monthlyRent   ?? rentCollected;
    const monthlyCam    = kpi.monthlyCam    ?? 0;
    const quarterlyRent = kpi.quarterlyRent ?? 0;
    // Only fall back to camCollected for quarterly if no monthly CAM was explicitly provided,
    // otherwise we'd double-count the same CAM in both monthly and quarterly arcs.
    const quarterlyCam  = kpi.quarterlyCam  ?? (kpi.monthlyCam != null ? 0 : camCollected);

    const cRate = collectionRate >= 80 ? "up" : collectionRate >= 50 ? "flat" : "down";

    // segment widths relative to totalReceived
    const toSeg = (v) => totalReceived > 0 ? Math.round((v / totalReceived) * 100) : 0;
    const collectedSegments = [
        { pct: toSeg(rentCollected),    color: "var(--color-accent)"   },
        { pct: toSeg(camCollected),     color: "var(--color-success)"  },
        { pct: toSeg(lateFeeCollected), color: "var(--color-warning)"  },
        { pct: toSeg(otherCollected),   color: "var(--color-info)"     },
    ].filter(s => s.pct > 0);

    const collectedLegend = [
        { label: "Rent",       color: "var(--color-accent)",   value: fmt(rentCollected)    },
        { label: "CAM",        color: "var(--color-success)",  value: fmt(camCollected)     },
        { label: "Late fees",  color: "var(--color-warning)",  value: fmt(lateFeeCollected) },
        { label: "Other",      color: "var(--color-info)",     value: fmt(otherCollected)   },
    ].filter((_, i) => [rentCollected, camCollected, lateFeeCollected, otherCollected][i] > 0);

    // ── Card 2: Outstanding / Aging ───────────────────────────────────────────
    const allClear         = kpi.allClear         ?? false;
    const outstanding      = kpi.totalRemaining   ?? null;
    const collectionPhase  = kpi.collectionPhase  ?? "overdue";
    const daysUntilDue     = kpi.daysUntilDue     ?? null;
    const activeTenants    = kpi.activeTenants    ?? 0;
    const tenantsPaid      = kpi.tenantsPaid      ?? 0;
    const tenantCoverageRate = kpi.tenantCoverageRate ?? 0;
    const tenantsWithBalance = kpi.tenantsWithBalance ?? 0;
    const trulyOverdueCount  = kpi.trulyOverdueCount  ?? attention.overdueCount ?? 0;
    const dueSoonCount     = kpi.dueSoonCount     ?? 0;
    const pendingMonthly   = kpi.pendingMonthly   ?? 0;
    const pendingQuarterly = kpi.pendingQuarterly ?? 0;

    const tilePhase = allClear ? "all_clear" : collectionPhase;

    let outLabel, outValue, outTrend, outBorderColor, outViz;

    if (tilePhase === "all_clear") {
        outLabel  = "Collection Coverage";
        outValue  = activeTenants > 0 ? `${tenantsPaid}/${activeTenants}` : "—";
        outTrend  = <TrendPill dir="up">All paid</TrendPill>;
        outBorderColor = "var(--color-border)";
        outViz = (
            <>
                <SimpleBar pct={tenantCoverageRate} colorVar="var(--color-success)" />
                <span style={{ fontSize: 10.5, color: "var(--color-text-sub)" }}>
                    All tenants paid this cycle
                </span>
            </>
        );
    } else if (tilePhase === "pending") {
        const pendingCount = activeTenants - tenantsPaid;
        const allPaidEarly = activeTenants > 0 && tenantsPaid >= activeTenants;

        // Fraction of billing cycle elapsed (0 = start, 1 = due date)
        const cycleElapsed = daysUntilDue != null && daysUntilDue >= 0
            ? Math.max(0, 1 - daysUntilDue / 30)
            : 0.5;
        // On track = collected at least 85 % of what the elapsed fraction predicts
        const expectedRate = cycleElapsed * 100;
        const isOnTrack    = allPaidEarly || collectionRate >= expectedRate * 0.85;

        if (allPaidEarly) {
            outLabel       = "Collected · Ahead";
            outTrend       = <TrendPill dir="up">All paid early</TrendPill>;
            outBorderColor = "var(--color-success-border)";
        } else if (isOnTrack) {
            outLabel       = "Collection · On Track";
            outTrend       = <TrendPill dir="up">{pendingCount > 0 ? `${pendingCount} pending` : daysUntilDue != null && daysUntilDue > 0 ? `${Math.round(daysUntilDue)}d left` : "on track"}</TrendPill>;
            outBorderColor = "var(--color-success-border)";
        } else {
            outLabel       = "Collection · Lagging";
            outTrend       = <TrendPill dir="flat">{pendingCount > 0 ? `${pendingCount} tenants` : "behind pace"}</TrendPill>;
            outBorderColor = "var(--color-warning-border)";
        }

        outValue = outstanding != null ? fmt(outstanding) : "—";
        outViz = (
            <CycleStrip
                collectionRate={collectionRate}
                daysUntilDue={daysUntilDue}
                tenantsPaid={tenantsPaid}
                activeTenants={activeTenants}
                pendingQuarterly={pendingQuarterly}
            />
        );
    } else if (tilePhase === "due_soon") {
        const pendingCount = activeTenants - tenantsPaid;
        outLabel  = "Due Soon";
        outValue  = outstanding != null ? fmt(outstanding) : "—";
        outTrend  = <TrendPill dir="down">{pendingCount} tenants</TrendPill>;
        outBorderColor = "var(--color-warning-border)";
        outViz = (
            <>
                <SimpleBar pct={collectionRate} colorVar={collectionRate >= 60 ? "var(--color-warning)" : "var(--color-danger)"} />
                <span style={{ fontSize: 10.5, color: "var(--color-text-sub)" }}>
                    {daysUntilDue != null && daysUntilDue > 0 ? `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}` : "Due today"} · {collectionRate}% collected
                </span>
            </>
        );
    } else {
        // overdue — aging-ladder style using whatever split we have
        const overdueAmt   = outstanding ?? 0;
        // build 2–3 buckets from what we know
        const overdueMonthly  = kpi.overdueMonthly  ?? 0;
        const overdueQuarterly = kpi.overdueQuarterly ?? 0;
        const dueSoonAmt   = kpi.dueSoonAmount   ?? 0;
        const criticalAmt  = kpi.criticalAmount  ?? 0;

        // Fallback: split total into rough thirds if no granular data
        const b1Count = Math.max(0, trulyOverdueCount - Math.ceil(trulyOverdueCount / 2));
        const b2Count = Math.ceil(trulyOverdueCount / 2);
        const b1Amt   = overdueAmt > 0 ? overdueAmt * 0.4 : 0;
        const b2Amt   = overdueAmt > 0 ? overdueAmt * 0.6 : 0;

        const agingBuckets = [
            {
                label: "1–30d",
                color: "color-mix(in srgb, var(--color-warning) 60%, var(--color-surface))",
                count: b1Count > 0 ? b1Count : null,
                amount: fmt(b1Amt),
                flex: 1.2,
            },
            {
                label: "30d+",
                color: "var(--color-danger)",
                count: b2Count > 0 ? b2Count : null,
                amount: fmt(b2Amt),
                flex: 1.8,
            },
        ].filter(b => Number(b.flex) > 0);

        outLabel  = "Outstanding · Aging";
        outValue  = outstanding != null ? fmt(outstanding) : "—";
        outTrend  = <TrendPill dir="down">{trulyOverdueCount} tenants</TrendPill>;
        outBorderColor = "var(--color-danger-border)";
        outViz = <AgingLadder buckets={agingBuckets} />;
    }

    // ── Card 3: Occupancy ─────────────────────────────────────────────────────
    const occupancyRate  = kpi.occupancyRate  ?? 0;
    const totalUnits     = kpi.totalUnits     ?? 0;
    const occupiedUnits  = kpi.occupiedUnits  ?? 0;
    const vacantUnits    = kpi.vacantUnits    ?? 0;
    const underNotice    = kpi.underNotice    ?? attention.expiringLeases ?? 0;
    const fullyOccupied  = kpi.fullyOccupied  ?? false;

    const occDir = fullyOccupied ? "up" : occupancyRate >= 80 ? "flat" : "down";

    // ── Card 4: Late Fees ─────────────────────────────────────────────────────
    const hasActiveFees       = kpi.hasActiveFees       ?? false;
    const lateFeeOutstanding  = kpi.lateFeeOutstanding  ?? 0;
    const lateFeeTenantsCharged = kpi.lateFeeTenantsCharged ?? 0;
    const feeCollectionRate   = kpi.feeCollectionRate   ?? 0;

    const feeDir  = hasActiveFees ? (feeCollectionRate >= 60 ? "flat" : "down") : "up";
    const feeBorderColor = hasActiveFees && feeCollectionRate < 40
        ? "var(--color-danger-border)"
        : "var(--color-border)";

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, alignItems: "stretch" }}>
            <KpiStyleOnce />

            {/* 1 · Collected */}
            <KpiCard
                to="/rent-payment"
                loading={loading}
                label="Collected · MTD"
                trend={<TrendPill dir={cRate}>{collectionRate}%</TrendPill>}
                value={fmt(totalReceived)}
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

            {/* 2 · Outstanding / Aging */}
            <KpiCard
                to="/dashboard/transactions"
                loading={loading}
                label={outLabel}
                trend={outTrend}
                value={outValue}
                borderColor={outBorderColor}
            >
                {outViz}
            </KpiCard>

            {/* 3 · Occupancy */}
            <KpiCard
                to="/dashboard/units"
                loading={loading}
                label="Occupancy"
                trend={<TrendPill dir={occDir}>{fullyOccupied ? "Full" : `${occupancyRate}%`}</TrendPill>}
                value={totalUnits > 0 ? `${occupiedUnits}/${totalUnits}` : `${occupancyRate}%`}
                valueSuffix={totalUnits > 0 ? `· ${occupancyRate}% occupied` : undefined}
                borderColor={occupancyRate < 70 ? "var(--color-warning-border)" : "var(--color-border)"}
            >
                <OccBar pct={occupancyRate} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 500, color: "var(--color-text-sub)" }}>
                    <span>{vacantUnits} vacant</span>
                    {underNotice > 0 && (
                        <span>
                            <b style={{ color: "var(--color-text-strong)", fontWeight: 600 }}>{underNotice}</b> under notice
                        </span>
                    )}
                </div>
            </KpiCard>

            {/* 4 · Late Fees */}
            <KpiCard
                to="/rent-payment"
                loading={loading}
                label="Late Fees"
                trend={
                    hasActiveFees
                        ? <TrendPill dir={feeDir}>{lateFeeTenantsCharged} tenant{lateFeeTenantsCharged !== 1 ? "s" : ""}</TrendPill>
                        : <TrendPill dir="up">None</TrendPill>
                }
                value={hasActiveFees ? fmt(lateFeeOutstanding) : "Clear"}
                borderColor={feeBorderColor}
            >
                <SimpleBar
                    pct={hasActiveFees ? feeCollectionRate : 100}
                    colorVar={
                        !hasActiveFees ? "var(--color-success)"
                            : feeCollectionRate >= 80 ? "var(--color-success)"
                            : feeCollectionRate >= 40 ? "var(--color-warning)"
                            : "var(--color-danger)"
                    }
                />
                <span style={{ fontSize: 10.5, color: "var(--color-text-sub)" }}>
                    {hasActiveFees
                        ? `${feeCollectionRate}% cleared · ${lateFeeTenantsCharged} being charged`
                        : "All tenants paying on time"}
                </span>
            </KpiCard>

        </div>
    );
}
