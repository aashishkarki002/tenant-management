/**
 * FuelGauge — industrial dark variant
 * Arc gauge driven purely by `pct` prop (0–100).
 */
export function FuelGauge({ pct = 0, size = 80 }) {
    const r = 34;
    const cx = 48;
    const cy = 50;
    const circum = 2 * Math.PI * r;
    const arcLen = circum * 0.75;
    const fill = arcLen * Math.max(0, Math.min(100, pct)) / 100;
    const dashOffset = -circum * 0.125 + (arcLen - fill);

    const color =
        pct <= 10 ? "#f87171" : pct <= 25 ? "#fbbf24" : "#34d399";
    const glowColor =
        pct <= 10 ? "rgba(248,113,113,0.35)" : pct <= 25 ? "rgba(251,191,36,0.35)" : "rgba(52,211,153,0.35)";

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 96 96"
            className="shrink-0"
            style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
        >
            {/* Outer ring */}
            <circle
                cx={cx} cy={cy} r={38}
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
            />
            {/* Track */}
            <circle
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={8}
                strokeDasharray={`${arcLen} ${circum}`}
                strokeDashoffset={-circum * 0.125}
                strokeLinecap="round"
                transform="rotate(135 48 50)"
            />
            {/* Fill */}
            <circle
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={color}
                strokeWidth={8}
                strokeDasharray={`${arcLen} ${circum}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(135 48 50)"
                style={{ transition: "stroke-dashoffset .6s ease, stroke .3s" }}
            />
            {/* Value */}
            <text
                x={cx} y={cy + 4}
                textAnchor="middle"
                fontSize={14}
                fontWeight={900}
                fill={color}
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
                {pct}%
            </text>
            <text
                x={cx} y={cy + 15}
                textAnchor="middle"
                fontSize={7}
                fill="rgba(255,255,255,0.2)"
                letterSpacing={2}
            >
                FUEL
            </text>
        </svg>
    );
}   