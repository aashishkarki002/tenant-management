/**
 * AccountingPrimitives.jsx
 *
 * Normalized from audit findings:
 *   • DarkCard: hard-coded #0d2535 → var(--color-surface-invert) token
 *   • ChartTip: hard-coded gradient (#0a2f46 → #1a5276) → var(--color-surface-invert)
 *     (gradient was AI slop; flat surface reads cleaner and is theme-safe)
 *   • Skeleton: inline <style> shimmer keyframe moved to index.css;
 *     background updated to --color-muted-fill (semantically correct for loaders)
 *   • Spark: gradient IDs were shared across instances — fixed with useId()
 */

import { useId } from "react";
import { cn } from "@/lib/utils";
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react";

// ─── Layout cards ─────────────────────────────────────────────────────────────

export function Card({ children, className = "" }) {
    return (
        <div
            className={cn(
                "rounded-2xl bg-[var(--color-surface-raised)] p-5",
                "border border-[var(--color-border)]/50",
                "shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]",
                className,
            )}
        >
            {children}
        </div>
    );
}

/**
 * DarkCard — inverted surface for prominent single-metric display.
 * Uses --color-surface-invert (deep petrol in light mode, elevated petrol in
 * dark mode) so it remains visible and on-brand in both themes.
 */
export function DarkCard({ children, className = "" }) {
    return (
        <div
            className={cn("rounded-2xl overflow-hidden", className)}
            style={{
                background: "var(--color-surface-invert)",
                boxShadow: "inset 0 1px 0 var(--color-surface-invert-sub)",
            }}
        >
            <div className="p-5">{children}</div>
        </div>
    );
}

// ─── Text atoms ────────────────────────────────────────────────────────────────

/** Tiny uppercase section label */
export function Lbl({ children, light = false, className = "" }) {
    return (
        <div
            className={cn(
                "text-[10px] font-bold tracking-[0.14em] uppercase mb-2",
                light
                    ? "text-[var(--color-surface-invert-sub)]"
                    : "text-[var(--color-text-sub)]",
                className,
            )}
        >
            {children}
        </div>
    );
}

/** Trend delta pill — TrendingUp/Down icons, tight pill */
export function Delta({ value, label }) {
    const up = value >= 0;
    return (
        <span
            className="inline-flex items-center gap-[3px] text-[10px] font-bold px-2 py-[3px] rounded-full select-none border"
            style={up ? {
                background: "var(--color-success-bg)",
                color: "var(--color-success)",
                borderColor: "var(--color-success-border)",
            } : {
                background: "var(--color-danger-bg)",
                color: "var(--color-danger)",
                borderColor: "var(--color-danger-border)",
            }}
        >
            {up ? (
                <TrendingUpIcon size={9} strokeWidth={2.5} />
            ) : (
                <TrendingDownIcon size={9} strokeWidth={2.5} />
            )}
            {label ?? `${Math.abs(value).toFixed(1)}%`}
        </span>
    );
}

// ─── Chart helpers ─────────────────────────────────────────────────────────────

/** 3 px razor-thin progress bar */
export function ProgBar({ value, max, color = "var(--color-accent)", h = 3 }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div
            className="flex-1 overflow-hidden rounded-full"
            style={{
                height: h,
                background: "var(--color-border)",
                opacity: 0.9,
            }}
        >
            <div
                style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: color,
                    borderRadius: "9999px",
                    transition: "width .9s cubic-bezier(0.25,0.46,0.45,0.94)",
                }}
            />
        </div>
    );
}

/**
 * Sparkline with area fill.
 * Each instance gets a unique gradient ID via useId() to prevent
 * cross-instance gradient pollution when multiple sparks render simultaneously.
 */
