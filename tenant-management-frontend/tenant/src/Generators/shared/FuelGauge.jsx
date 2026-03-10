/**
 * FuelGauge — works on both light and dark backgrounds.
 * Pass `dark` prop for dark card backgrounds (defaults to light/white).
 */
export function FuelGauge({ pct = 0, size = 80, dark = false }) {
    const r = 34;
    const cx = 48;
    const cy = 50;
    const circum = 2 * Math.PI * r;
    const arcLen = circum * 0.75;
    const fill = arcLen * Math.max(0, Math.min(100, pct)) / 100;
    const dashOffset = -circum * 0.125 + (arcLen - fill);

    const color =
        pct <= 10 ? "#ef4444" : pct <= 25 ? "#f59e0b" : "#22c55e";
    const trackColor = dark ? "var(--color-border)" : "var(--color-border)";
    const labelColor = dark ? "var(--color-text-sub)" : "var(--color-text-sub)";

    return (
        <svg width={size} height={size} viewBox="0 0 96 96" className="shrink-0">
            {/* Track */}
            <circle
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={trackColor}
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
                x={cx} y={cy + 5}
                textAnchor="middle"
                fontSize={15}
                fontWeight={800}
                fill={color}
                style={{ fontFamily: "monospace" }}
            >
                {pct}%
            </text>
            <text
                x={cx} y={cy + 16}
                textAnchor="middle"
                fontSize={7}
                fill={labelColor}
                letterSpacing={2}
            >
                FUEL
            </text>
        </svg>
    );
}