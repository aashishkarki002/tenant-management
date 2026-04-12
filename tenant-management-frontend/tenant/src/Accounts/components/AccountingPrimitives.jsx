/**
 * AccountingPrimitives.jsx  —  REDESIGNED
 *
 * Fintech-grade UI atoms. Design decisions:
 *   • Cards use box-shadow hierarchy instead of heavy borders
 *   • Sparklines have a subtle area fill for better readability
 *   • Delta pill uses trend icons (TrendingUp/Down) not arrow icons
 *   • ProgBar is 3px — razor thin, confidence-inspiring
 *   • ChartTip uses a gradient dark panel matching the DarkCard treatment
 *   • Skeleton has a shimmer sweep animation
 *   • DarkCard uses a diagonal gradient + subtle dot-grid texture
 */

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

export function DarkCard({ children, className = "" }) {
    return (
        <div
            className={cn("rounded-2xl overflow-hidden", className)}
            style={{
                background: "#0d2535",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
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
                light ? "text-white/38" : "text-[var(--color-text-sub)]",
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

/** Sparkline with area fill */
export function Spark({ data = [], color = "var(--color-accent)", h = 32 }) {
    if (data.length < 2) return <div style={{ height: h }} />;
    const vals = data.map((d) => d.v ?? 0);
    const mn = Math.min(...vals),
        mx = Math.max(...vals),
        rng = mx - mn || 1;
    const W = 110;

    const pts = vals
        .map(
            (v, i) =>
                `${(i / (vals.length - 1)) * W},${h - ((v - mn) / rng) * h * 0.82
                }`,
        )
        .join(" ");

    const areaPts = [
        `0,${h}`,
        ...vals.map(
            (v, i) =>
                `${(i / (vals.length - 1)) * W},${h - ((v - mn) / rng) * h * 0.82
                }`,
        ),
        `${W},${h}`,
    ].join(" ");

    const last = {
        x: W,
        y: h - ((vals.at(-1) - mn) / rng) * h * 0.82,
    };

    const gradId = `sg-${color.replace(/[^a-z0-9]/gi, "")}`;

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
            <circle
                cx={last.x}
                cy={last.y}
                r={4.5}
                fill={color}
                fillOpacity={0.2}
            />
        </svg>
    );
}

/** Semi-circle gauge */
export function Gauge({ pct, color = "var(--color-accent)" }) {
    const r = 48,
        cx = 60,
        cy = 58;
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
                stroke="white"
                strokeWidth={1.5}
            />
        </svg>
    );
}

/** Recharts tooltip — gradient dark panel */
export function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div
            className="rounded-xl shadow-2xl min-w-[160px] overflow-hidden border border-white/8"
            style={{
                background:
                    "linear-gradient(140deg, #0a2f46 0%, #1a5276 100%)",
            }}
        >
            <div className="px-3.5 pt-2.5 pb-1.5 border-b border-white/10">
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/45">
                    {label}
                </div>
            </div>
            <div className="px-3.5 pb-2.5 pt-2 flex flex-col gap-1">
                {payload.map((p) => (
                    <div
                        key={p.dataKey}
                        className="flex items-center gap-2 text-white"
                    >
                        <span
                            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: p.fill ?? p.color }}
                        />
                        <span className="opacity-50 flex-1 text-[11px]">
                            {p.name}
                        </span>
                        <span className="font-bold text-[11px] tabular-nums">
                            {p.dataKey === "net"
                                ? `${(p.value ?? 0) >= 0 ? "+" : "−"}₹${Math.abs(
                                    p.value || 0,
                                ).toLocaleString()}`
                                : `₹${Math.abs(p.value || 0).toLocaleString()}`}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Shimmer skeleton */
export function Skeleton({ h = 32 }) {
    return (
        <div
            className="rounded-xl relative overflow-hidden"
            style={{
                height: h,
                background: "var(--color-border)",
            }}
        >
            <div
                className="absolute inset-0 -translate-x-full"
                style={{
                    background:
                        "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.28) 50%,transparent 100%)",
                    animation: "shimmer 1.6s infinite",
                }}
            />
            <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
        </div>
    );
}