export function Spark({ data = [], color = "var(--color-accent)", h = 32 }) {
    const uid = useId();
    // useId returns ":r0:" style strings — strip non-alphanum for valid SVG IDs
    const gradId = `spark-grad-${uid.replace(/\W/g, "")}`;

    if (data.length < 2) return <div style={{ height: h }} />;
    const vals = data.map((d) => d.v ?? 0);
    const mn = Math.min(...vals),
        mx = Math.max(...vals),
        rng = mx - mn || 1;
    const W = 110;

    const pts = vals
        .map(
            (v, i) =>
                `${(i / (vals.length - 1)) * W},${h - ((v - mn) / rng) * h * 0.82}`,
        )
        .join(" ");

    const areaPts = [
        `0,${h}`,
        ...vals.map(
            (v, i) =>
                `${(i / (vals.length - 1)) * W},${h - ((v - mn) / rng) * h * 0.82}`,
        ),
        `${W},${h}`,
    ].join(" ");

    const last = {
        x: W,
        y: h - ((vals.at(-1) - mn) / rng) * h * 0.82,
    };

    return (
        <svg
            width={W}
            height={h}
            viewBox={`0 0 ${W} ${h}`}
            style={{ overflow: "visible" }}
        >
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={areaPts} fill={`url(#${gradId})`} />
            <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <circle cx={last.x} cy={last.y} r={2.5} fill={color} />
            <circle cx={last.x} cy={last.y} r={4.5} fill={color} fillOpacity={0.2} />
        </svg>
    );
}

/** Semi-circle gauge */
export function Gauge({ pct, color = "var(--color-accent)" }) {
    const r = 48, cx = 60, cy = 58;
    const cl = Math.max(0, Math.min(1, pct));
    const angle = Math.PI + cl * Math.PI;
    const x = cx + r * Math.cos(angle),
        y = cy + r * Math.sin(angle);
    return (
        <svg width={120} height={66} viewBox="0 0 120 66">
            <path
                d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth={7}
                strokeLinecap="round"
            />
            {cl > 0 && (
                <path
                    d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${cl > 0.5 ? 1 : 0} 1 ${x} ${y}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={7}
                    strokeLinecap="round"
                />
            )}
            <circle
                cx={x}
                cy={y}
                r={4}
                fill={color}
                stroke="var(--color-surface-raised)"
                strokeWidth={1.5}
            />
        </svg>
    );
}

/**
 * Recharts tooltip — uses --color-surface-invert for a dark panel that
 * reads clearly over chart backgrounds in both light and dark mode.
 * Gradient removed (was AI slop; flat surface is cleaner and theme-safe).
 */
export function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div
            className="rounded-xl shadow-lg min-w-[160px] overflow-hidden"
            style={{
                background: "var(--color-surface-invert)",
                border: "1px solid var(--color-surface-invert-sub)",
            }}
        >
            <div
                className="px-3.5 pt-2.5 pb-1.5 border-b"
                style={{ borderColor: "var(--color-surface-invert-sub)" }}
            >
                <div
                    className="text-[10px] font-bold tracking-[0.12em] uppercase"
                    style={{ color: "var(--color-surface-invert-sub)" }}
                >
                    {label}
                </div>
            </div>
            <div className="px-3.5 pb-2.5 pt-2 flex flex-col gap-1">
                {payload.map((p) => (
                    <div
                        key={p.dataKey}
                        className="flex items-center gap-2"
                        style={{ color: "var(--color-surface-invert-text)" }}
                    >
                        <span
                            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: p.fill ?? p.color }}
                        />
                        <span className="flex-1 text-[11px]" style={{ color: "var(--color-surface-invert-sub)" }}>
                            {p.name}
                        </span>
                        <span className="font-bold text-[11px] tabular-nums">
                            {p.dataKey === "net"
                                ? `${(p.value ?? 0) >= 0 ? "+" : "−"}RS ${Math.abs(p.value || 0).toLocaleString()}`
                                : `RS ${Math.abs(p.value || 0).toLocaleString()}`}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Shimmer skeleton.
 * Keyframe lives in index.css (avoid per-render <style> injection).
 * Background uses --color-muted-fill (semantically correct for loaders).
 */
export function Skeleton({ h = 32 }) {
    return (
        <div
            className="rounded-xl relative overflow-hidden"
            style={{
                height: h,
                background: "var(--color-muted-fill)",
            }}
        >
            <div
                className="absolute inset-0 animate-shimmer"
                style={{
                    background:
                        "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)",
                }}
            />
        </div>
    );
}
