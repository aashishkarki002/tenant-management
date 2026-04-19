/**
 * ProgressRow.jsx
 *
 * A single row showing: label · [progress bar] · percent + amount.
 * Used in Revenue Streams, Expense Breakdown, and Liabilities category panels.
 *
 * Props:
 *   label    string  e.g. "Rent"
 *   percent  number  0–100
 *   amount   string  pre-formatted e.g. "RS9K"
 *   color    string? CSS color value — defaults to var(--color-accent)
 */

export default function ProgressRow({ label, percent = 0, amount, color }) {
    const w = Math.min(Math.max(Number(percent) || 0, 0), 100);
    return (
        <div className="py-2">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium text-[var(--color-text-body)] truncate mr-2">
                    {label}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-[var(--color-text-sub)]">{w}%</span>
                    <span className="text-[12px] font-semibold text-[var(--color-text-strong)] tabular-nums">
                        {amount}
                    </span>
                </div>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                <div
                    className="h-full rounded-full"
                    style={{
                        width: `${w}%`,
                        background: color ?? "var(--color-accent)",
                        transition: "width 0.5s ease-out 0.1s",
                    }}
                />
            </div>
        </div>
    );
}
