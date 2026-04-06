export function ProgressBar({ value, max, color, className = "" }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className={`h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden ${className}`}>
            <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: color ?? "var(--color-accent)" }}
            />
        </div>
    );
}
