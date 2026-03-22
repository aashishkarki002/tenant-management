/**
 * AccountingPrimitives.jsx
 *
 * Shared UI atom components that were previously defined inline at the top of
 * the 1 767-line AccountingPage.jsx.
 *
 * Extracted to this file so they can be:
 *   • imported by AccountingPage, OverviewTab, tabs/* without circular deps
 *   • unit-tested independently
 *   • restyled once without touching every consumer
 *
 * None of these components contain any business logic or data fetching.
 */

import { cn } from "@/lib/utils";
import { ArrowUpRightIcon, ArrowDownRightIcon } from "lucide-react";

// ── Layout cards ──────────────────────────────────────────────────────────────

export function Card({ children, className = "" }) {
    return (
        <div className={cn(
            "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5",
            className,
        )}>
            {children}
        </div>
    );
}

export function DarkCard({ children, className = "" }) {
    return (
        <div className={cn("rounded-2xl bg-[var(--color-accent)] p-5", className)}>
            {children}
        </div>
    );
}

// ── Text atoms ────────────────────────────────────────────────────────────────

/** Section label — tiny uppercase tracking caps */
export function Lbl({ children, light = false, className = "" }) {
    return (
        <div className={cn(
            "text-[10px] font-bold tracking-[0.1em] uppercase mb-2",
            light ? "text-white/45" : "text-[var(--color-text-sub)]",
            className,
        )}>
            {children}
        </div>
    );
}

/** Trend delta pill — green for positive, red for negative */
export function Delta({ value, label }) {
    const up = value >= 0;
    return (
        <span className={cn(
            "inline-flex items-center gap-[3px] text-[11px] font-bold px-2 py-0.5 rounded-full",
            up
                ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                : "bg-[var(--color-danger-bg)]  text-[var(--color-danger)]",
        )}>
            {up ? <ArrowUpRightIcon size={11} /> : <ArrowDownRightIcon size={11} />}
            {label ?? `${Math.abs(value).toFixed(1)}%`}
        </span>
    );
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

/** Inline horizontal progress bar */
export function ProgBar({ value, max, color = "var(--color-accent)", h = 5 }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div
            className="flex-1 overflow-hidden bg-[var(--color-border)]"
            style={{ height: h, borderRadius: h / 2 }}>
            <div style={{
                height: "100%", width: `${pct}%`, background: color,
                borderRadius: h / 2, transition: "width .6s ease",
            }} />
        </div>
    );
}

/** Mini SVG sparkline */
export function Spark({ data = [], color = "var(--color-accent)", h = 32 }) {
    if (data.length < 2) return <div style={{ height: h }} />;
    const vals = data.map(d => d.v ?? 0);
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
    const W = 110;
    const pts = vals.map((v, i) =>
        `${(i / (vals.length - 1)) * W},${h - ((v - mn) / rng) * h * 0.85}`,
    ).join(" ");
    const last = { x: W, y: h - ((vals.at(-1) - mn) / rng) * h * 0.85 };
    return (
        <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} style={{ overflow: "visible" }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8}
                strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={last.x} cy={last.y} r={3} fill={color} />
        </svg>
    );
}

/** Semi-circle gauge */
export function Gauge({ pct, color = "var(--color-accent)" }) {
    const r = 48, cx = 60, cy = 58;
    const cl = Math.max(0, Math.min(1, pct));
    const angle = Math.PI + cl * Math.PI;
    const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
    return (
        <svg width={120} height={66} viewBox="0 0 120 66">
            <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none" stroke="var(--color-border)" strokeWidth={9} strokeLinecap="round" />
            {cl > 0 && (
                <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${cl > 0.5 ? 1 : 0} 1 ${x} ${y}`}
                    fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
            )}
            <circle cx={x} cy={y} r={5} fill={color} />
        </svg>
    );
}

/** Recharts tooltip styled for the petrol theme */
export function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl shadow-xl min-w-[160px] bg-[var(--color-accent)] px-3.5 py-2.5">
            <div className="text-[10px] font-bold tracking-[0.1em] uppercase mb-2 text-white/40">{label}</div>
            {payload.map(p => (
                <div key={p.dataKey} className="flex items-center gap-2 text-xs text-white mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: p.fill ?? p.color }} />
                    <span className="opacity-65 flex-1">{p.name}</span>
                    <span className="font-bold">
                        {p.dataKey === "net"
                            ? `${(p.value ?? 0) >= 0 ? "+" : "−"}₹${Math.abs(p.value || 0).toLocaleString()}`
                            : `₹${Math.abs(p.value || 0).toLocaleString()}`}
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Animated loading placeholder */
export function Skeleton({ h = 32 }) {
    return (
        <div
            className="rounded-lg bg-[var(--color-surface)] animate-pulse"
            style={{ height: h }}
        />
    );
}