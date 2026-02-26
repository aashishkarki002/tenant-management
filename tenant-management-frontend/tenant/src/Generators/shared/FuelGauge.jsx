/**
 * FuelGauge
 * Renders the arc gauge driven purely by the `pct` prop (0-100).
 * All colour logic is local visual-only; no business rules live here.
 */
export function FuelGauge({ pct = 0, size = 80 }) {
    const r = 36, cx = 48, cy = 48, circum = 2 * Math.PI * r;
    const arcLen = circum * 0.75;
    const fill = arcLen * Math.max(0, Math.min(100, pct)) / 100;
    const dashOffset = -circum * 0.125 + (arcLen - fill);
    const color = pct <= 10 ? "#ef4444" : pct <= 25 ? "#f59e0b" : "#22c55e";

    return (
        <svg width={size} height={size} viewBox="0 0 96 96" className="shrink-0">
            {/* Track */}
            <circle
                cx={cx} cy={cy} r={r}
                fill="none" stroke="#f1f5f9" strokeWidth={9}
                strokeDasharray={`${arcLen} ${circum}`}
                strokeDashoffset={-circum * 0.125}
                strokeLinecap="round"
                transform="rotate(135 48 48)"
            />
            {/* Fill */}
            <circle
                cx={cx} cy={cy} r={r}
                fill="none" stroke={color} strokeWidth={9}
                strokeDasharray={`${arcLen} ${circum}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(135 48 48)"
                style={{ transition: "stroke-dashoffset .5s ease, stroke .3s" }}
            />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={15} fontWeight={700} fill={color}>
                {pct}%
            </text>
            <text x={cx} y={cy + 17} textAnchor="middle" fontSize={8} fill="#94a3b8" letterSpacing={1}>
                FUEL
            </text>
        </svg>
    );
}