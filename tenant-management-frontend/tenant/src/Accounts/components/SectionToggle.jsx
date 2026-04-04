/**
 * SectionToggle.jsx
 *
 * Pill-style segmented toggle — replaces nested <Tabs> inside Revenue,
 * Expenses, and Liabilities tab content.
 *
 * Props:
 *   options  string[]  e.g. ["Overview", "Transactions", "Analysis"]
 *   value    string    current active option (lowercase, e.g. "overview")
 *   onChange fn        called with lowercase option string on select
 */

import { cn } from "@/lib/utils";

export default function SectionToggle({ options, value, onChange }) {
    return (
        <div className="inline-flex items-center gap-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-1">
            {options.map((option) => {
                const key = option.toLowerCase();
                return (
                    <button
                        key={key}
                        onClick={() => onChange(key)}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 cursor-pointer border-0 outline-none whitespace-nowrap",
                            value === key
                                ? "bg-[var(--color-surface)] text-[var(--color-text-strong)] shadow-sm"
                                : "bg-transparent text-[var(--color-text-sub)] hover:text-[var(--color-text-body)]",
                        )}
                    >
                        {option}
                    </button>
                );
            })}
        </div>
    );
}
